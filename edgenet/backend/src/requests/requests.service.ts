import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { Activity, ActivityAction, PRIORITIES, PocRequest, STATUSES, Status, User } from '../entities';
import { UsersService } from '../users/users.service';
import { CreateRequestDto } from './dto';
import { canMove, checkTransition, LABEL, nextStatuses } from './workflow';

export const HISTORY_PAGE = 20;

@Injectable()
export class RequestsService {
  constructor(
    @InjectRepository(PocRequest) private reqs: Repository<PocRequest>,
    @InjectRepository(Activity) private acts: Repository<Activity>,
    @InjectRepository(User) private users: Repository<User>,
    private usersSvc: UsersService,
  ) {}

  async list(me: User, status?: Status) {
    const rows = await this.reqs.find({
      where: { organisation: me.organisation, ...(status ? { status } : {}) },
      order: { createdAt: 'DESC' },
    });
    return rows.map((r) => ({ ...r, nextStatuses: nextStatuses(me, r) }));
  }

  private async find(me: User, id: string) {
    const r = await this.reqs.findOne({ where: { id, organisation: me.organisation } });
    if (!r) throw new NotFoundException('PoC request not found.');
    return r;
  }

  /** The request with its latest activity (older entries come from activity()) and the moves this user can make. */
  async get(me: User, id: string) {
    const r = await this.find(me, id);
    const { items, total } = await this.history(id, 1, HISTORY_PAGE);
    return Object.assign(r, { activity: items, activityTotal: total, nextStatuses: nextStatuses(me, r) });
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

  /** Writes an audit row. Always called inside the transaction that makes the change, so both commit or neither does. */
  private log(
    m: EntityManager, requestId: string, actor: User, action: ActivityAction, message: string,
    extra: { fromValue?: string | null; toValue?: string | null; remarks?: string | null } = {},
  ) {
    return m.save(m.create(Activity, { request: { id: requestId }, actor, action, message, ...extra }));
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
      await this.log(m, r.id, me, 'created', `${me.name} raised this request.`, { toValue: r.status });
      if (eng) await this.log(m, r.id, me, 'assigned', `${me.name} assigned ${eng.name}.`, { toValue: eng.id });
      return r.id;
    });
    return this.get(me, id);
  }

  async setStatus(me: User, id: string, status: Status, remarks?: string) {
    const r = await this.find(me, id);
    if (!canMove(me, r)) throw new ForbiddenException('Only the assigned engineer can move this request.');
    if (r.status === status) return this.get(me, id);
    checkTransition(r, status, remarks);
    await this.reqs.manager.transaction(async (m) => {
      // Only succeeds if nobody moved the request since we read it, so two concurrent moves cannot both apply.
      const res = await m.update(PocRequest, { id, status: r.status }, { status });
      if (!res.affected) throw new ConflictException('This request was just changed by someone else. Refresh and try again.');
      await this.log(m, id, me, 'status_changed', `${me.name} moved this request from ${LABEL[r.status]} to ${LABEL[status]}.`, {
        fromValue: r.status, toValue: status, remarks: remarks?.trim() || null,
      });
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
      await this.log(m, id, me, action, message, { fromValue: prev?.id ?? null, toValue: eng?.id ?? null });
    });
    return this.get(me, id);
  }

  async report(me: User) {
    const all = await this.reqs.find({ where: { organisation: me.organisation } });
    const count = <T extends string>(keys: readonly T[], f: (r: PocRequest, k: T) => boolean) =>
      Object.fromEntries(keys.map((k) => [k, all.filter((r) => f(r, k)).length])) as Record<T, number>;
    const byStatus = count(STATUSES, (r, k) => r.status === k);
    const byPriority = count(PRIORITIES, (r, k) => r.priority === k);
    const total = all.length;
    return {
      total,
      active: byStatus.new_request + byStatus.provisioning + byStatus.testing,
      completed: byStatus.completed,
      completionRate: total ? Math.round((byStatus.completed / total) * 100) : 0,
      unassigned: all.filter((r) => !r.assignedEngineer && r.status !== 'completed' && r.status !== 'decommissioned').length,
      byStatus,
      byPriority,
      workload: (await this.usersSvc.engineers(me)).map((e) => ({ id: e.id, name: e.name, active: e.active, completed: e.completed, total: e.total })),
    };
  }
}
