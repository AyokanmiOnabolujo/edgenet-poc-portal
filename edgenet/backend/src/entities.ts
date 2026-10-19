import {
  Check, Column, CreateDateColumn, Entity, Index, ManyToOne, OneToMany,
  PrimaryGeneratedColumn, UpdateDateColumn,
} from 'typeorm';

export type Role = 'account_manager' | 'engineer';
export const STATUSES = ['new_request', 'provisioning', 'testing', 'completed', 'decommissioned'] as const;
export type Status = (typeof STATUSES)[number];
export const PRIORITIES = ['low', 'medium', 'high', 'critical'] as const;
export type Priority = (typeof PRIORITIES)[number];
export const ACTIONS = ['created', 'status_changed', 'assigned', 'reassigned', 'unassigned', 'resource_allocated', 'resource_released'] as const;
export type ActivityAction = (typeof ACTIONS)[number];
export const RESOURCE_STATES = ['available', 'maintenance', 'retired'] as const;
export type ResourceState = (typeof RESOURCE_STATES)[number];

@Entity('users')
// Database-level guarantee: one Account Manager per organisation.
@Index('one_account_manager_per_org', ['organisation'], { unique: true, where: `"role" = 'account_manager'` })
export class User {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column() name: string;
  @Column({ unique: true }) email: string;
  @Column({ select: false }) passwordHash: string;
  @Column({ type: 'varchar' }) role: Role;
  @Column() organisation: string;
  @CreateDateColumn() createdAt: Date;
}

@Entity('poc_requests')
export class PocRequest {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'int', generated: 'increment' }) number: number;
  @Column() organisation: string;
  @Column() clientName: string;
  @Column() clientEmail: string;
  @Column() clientCompany: string;
  @Column() projectName: string;
  @Column({ type: 'text', default: '' }) description: string;
  @Column({ type: 'date' }) startDate: string;
  @Column({ type: 'date' }) endDate: string;
  @Column({ type: 'varchar', default: 'medium' }) priority: Priority;
  @Column({ type: 'varchar', default: 'new_request' }) status: Status;
  @Column({ type: 'jsonb', default: () => "'[]'" }) resources: { type: string; quantity: number; notes?: string }[];
  @ManyToOne(() => User, { eager: true, nullable: false }) createdBy: User;
  @ManyToOne(() => User, { eager: true, nullable: true }) assignedEngineer: User | null;
  @OneToMany(() => Activity, (a) => a.request) activity: Activity[];
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}

// Audit trail: one row per significant change to a request. Rows are only ever inserted, never updated or deleted
// by the app. The actor and time are set on the server. Rows written before the audit columns existed have action null.
@Entity('activity')
@Index(['request', 'createdAt'])
export class Activity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @ManyToOne(() => PocRequest, (r) => r.activity, { onDelete: 'CASCADE' }) request: PocRequest;
  @ManyToOne(() => User, { nullable: true }) actor: User;
  @Column({ type: 'varchar', nullable: true }) action: ActivityAction | null;
  // Status changes: status values. Assignments: engineer user ids. Allocations: toValue is the allocation id.
  @Column({ type: 'varchar', nullable: true }) fromValue: string | null;
  @Column({ type: 'varchar', nullable: true }) toValue: string | null;
  @Column({ type: 'text', nullable: true }) remarks: string | null;
  @Column() message: string;
  // clock_timestamp(), not now(): several rows written in one transaction must still get distinct, ordered times.
  @CreateDateColumn({ default: () => 'clock_timestamp()' }) createdAt: Date;
}

// Something the organisation can lend to PoCs, entered by hand by the Account Manager. It is not connected to real
// infrastructure. capacity is how many units can be in use on the same day: 1 for an exclusive item such as a
// physical server, more for a pool such as licence seats or TB of storage. Retire items instead of deleting them.
@Entity('inventory_resources')
@Check(`"capacity" >= 1`)
export class InventoryResource {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column() organisation: string;
  @Column() name: string;
  @Column() type: string;
  @Column({ default: 'unit' }) unit: string;
  @Column({ type: 'text', default: '' }) specs: string;
  @Column({ type: 'int' }) capacity: number;
  @Column({ type: 'varchar', default: 'available' }) state: ResourceState;
  @CreateDateColumn() createdAt: Date;
}

// Some of a resource's capacity reserved for one PoC over inclusive dates. Free capacity is always worked out from
// active allocations, never stored as a counter, so it cannot drift out of step with them.
@Entity('allocations')
@Check(`"quantity" >= 1`)
@Check(`"endDate" >= "startDate"`)
@Index(['resource', 'status'])
export class Allocation {
  @PrimaryGeneratedColumn('uuid') id: string;
  @ManyToOne(() => InventoryResource, { eager: true, nullable: false }) resource: InventoryResource;
  @ManyToOne(() => PocRequest, { nullable: false }) request: PocRequest;
  @Column({ type: 'int' }) quantity: number;
  @Column({ type: 'date' }) startDate: string;
  @Column({ type: 'date' }) endDate: string;
  @Column({ type: 'varchar', default: 'active' }) status: 'active' | 'released';
  @ManyToOne(() => User, { eager: true, nullable: false }) allocatedBy: User;
  @CreateDateColumn() createdAt: Date;
  @ManyToOne(() => User, { eager: true, nullable: true }) releasedBy: User | null;
  @Column({ type: 'timestamp', nullable: true }) releasedAt: Date | null;
}
