import { EntityManager } from 'typeorm';
import { Allocation, DecommissionCheck, Status } from '../entities';
import { Closure } from './workflow';

// What has to happen before a PoC can be decommissioned, whether it completed or was cancelled.
// `auto` tasks are worked out from the data instead of ticked by hand.
export const CHECKLIST: { key: string; label: string; mandatory: boolean; auto?: boolean }[] = [
  { key: 'client_notified', label: 'Client told the PoC is ending, and results or handover sent', mandatory: true },
  { key: 'resources_released', label: 'Every allocated resource released (see Allocated resources)', mandatory: true, auto: true },
  { key: 'access_revoked', label: 'Temporary client access, accounts and credentials removed', mandatory: true },
  { key: 'data_handled', label: 'Client data wiped or returned as agreed', mandatory: true },
  { key: 'equipment_verified', label: 'Returned equipment checked and back in service', mandatory: false },
  { key: 'closure_report', label: 'Closure notes or report filed', mandatory: false },
];
const REQUIRED = CHECKLIST.filter((t) => t.mandatory && !t.auto).map((t) => t.key);

// The resources task is counted through activeAllocations, so openTasks only counts hand-ticked tasks.
const closureOf = (doneKeys: string[], activeAllocations: number): Closure =>
  ({ openTasks: REQUIRED.filter((k) => !doneKeys.includes(k)).length, activeAllocations });

/** Locks the request row until the transaction ends and returns its current status. Every write that can change
 *  whether a request may close (stage moves, allocations, checklist ticks) takes this lock, so they cannot interleave. */
export async function lockRequest(m: EntityManager, id: string): Promise<Status> {
  const [row] = await m.query('SELECT status FROM poc_requests WHERE id = $1 FOR UPDATE', [id]);
  return row.status;
}

/** One request's checklist, as shown on its page, and what still blocks closing it. */
export async function closureState(m: EntityManager, requestId: string) {
  const [checks, activeAllocations] = await Promise.all([
    m.find(DecommissionCheck, { where: { request: { id: requestId } } }),
    m.count(Allocation, { where: { request: { id: requestId }, status: 'active' } }),
  ]);
  const items = CHECKLIST.map((t) => {
    const c = checks.find((x) => x.key === t.key);
    return {
      key: t.key, label: t.label, mandatory: t.mandatory, auto: !!t.auto,
      done: t.auto ? activeAllocations === 0 : !!c,
      completedBy: c?.completedBy ?? null, completedAt: c?.completedAt ?? null, notes: c?.notes ?? null,
    };
  });
  return { items, closure: closureOf(checks.map((c) => c.key), activeAllocations) };
}

/** What blocks closing each of these requests, in two grouped queries (for lists such as the board). */
export async function closures(m: EntityManager, ids: string[]) {
  const out = new Map<string, Closure>();
  if (!ids.length) return out;
  const [allocs, checks]: [{ id: string; n: number }[], { id: string; keys: string[] }[]] = await Promise.all([
    m.query(`SELECT "requestId" AS id, count(*)::int AS n FROM allocations WHERE status = 'active' AND "requestId" = ANY($1) GROUP BY 1`, [ids]),
    m.query(`SELECT "requestId" AS id, array_agg(key) AS keys FROM decommission_checks WHERE "requestId" = ANY($1) GROUP BY 1`, [ids]),
  ]);
  for (const id of ids) out.set(id, closureOf(checks.find((c) => c.id === id)?.keys ?? [], allocs.find((a) => a.id === id)?.n ?? 0));
  return out;
}
