import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { PocRequest, Status, User } from '../entities';

export const LABEL: Record<Status, string> = {
  new_request: 'New Request',
  provisioning: 'Infrastructure Provisioning',
  testing: 'In Testing',
  completed: 'Completed',
  decommissioned: 'Decommissioned',
};

interface Step { to: Status; needsReason?: boolean; amOnly?: boolean; cancel?: boolean }
// Cancelling an unfinished PoC: only the Account Manager, with a reason. It still has to pass the decommissioning checklist.
const CANCEL: Step = { to: 'decommissioned', needsReason: true, amOnly: true, cancel: true };

// The PoC lifecycle. Every status change goes through checkTransition, so this table is the single source of truth.
// needsReason marks moves that need an explanation (rework, cancellation); the reason is kept in the audit trail.
const FLOW: Record<Status, Step[]> = {
  new_request: [{ to: 'provisioning' }, CANCEL],
  provisioning: [{ to: 'testing' }, CANCEL],
  testing: [{ to: 'completed' }, { to: 'provisioning', needsReason: true }, CANCEL],
  completed: [{ to: 'decommissioned' }],
  decommissioned: [],
};

/** Stages in which resources can still be allocated. Releasing is allowed at any stage. */
export const ALLOCATABLE: Status[] = ['new_request', 'provisioning', 'testing'];

/** What still stands between a request and Decommissioned. */
export interface Closure { openTasks: number; activeAllocations: number }

export interface Transition { to: Status; needsReason: boolean; cancel: boolean; blocked: string | null }

/** Account Managers can work on any request in their organisation (move it, allocate resources); engineers only on the ones assigned to them. */
export const isResponsible = (me: User, r: PocRequest) => me.role === 'account_manager' || r.assignedEngineer?.id === me.id;

/** Information a move needs before it is allowed: returns why the move is blocked, or null. */
function blocker(r: PocRequest, to: Status, c: Closure): string | null {
  if (to === 'provisioning' && !r.assignedEngineer) return 'Assign an engineer before starting provisioning.';
  if (to === 'decommissioned' && (c.openTasks || c.activeAllocations)) {
    const parts = [
      c.openTasks && `${c.openTasks} required checklist task${c.openTasks === 1 ? '' : 's'} still open`,
      c.activeAllocations && `${c.activeAllocations} resource allocation${c.activeAllocations === 1 ? '' : 's'} not yet released`,
    ].filter(Boolean);
    return `Finish the decommissioning checklist first: ${parts.join(' and ')}.`;
  }
  return null;
}

/** The moves this user can make on this request right now, for the UI to offer. */
export function nextStatuses(me: User, r: PocRequest, c: Closure): Transition[] {
  if (!isResponsible(me, r)) return [];
  return FLOW[r.status]
    .filter((t) => !t.amOnly || me.role === 'account_manager')
    .map((t) => ({ to: t.to, needsReason: !!t.needsReason, cancel: !!t.cancel, blocked: blocker(r, t.to, c) }));
}

/** Throws unless this user may move the request to `to`. Whether they may act on the request at all is checked with isResponsible. */
export function checkTransition(me: User, r: PocRequest, to: Status, c: Closure, remarks?: string) {
  const t = FLOW[r.status].find((x) => x.to === to);
  if (!t) {
    const allowed = FLOW[r.status].map((x) => LABEL[x.to]).join(' or ') || 'nothing (this is the final stage)';
    throw new ConflictException(`A request in ${LABEL[r.status]} cannot move to ${LABEL[to]}. It can move to ${allowed}.`);
  }
  if (t.amOnly && me.role !== 'account_manager') throw new ForbiddenException('Only the Account Manager can cancel a PoC.');
  if (t.needsReason && !remarks?.trim()) {
    throw new BadRequestException(t.cancel ? 'Give a reason for cancelling this PoC.' : `Give a reason for moving this request back to ${LABEL[to]}.`);
  }
  const b = blocker(r, to, c);
  if (b) throw new BadRequestException(b);
  return t;
}
