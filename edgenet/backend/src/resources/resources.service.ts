import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, In, LessThanOrEqual, MoreThanOrEqual, Repository } from 'typeorm';
import { Allocation, InventoryResource, PocRequest, User } from '../entities';
import { logActivity } from '../requests/audit';
import { ALLOCATABLE, isResponsible, LABEL } from '../requests/workflow';
import { peakUsage } from './availability';
import { AllocateDto, CreateResourceDto, UpdateResourceDto } from './dto';

const ref = (n: number) => `POC-${String(n).padStart(4, '0')}`;
const today = () => new Date().toISOString().slice(0, 10);

@Injectable()
export class ResourcesService {
  constructor(
    @InjectRepository(InventoryResource) private resources: Repository<InventoryResource>,
    @InjectRepository(Allocation) private allocs: Repository<Allocation>,
    @InjectRepository(PocRequest) private reqs: Repository<PocRequest>,
  ) {}

  /** Active allocations of these resources that overlap the window (inclusive dates). */
  private overlapping(m: EntityManager, resourceIds: string[], start: string, end: string) {
    if (!resourceIds.length) return Promise.resolve([] as Allocation[]);
    return m.find(Allocation, {
      where: { resource: { id: In(resourceIds) }, status: 'active', startDate: LessThanOrEqual(end), endDate: MoreThanOrEqual(start) },
      relations: { request: true },
    });
  }

  /** The organisation's inventory with how many units are free on every day of the window (default: today). */
  async list(me: User, start = today(), end = start) {
    if (end < start) throw new BadRequestException('The end date must be on or after the start date.');
    const items = await this.resources.find({ where: { organisation: me.organisation }, order: { type: 'ASC', name: 'ASC' } });
    const booked = await this.overlapping(this.resources.manager, items.map((r) => r.id), start, end);
    return items.map((r) => {
      const inUse = peakUsage(booked.filter((a) => a.resource.id === r.id), start, end);
      return { ...r, inUse, available: r.state === 'available' ? Math.max(0, r.capacity - inUse) : 0 };
    });
  }

  create(me: User, dto: CreateResourceDto) {
    return this.resources.save(this.resources.create({ ...dto, specs: dto.specs ?? '', organisation: me.organisation }));
  }

  async update(me: User, id: string, dto: UpdateResourceDto) {
    return this.resources.manager.transaction(async (m) => {
      const r = await m.findOne(InventoryResource, { where: { id, organisation: me.organisation }, lock: { mode: 'pessimistic_write' } });
      if (!r) throw new NotFoundException('Resource not found.');
      if (dto.capacity !== undefined && dto.capacity < r.capacity) {
        const active = await m.find(Allocation, { where: { resource: { id }, status: 'active' } });
        const first = active.reduce((d, a) => (a.startDate < d ? a.startDate : d), '9999-12-31');
        const last = active.reduce((d, a) => (a.endDate > d ? a.endDate : d), '0000-01-01');
        const peak = active.length ? peakUsage(active, first, last) : 0;
        if (dto.capacity < peak) {
          throw new ConflictException(`${peak} ${r.unit} are already allocated on some days. Release allocations before lowering capacity below that.`);
        }
      }
      return m.save(Object.assign(r, dto));
    });
  }

  private async request(me: User, id: string) {
    const r = await this.reqs.findOne({ where: { id, organisation: me.organisation } });
    if (!r) throw new NotFoundException('PoC request not found.');
    return r;
  }

  async forRequest(me: User, requestId: string) {
    await this.request(me, requestId);
    return this.allocs.find({ where: { request: { id: requestId } }, order: { createdAt: 'DESC' } });
  }

  async allocate(me: User, requestId: string, dto: AllocateDto) {
    const r = await this.request(me, requestId);
    if (!isResponsible(me, r)) throw new ForbiddenException('Only the Account Manager or the assigned engineer can allocate resources.');
    if (!ALLOCATABLE.includes(r.status)) throw new ConflictException(`Resources cannot be allocated to a request in ${LABEL[r.status]}.`);
    const startDate = dto.startDate ?? r.startDate;
    const endDate = dto.endDate ?? r.endDate;
    if (endDate < startDate) throw new BadRequestException('The end date must be on or after the start date.');

    const id = await this.reqs.manager.transaction(async (m) => {
      // Lock the resource row: concurrent allocations of the same resource queue here, then each sees the others' bookings.
      const res = await m.findOne(InventoryResource, {
        where: { id: dto.resourceId, organisation: me.organisation }, lock: { mode: 'pessimistic_write' },
      });
      if (!res) throw new BadRequestException("Choose a resource from your organisation's inventory.");
      if (res.state !== 'available') {
        throw new ConflictException(`${res.name} is ${res.state === 'maintenance' ? 'in maintenance' : 'retired'} and cannot be allocated.`);
      }
      const booked = await this.overlapping(m, [res.id], startDate, endDate);
      const free = Math.max(0, res.capacity - peakUsage(booked, startDate, endDate));
      if (dto.quantity > free) {
        throw new ConflictException({
          statusCode: 409,
          error: 'Conflict',
          message: `Only ${free} of ${res.capacity} ${res.unit} of ${res.name} are free on every day from ${startDate} to ${endDate}; you asked for ${dto.quantity}.`,
          available: free,
          conflicts: booked.map((a) => ({
            request: ref(a.request.number), projectName: a.request.projectName, startDate: a.startDate, endDate: a.endDate, quantity: a.quantity,
          })),
        });
      }
      const a = await m.save(m.create(Allocation, { resource: res, request: { id: requestId }, quantity: dto.quantity, startDate, endDate, allocatedBy: me }));
      await logActivity(m, requestId, me, 'resource_allocated',
        `${me.name} allocated ${dto.quantity} ${res.unit} of ${res.name} from ${startDate} to ${endDate}.`, { toValue: a.id });
      return a.id;
    });
    return this.allocs.findOneBy({ id });
  }

  async release(me: User, requestId: string, allocationId: string) {
    const r = await this.request(me, requestId);
    if (!isResponsible(me, r)) throw new ForbiddenException('Only the Account Manager or the assigned engineer can release resources.');
    await this.reqs.manager.transaction(async (m) => {
      const a = await m.findOne(Allocation, { where: { id: allocationId, request: { id: requestId } } });
      if (!a) throw new NotFoundException('Allocation not found.');
      // Only an active allocation can be released, so repeating the call cannot release anything twice.
      const res = await m.createQueryBuilder().update(Allocation)
        .set({ status: 'released', releasedBy: me, releasedAt: () => 'clock_timestamp()' })
        .where('id = :id AND status = :active', { id: allocationId, active: 'active' })
        .execute();
      if (!res.affected) throw new ConflictException('This allocation has already been released.');
      await logActivity(m, requestId, me, 'resource_released',
        `${me.name} released ${a.quantity} ${a.resource.unit} of ${a.resource.name}.`, { fromValue: a.id });
    });
    return this.allocs.findOneBy({ id: allocationId });
  }
}
