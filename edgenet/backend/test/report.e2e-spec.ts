import { todayIn } from '../src/requests/deadlines';
import { assign, auth, closeOut, ctx, move, newOrg, register, useApp } from './helpers';

useApp();

const today = todayIn('Africa/Lagos');
const shift = (days: number) => new Date(Date.parse(`${today}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);

/**
 * A fresh organisation with a known set of requests:
 *   A high,     assigned to eng1, Completed
 *   B high,     assigned to eng1, cancelled from Testing
 *   C medium,   assigned to eng2, In Testing, ended 2 days ago (overdue)
 *   D low,      unassigned, New Request, ends in 3 days, started yesterday (due soon, late start)
 *   E critical, unassigned, New Request, starts next month
 * plus a 4-seat licence pool with 3 seats allocated to C today, and a server in maintenance.
 */
async function dataset() {
  const org = newOrg();
  const am = await register('account_manager', org);
  const eng1 = await register('engineer', org);
  const eng2 = await register('engineer', org);
  const raise = async (projectName: string, priority: string, startDate: string, endDate: string) => {
    const res = await ctx.http.post('/api/requests').set(auth(am.token)).send({
      clientName: 'Ada Client', clientEmail: 'ada@client.example', clientCompany: 'Client Ltd', projectName,
      startDate, endDate, priority, resources: [{ type: 'Virtual machine', quantity: 1 }],
    });
    expect(res.status).toBe(201);
    return res.body.id as string;
  };
  const a = await raise('A', 'high', shift(-20), shift(20));
  const b = await raise('B', 'high', shift(-20), shift(20));
  const c = await raise('C', 'medium', shift(-20), shift(-2));
  await raise('D', 'low', shift(-1), shift(3));
  await raise('E', 'critical', shift(30), shift(60));

  await assign(am.token, a, eng1.user.id);
  for (const s of ['provisioning', 'testing', 'completed']) expect((await move(eng1.token, a, s)).status).toBe(200);
  await assign(am.token, b, eng1.user.id);
  for (const s of ['provisioning', 'testing']) await move(eng1.token, b, s);
  await closeOut(am.token, b);
  expect((await move(am.token, b, 'decommissioned', 'Client withdrew')).status).toBe(200);
  await assign(am.token, c, eng2.user.id);
  for (const s of ['provisioning', 'testing']) await move(eng2.token, c, s);

  const pool = await ctx.http.post('/api/resources').set(auth(am.token)).send({ name: 'Licence pool', type: 'Software licence', unit: 'seat', capacity: 4 });
  // C's own window has ended, so book today explicitly.
  expect((await ctx.http.post(`/api/requests/${c}/allocations`).set(auth(am.token)).send({ resourceId: pool.body.id, quantity: 3, startDate: today, endDate: shift(5) })).status).toBe(201);
  const server = await ctx.http.post('/api/resources').set(auth(am.token)).send({ name: 'Old server', type: 'Physical server', unit: 'server', capacity: 1 });
  await ctx.http.patch(`/api/resources/${server.body.id}`).set(auth(am.token)).send({ state: 'maintenance' });
  return { am, eng1, eng2 };
}

const report = (token: string, query = '') => ctx.http.get(`/api/requests/report${query}`).set(auth(token));

describe('analytics report', () => {
  it('matches the underlying records', async () => {
    const d = await dataset();
    const res = await report(d.am.token);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      total: 5, active: 3, completed: 1, cancelled: 1, unassigned: 2, completionRate: 50,
      overdue: 1, dueSoon: 1, lateStart: 1, timedCompletions: 1,
      byStatus: { new_request: 2, provisioning: 0, testing: 1, completed: 1, decommissioned: 1 },
      byPriority: { low: 1, medium: 1, high: 2, critical: 1 },
      utilisation: [{ type: 'Software licence', unit: 'seat', capacity: 4, inUse: 3, percent: 75 }],
    });
    expect(res.body.avgProcessingDays).toBeGreaterThanOrEqual(0);
    expect(res.body.avgProcessingDays).toBeLessThan(1);
    expect(res.body.workload.map((w: { id: string; active: number; completed: number; total: number }) => [w.id, w.active, w.completed, w.total]))
      .toEqual(expect.arrayContaining([[d.eng1.user.id, 0, 1, 2], [d.eng2.user.id, 1, 0, 1]]));
  });

  it('agrees with the alerts endpoint on overdue and due-soon counts', async () => {
    const d = await dataset();
    const [r, a] = await Promise.all([report(d.am.token), ctx.http.get('/api/requests/alerts').set(auth(d.am.token))]);
    expect([r.body.overdue, r.body.dueSoon, r.body.lateStart]).toEqual([a.body.counts.overdue, a.body.counts.dueSoon, a.body.counts.lateStart]);
  });

  it('filters by priority, engineer and creation date', async () => {
    const d = await dataset();
    expect((await report(d.am.token, '?priority=high')).body).toMatchObject({ total: 2, completed: 1, cancelled: 1, completionRate: 50 });
    const mine = (await report(d.am.token, `?engineerId=${d.eng2.user.id}`)).body;
    expect(mine).toMatchObject({ total: 1, active: 1, overdue: 1 });
    expect(mine.workload).toHaveLength(1);
    expect((await report(d.am.token, `?from=${today}&to=${today}`)).body.total).toBe(5);
    expect((await report(d.am.token, `?from=${shift(-10)}&to=${shift(-1)}`)).body.total).toBe(0);
  });

  it('handles an empty result without dividing by zero', async () => {
    const d = await dataset();
    const empty = (await report(d.am.token, `?from=${shift(1)}`)).body;
    expect(empty).toMatchObject({ total: 0, active: 0, completionRate: null, avgProcessingDays: null, timedCompletions: 0, overdue: 0 });
    const fresh = await register('account_manager', newOrg());
    expect((await report(fresh.token)).body).toMatchObject({ total: 0, completionRate: null, workload: [], utilisation: [] });
  });

  it('is for the Account Manager only and rejects bad filters', async () => {
    const d = await dataset();
    expect((await report(d.eng1.token)).status).toBe(403);
    expect((await report(d.am.token, '?priority=urgent')).status).toBe(400);
    expect((await report(d.am.token, '?from=2026-02-30')).status).toBe(400);
    expect((await report(d.am.token, '?engineerId=not-a-uuid')).status).toBe(400);
  });
});
