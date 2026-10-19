import { BadRequestException, ConflictException } from '@nestjs/common';
import { PocRequest, Status, User } from '../entities';

export const LABEL: Record<Status, string> = {
  new_request: 'New Request',
  provisioning: 'Infrastructure Provisioning',
  testing: 'In Testing',
  completed: 'Completed',
  decommissioned: 'Decommissioned',
};

// The PoC lifecycle. Every status change goes through checkTransition, so this table is the single source of truth.
// needsReason marks moves that send work backwards; the reason is kept in the request's activity.
const FLOW: Record<Status, { to: Status; needsReason?: boolean }[]> = {
  new_request: [{ to: 'provisioning' }],
  provisioning: [{ to: 'testing' }],
  testing: [{ to: 'completed' }, { to: 'provisioning', needsReason: true }],
  completed: [{ to: 'decommissioned' }],
  decommissioned: [],
};

/** Stages in which resources can still be allocated. Releasing is allowed at any stage. */
export const ALLOCATABLE: Status[] = ['new_request', 'provisioning', 'testing'];

export interface Transition { to: Status; needsReason: boolean; blocked: string | null }

/** Account Managers can work on any request in their organisation (move it, allocate resources); engineers only on the ones assigned to them. */
export const isResponsible = (me: User, r: PocRequest) => me.role === 'account_manager' || r.assignedEngineer?.id === me.id;

/** Information a move needs before it is allowed: returns why the move is blocked, or null. */
function blocker(r: PocRequest, to: Status): string | null {
  if (to === 'provisioning' && !r.assignedEngineer) return 'Assign an engineer before starting provisioning.';
  return null;
}

/** The moves this user can make on this request right now, for the UI to offer. */
export function nextStatuses(me: User, r: PocRequest): Transition[] {
  if (!isResponsible(me, r)) return [];
  return FLOW[r.status].map((t) => ({ to: t.to, needsReason: !!t.needsReason, blocked: blocker(r, t.to) }));
}

/** Throws unless the request may move to `to`. Permission is checked separately with isResponsible. */
export function checkTransition(r: PocRequest, to: Status, remarks?: string) {
  const t = FLOW[r.status].find((x) => x.to === to);
  if (!t) {
    const allowed = FLOW[r.status].map((x) => LABEL[x.to]).join(' or ') || 'nothing (this is the final stage)';
    throw new ConflictException(`A request in ${LABEL[r.status]} cannot move to ${LABEL[to]}. It can move to ${allowed}.`);
  }
  const b = blocker(r, to);
  if (b) throw new BadRequestException(b);
  if (t.needsReason && !remarks?.trim()) throw new BadRequestException(`Give a reason for moving this request back to ${LABEL[to]}.`);
}
