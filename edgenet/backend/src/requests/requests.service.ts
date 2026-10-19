import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Activity, PRIORITIES, PocRequest, STATUSES, Status, User } from '../entities';
import { UsersService } from '../users/users.service';
import { CreateRequestDto } from './dto';
import { canMove, checkTransition, LABEL, nextStatuses } from './workflow';

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

  async get(me: User, id: string) {
    const r = await this.reqs.findOne({
      where: { id, organisation: me.organisation },
      relations: { activity: { actor: true } },
    });
    if (!r) throw new NotFoundException('PoC request not found.');
    r.activity.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    return Object.assign(r, { nextStatuses: nextStatuses(me, r) });
  }

  private log(request: PocRequest, actor: User, message: string) {
    return this.acts.save(this.acts.create({ request, actor, message }));
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
    const r = await this.reqs.save(
      this.reqs.create({ ...data, description: data.description ?? '', organisation: me.organisation, createdBy: me, assignedEngineer: eng }),
    );
    await this.log(r, me, `${me.name} raised this request.`);
    if (eng) await this.log(r, me, `${me.name} assigned ${eng.name}.`);
    return this.get(me, r.id);
  }

  async setStatus(me: User, id: string, status: Status, remarks?: string) {
    const r = await this.get(me, id);
    if (!canMove(me, r)) throw new ForbiddenException('Only the assigned engineer can move this request.');
    if (r.status === status) return r;
    checkTransition(r, status, remarks);
    const reason = remarks?.trim() ? ` Reason: ${remarks.trim()}` : '';
    await this.reqs.manager.transaction(async (m) => {
      // Only succeeds if nobody moved the request since we read it, so two concurrent moves cannot both apply.
      const res = await m.update(PocRequest, { id, status: r.status }, { status });
      if (!res.affected) throw new ConflictException('This request was just changed by someone else. Refresh and try again.');
      await m.save(m.create(Activity, { request: { id }, actor: me, message: `${me.name} moved this request from ${LABEL[r.status]} to ${LABEL[status]}.${reason}` }));
    });
    return this.get(me, id);
  }

  async assign(me: User, id: string, engineerId?: string | null) {
    const r = await this.get(me, id);
    const eng = engineerId ? await this.engineer(me, engineerId) : null;
    await this.reqs.save({ id, assignedEngineer: eng });
    const prev = r.assignedEngineer;
    await this.log(
      r, me,
      eng
        ? prev ? `${me.name} reassigned this request from ${prev.name} to ${eng.name}.` : `${me.name} assigned ${eng.name}.`
        : `${me.name} removed the assigned engineer.`,
    );
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
