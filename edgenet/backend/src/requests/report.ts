import { EntityManager } from 'typeorm';
import { PRIORITIES, Priority, STATUSES, Status, User } from '../entities';
import { deadline, DeadlineSettings, todayIn } from './deadlines';

export interface ReportFilters { from?: string; to?: string; engineerId?: string; priority?: Priority }

// Metric definitions (README "Analytics" lists the same):
//   active           New Request, Infrastructure Provisioning or In Testing
//   completed        reached Completed: status Completed, or Decommissioned without having been cancelled
//   cancelled        Decommissioned through the Account Manager's cancel path
//   completion rate  completed / (completed + cancelled); null until something has closed
//   processing time  days from being raised to the first move to Completed, from the audit trail. Completions recorded
//                    before the audit trail had action types are not counted, rather than guessed.
//   overdue/due soon the deadline rules in deadlines.ts, applied to active requests
//   utilisation      units allocated today / capacity, per resource type and unit, over items that are available
// Filters (creation date in APP_TIMEZONE, assigned engineer, priority) apply to request metrics; utilisation is a
// snapshot of the inventory today and ignores them.

const ACTIVE = `('new_request','provisioning','testing')`;

export async function buildReport(m: EntityManager, me: User, f: ReportFilters, settings: DeadlineSettings) {
  const today = todayIn(settings.timeZone);
  const params: unknown[] = [me.organisation];
  const where = [`p.organisation = $1`];
  const param = (value: unknown) => `$${params.push(value)}`;
  const add = (sql: string, value: unknown) => where.push(sql.replace('?', param(value)));
  if (f.from || f.to) {
    // createdAt holds UTC; this is its calendar date in the company's time zone.
    const createdOn = `(p."createdAt" AT TIME ZONE 'UTC' AT TIME ZONE ${param(settings.timeZone)})::date`;
    if (f.from) add(`${createdOn} >= ?::date`, f.from);
    if (f.to) add(`${createdOn} <= ?::date`, f.to);
  }
  if (f.engineerId) add(`p."assignedEngineerId" = ?`, f.engineerId);
  if (f.priority) add(`p.priority = ?`, f.priority);

  const filtered = `WITH r AS (
    SELECT p.id, p.status, p.priority, p."assignedEngineerId", p."createdAt", p."startDate"::text AS "startDate", p."endDate"::text AS "endDate",
      EXISTS (SELECT 1 FROM activity a WHERE a."requestId" = p.id AND a.action = 'cancelled') AS cancelled,
      (SELECT min(a."createdAt") FROM activity a WHERE a."requestId" = p.id AND a.action = 'status_changed' AND a."toValue" = 'completed') AS "completedAt"
    FROM poc_requests p WHERE ${where.join(' AND ')}
  )`;
  const completedSql = `(r.status = 'completed' OR (r.status = 'decommissioned' AND NOT r.cancelled))`;

  const [[totals], statusRows, priorityRows, openRows, workload] = await Promise.all([
    m.query(`${filtered} SELECT
        count(*)::int AS total,
        count(*) FILTER (WHERE r.status IN ${ACTIVE})::int AS active,
        count(*) FILTER (WHERE ${completedSql})::int AS completed,
        count(*) FILTER (WHERE r.status = 'decommissioned' AND r.cancelled)::int AS cancelled,
        count(*) FILTER (WHERE r.status IN ${ACTIVE} AND r."assignedEngineerId" IS NULL)::int AS unassigned,
        round((avg(EXTRACT(EPOCH FROM (r."completedAt" - r."createdAt")) / 86400))::numeric, 1)::float AS "avgProcessingDays",
        count(r."completedAt")::int AS "timedCompletions"
      FROM r`, params),
    m.query(`${filtered} SELECT r.status AS key, count(*)::int AS n FROM r GROUP BY 1`, params),
    m.query(`${filtered} SELECT r.priority AS key, count(*)::int AS n FROM r GROUP BY 1`, params),
    m.query(`${filtered} SELECT r.status, r."startDate", r."endDate" FROM r WHERE r.status IN ${ACTIVE}`, params),
    m.query(`${filtered} SELECT u.id, u.name,
        count(r.id) FILTER (WHERE r.status IN ${ACTIVE})::int AS active,
        count(r.id) FILTER (WHERE ${completedSql})::int AS completed,
        count(r.id)::int AS total
      FROM users u LEFT JOIN r ON r."assignedEngineerId" = u.id
      WHERE u.organisation = $1 AND u.role = 'engineer' AND u.approved ${f.engineerId ? `AND u.id = $${params.indexOf(f.engineerId) + 1}` : ''}
      GROUP BY u.id, u.name ORDER BY u.name`, params),
  ]);
  const utilisation: { type: string; unit: string; capacity: number; inUse: number }[] = await m.query(`
    SELECT i.type, i.unit, sum(i.capacity)::int AS capacity, coalesce(sum(u.used), 0)::int AS "inUse"
    FROM inventory_resources i
    LEFT JOIN (SELECT "resourceId", sum(quantity) AS used FROM allocations
               WHERE status = 'active' AND "startDate" <= $2::date AND "endDate" >= $2::date GROUP BY 1) u ON u."resourceId" = i.id
    WHERE i.organisation = $1 AND i.state = 'available'
    GROUP BY i.type, i.unit ORDER BY i.type, i.unit`, [me.organisation, today]);

  const byKey = <T extends string>(keys: readonly T[], rows: { key: T; n: number }[]) =>
    Object.fromEntries(keys.map((k) => [k, rows.find((x) => x.key === k)?.n ?? 0])) as Record<T, number>;
  const deadlines = (openRows as { status: Status; startDate: string; endDate: string }[]).map((r) => deadline(r, today, settings.warnDays));
  const closed = totals.completed + totals.cancelled;

  return {
    filters: f, today, timeZone: settings.timeZone, warnDays: settings.warnDays,
    ...totals,
    completionRate: closed ? Math.round((totals.completed / closed) * 100) : null,
    overdue: deadlines.filter((d) => d.overdue).length,
    dueSoon: deadlines.filter((d) => d.dueSoon).length,
    lateStart: deadlines.filter((d) => d.lateStart).length,
    byStatus: byKey(STATUSES, statusRows),
    byPriority: byKey(PRIORITIES, priorityRows),
    workload,
    utilisation: utilisation.map((u) => ({ ...u, percent: u.capacity ? Math.round((u.inUse / u.capacity) * 100) : 0 })),
  };
}
