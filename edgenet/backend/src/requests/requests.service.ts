import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Not, Repository } from 'typeorm';
import { Activity, ActivityAction, DecommissionCheck, PocRequest, Status, User } from '../entities';
import { logActivity } from './audit';
import { CHECKLIST, closures, closureState, lockRequest } from './closure';
import { deadline, deadlineSettings, todayIn } from './deadlines';
import { buildReport, ReportFilters } from './report';
import { CreateRequestDto } from './dto';
import { ALLOCATABLE, checkTransition, isResponsible, LABEL, nextStatuses } from './workflow';

export const HISTORY_PAGE = 20;

@Injectable()
export class RequestsService {
  // Read once, so a bad APP_TIMEZONE or DEADLINE_WARNING_DAYS stops the API at startup instead of failing requests.
  private deadlines = deadlineSettings();

  constructor(
    @InjectRepository(PocRequest) private reqs: Repository<PocRequest>,
    @InjectRepository(Activity) private acts: Repository<Activity>,
    @InjectRepository(User) private users: Repository<User>,
  ) {}

  async list(me: User, status?: Status) {
    const rows = await this.reqs.find({
      where: { organisation: me.organisation, ...(status ? { status } : {}) },
      order: { createdAt: 'DESC' },
    });
    const blocks = await closures(this.reqs.manager, rows.map((r) => r.id));
    const today = this.today();
    return rows.map((r) => ({
      ...r, nextStatuses: nextStatuses(me, r, blocks.get(r.id)), deadline: deadline(r, today, this.deadlines.warnDays),
    }));
  }

  private today() { return todayIn(this.deadlines.timeZone); }

  /** Open requests that are overdue, due soon or late to start: every one for the Account Manager, an engineer's own
   *  assignments for an engineer. Most urgent first. */
  async alerts(me: User) {
    const today = this.today();
    const open = await this.reqs.find({
      where: {
        organisation: me.organisation, status: Not(In(['completed', 'decommissioned'])),
        ...(me.role === 'engineer' ? { assignedEngineer: { id: me.id } } : {}),
      },
    });
    const items = open
      .map((r) => ({ ...r, deadline: deadline(r, today, this.deadlines.warnDays) }))
      .filter((r) => r.deadline.overdue || r.deadline.dueSoon || r.deadline.lateStart)
      .sort((a, b) => a.deadline.daysLeft - b.deadline.daysLeft);
    return {
      today, timeZone: this.deadlines.timeZone, warnDays: this.deadlines.warnDays,
      counts: {
        overdue: items.filter((r) => r.deadline.overdue).length,
        dueSoon: items.filter((r) => r.deadline.dueSoon).length,
        lateStart: items.filter((r) => r.deadline.lateStart).length,
      },
      items,
    };
  }

  private async find(me: User, id: string) {
    const r = await this.reqs.findOne({ where: { id, organisation: me.organisation } });
    if (!r) throw new NotFoundException('PoC request not found.');
    return r;
  }

  /** The request with its latest activity (older entries come from activity()), its decommissioning checklist,
   *  and what this user can do with it. */
  async get(me: User, id: string) {
    const r = await this.find(me, id);
    const [{ items, total }, { items: checklist, closure }] = await Promise.all([
      this.history(id, 1, HISTORY_PAGE), closureState(this.reqs.manager, id),
    ]);
    const responsible = isResponsible(me, r);
    return Object.assign(r, {
      activity: items, activityTotal: total, checklist,
      deadline: deadline(r, this.today(), this.deadlines.warnDays),
      nextStatuses: nextStatuses(me, r, closure),
      canAllocate: responsible && ALLOCATABLE.includes(r.status),
      canRelease: responsible,
      canEditChecklist: responsible && r.status !== 'decommissioned',
    });
  }

  /** One page of a request's audit trail, newest first. */
  async activity(me: User, id: string, page: number, limit: number) {
    await this.find(me, id);
    return this.history(id, page, limit);
  }

  private async history(id: string, page: number, limit: number) {
    const [items, total] = await this.acts.findAndCount({
      where: { request: { id } },
      relations: { actor: true },
      order: { createdAt: 'DESC', id: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { items, total, page, limit };
  }

  private async engineer(me: User, id: string) {
    const e = await this.users.findOneBy({ id, organisation: me.organisation, role: 'engineer' });
    if (!e) throw new BadRequestException('Choose an engineer from your organisation.');
    return e;
  }

  async create(me: User, dto: CreateRequestDto) {
    if (dto.endDate < dto.startDate) throw new BadRequestException('End date must be on or after the start date.');
    const eng = dto.assignedEngineerId ? await this.engineer(me, dto.assignedEngineerId) : null;
    const { assignedEngineerId, ...data } = dto;
    const id = await this.reqs.manager.transaction(async (m) => {
      const r = await m.save(
        m.create(PocRequest, { ...data, description: data.description ?? '', organisation: me.organisation, createdBy: me, assignedEngineer: eng }),
      );
      await logActivity(m, r.id, me, 'created', `${me.name} raised this request.`, { toValue: r.status });
      if (eng) await logActivity(m, r.id, me, 'assigned', `${me.name} assigned ${eng.name}.`, { toValue: eng.id });
      return r.id;
    });
    return this.get(me, id);
  }

  async setStatus(me: User, id: string, status: Status, remarks?: string) {
    const r = await this.find(me, id);
    if (!isResponsible(me, r)) throw new ForbiddenException('Only the assigned engineer can move this request.');
    if (r.status === status) return this.get(me, id);
    await this.reqs.manager.transaction(async (m) => {
      // With the request row locked, nobody can move it, allocate to it or change its checklist until we commit,
      // so the checks below are made on exactly the state the move applies to.
      if ((await lockRequest(m, id)) !== r.status) {
        throw new ConflictException('This request was just changed by someone else. Refresh and try again.');
      }
      const t = checkTransition(me, r, status, (await closureState(m, id)).closure, remarks);
      await m.update(PocRequest, { id }, { status });
      const [action, message]: [ActivityAction, string] = t.cancel
        ? ['cancelled', `${me.name} cancelled this PoC while it was in ${LABEL[r.status]} and moved it to ${LABEL[status]}.`]
        : ['status_changed', `${me.name} moved this request from ${LABEL[r.status]} to ${LABEL[status]}.`];
      await logActivity(m, id, me, action, message, { fromValue: r.status, toValue: status, remarks: remarks?.trim() || null });
    });
    return this.get(me, id);
  }

  /** Ticks or unticks one decommissioning task. Repeating the same tick or untick changes nothing and logs nothing. */
  async setCheck(me: User, id: string, key: string, done: boolean, notes?: string) {
    const r = await this.find(me, id);
    if (!isResponsible(me, r)) throw new ForbiddenException('Only the Account Manager or the assigned engineer can update the checklist.');
    const task = CHECKLIST.find((t) => t.key === key);
    if (!task) throw new NotFoundException('There is no such checklist task.');
    if (task.auto) throw new BadRequestException('This task completes itself once every allocated resource is released.');
    await this.reqs.manager.transaction(async (m) => {
      if ((await lockRequest(m, id)) === 'decommissioned') throw new ConflictException('This PoC is decommissioned; its checklist is closed.');
      if (done) {
        const res = await m.createQueryBuilder().insert().into(DecommissionCheck)
          .values({ request: { id }, key, completedBy: me, notes: notes?.trim() || null }).orIgnore().execute();
        if (res.raw.length) await logActivity(m, id, me, 'check_completed', `${me.name} completed "${task.label}".`, { toValue: key, remarks: notes?.trim() || null });
      } else {
        const res = await m.delete(DecommissionCheck, { request: { id }, key });
        if (res.affected) await logActivity(m, id, me, 'check_reopened', `${me.name} reopened "${task.label}".`, { fromValue: key });
      }
    });
    return this.get(me, id);
  }

  async assign(me: User, id: string, engineerId?: string | null) {
    const r = await this.find(me, id);
    const eng = engineerId ? await this.engineer(me, engineerId) : null;
    const prev = r.assignedEngineer;
    if ((prev?.id ?? null) === (eng?.id ?? null)) return this.get(me, id);
    await this.reqs.manager.transaction(async (m) => {
      // Same guard as setStatus: the "previous engineer" in the audit row must be the one actually replaced.
      const res = await m.createQueryBuilder().update(PocRequest).set({ assignedEngineer: eng ?? null }).where('id = :id', { id })
        .andWhere(prev ? '"assignedEngineerId" = :prev' : '"assignedEngineerId" IS NULL', { prev: prev?.id }).execute();
      if (!res.affected) throw new ConflictException('This request was just changed by someone else. Refresh and try again.');
      const [action, message]: [ActivityAction, string] = !eng
        ? ['unassigned', `${me.name} removed the assigned engineer.`]
        : prev ? ['reassigned', `${me.name} reassigned this request from ${prev.name} to ${eng.name}.`] : ['assigned', `${me.name} assigned ${eng.name}.`];
      await logActivity(m, id, me, action, message, { fromValue: prev?.id ?? null, toValue: eng?.id ?? null });
    });
    return this.get(me, id);
  }

  /** Analytics for the Reports page. Every number is aggregated in the database; see report.ts for definitions. */
  report(me: User, filters: ReportFilters) {
    return buildReport(this.reqs.manager, me, filters, this.deadlines);
  }
}
