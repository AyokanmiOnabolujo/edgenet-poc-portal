import { assign, auth, ctx, move, newOrg, register, scenario, useApp } from './helpers';

useApp();

type Entry = { message: string; action: string | null; fromValue: string | null; toValue: string | null; remarks: string | null; createdAt: string; actor: { id: string } };
/** The request's latest audit entries, newest first, as returned with the request. */
const entries = async (token: string, id: string) => (await ctx.http.get(`/api/requests/${id}`).set(auth(token))).body.activity as Entry[];
const activity = async (token: string, id: string) => (await entries(token, id)).map((a) => a.message);

describe('existing behaviour (regression)', () => {
  it('registers, logs in and returns the current user', async () => {
    const org = newOrg();
    const am = await register('account_manager', org);
    const email = (await ctx.http.get('/api/auth/me').set(auth(am.token))).body.email;
    const login = await ctx.http.post('/api/auth/login').send({ email, password: 'password123' });
    expect(login.status).toBe(201);
    expect(login.body.token).toBeTruthy();
    expect((await ctx.http.post('/api/auth/login').send({ email, password: 'wrong-password' })).status).toBe(401);
  });

  it('allows one Account Manager per organisation', async () => {
    const org = newOrg();
    await register('account_manager', org);
    const res = await ctx.http.post('/api/auth/register').send({ name: 'Second', email: `dup${Date.now()}@example.test`, password: 'password123', role: 'account_manager', organisation: org });
    expect(res.status).toBe(409);
  });

  it('creates, lists and shows requests; engineers cannot create; other organisations cannot see them', async () => {
    const s = await scenario();
    const list = await ctx.http.get('/api/requests').set(auth(s.eng.token));
    expect(list.body.map((r: { id: string }) => r.id)).toContain(s.id);
    expect((await ctx.http.post('/api/requests').set(auth(s.eng.token)).send({})).status).toBe(403);
    const outsider = await register('account_manager', newOrg());
    expect((await ctx.http.get(`/api/requests/${s.id}`).set(auth(outsider.token))).status).toBe(404);
    expect((await ctx.http.get('/api/requests')).status).toBe(401);
  });
});

describe('controlled workflow', () => {
  it('walks the full lifecycle and logs each move', async () => {
    const s = await scenario();
    expect((await move(s.am.token, s.id, 'provisioning')).status).toBe(400); // no engineer yet
    expect((await assign(s.am.token, s.id, s.eng.user.id)).status).toBe(200);
    for (const status of ['provisioning', 'testing', 'completed', 'decommissioned']) {
      const res = await move(s.eng.token, s.id, status);
      expect(res.status).toBe(200);
      expect(res.body.status).toBe(status);
    }
    expect((await activity(s.am.token, s.id)).filter((m) => m.includes('moved this request'))).toHaveLength(4);
  });

  it('rejects invalid transitions without logging them', async () => {
    const s = await scenario();
    await assign(s.am.token, s.id, s.eng.user.id);
    const before = await activity(s.am.token, s.id);
    const res = await move(s.am.token, s.id, 'testing'); // skips provisioning
    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/cannot move to In Testing/);
    expect((await move(s.am.token, s.id, 'not_a_status')).status).toBe(400);
    expect(await activity(s.am.token, s.id)).toEqual(before);
  });

  it('only lets the assigned engineer (or the Account Manager) move a request', async () => {
    const s = await scenario();
    await assign(s.am.token, s.id, s.eng.user.id);
    expect((await move(s.other.token, s.id, 'provisioning')).status).toBe(403);
    const asOther = await ctx.http.get(`/api/requests/${s.id}`).set(auth(s.other.token));
    expect(asOther.body.nextStatuses).toEqual([]);
    expect((await move(s.eng.token, s.id, 'provisioning')).status).toBe(200);
  });

  it('requires a reason to send a request back from testing, and records it', async () => {
    const s = await scenario();
    await assign(s.am.token, s.id, s.eng.user.id);
    await move(s.eng.token, s.id, 'provisioning');
    await move(s.eng.token, s.id, 'testing');
    expect((await move(s.eng.token, s.id, 'provisioning')).status).toBe(400);
    expect((await move(s.eng.token, s.id, 'provisioning', 'Load balancer misconfigured')).status).toBe(200);
    expect((await entries(s.am.token, s.id))[0]).toMatchObject({ action: 'status_changed', fromValue: 'testing', toValue: 'provisioning', remarks: 'Load balancer misconfigured' });
  });

  it('applies only one of several simultaneous moves', async () => {
    const s = await scenario();
    await assign(s.am.token, s.id, s.eng.user.id);
    const results = await Promise.all(Array.from({ length: 20 }, () => move(s.am.token, s.id, 'provisioning')));
    expect(results.every((r) => r.status === 200 || r.status === 409)).toBe(true);
    expect((await activity(s.am.token, s.id)).filter((m) => m.includes('to Infrastructure Provisioning'))).toHaveLength(1);
  });

  it('treats Decommissioned as final', async () => {
    const s = await scenario();
    await assign(s.am.token, s.id, s.eng.user.id);
    for (const status of ['provisioning', 'testing', 'completed', 'decommissioned']) await move(s.am.token, s.id, status);
    expect((await move(s.am.token, s.id, 'new_request')).status).toBe(409);
  });
});

describe('audit trail', () => {
  it('records creation, assignment and moves with actor, values and server time, oldest first in time', async () => {
    const s = await scenario();
    const before = Date.now();
    await assign(s.am.token, s.id, s.eng.user.id);
    await assign(s.am.token, s.id, s.other.user.id);
    await assign(s.am.token, s.id, s.other.user.id); // no change: not logged
    await move(s.other.token, s.id, 'provisioning');
    const log = (await entries(s.am.token, s.id)).reverse();
    expect(log.map((e) => [e.action, e.fromValue, e.toValue])).toEqual([
      ['created', null, 'new_request'],
      ['assigned', null, s.eng.user.id],
      ['reassigned', s.eng.user.id, s.other.user.id],
      ['status_changed', 'new_request', 'provisioning'],
    ]);
    expect(log.map((e) => e.actor.id)).toEqual([s.am.user.id, s.am.user.id, s.am.user.id, s.other.user.id]);
    const times = log.map((e) => new Date(e.createdAt).getTime());
    expect([...times].sort((a, b) => a - b)).toEqual(times);
    expect(times[3]).toBeGreaterThanOrEqual(before - 60_000);
  });

  it('logs creation and initial assignment as separate, ordered entries', async () => {
    const org = newOrg();
    const am = await register('account_manager', org);
    const eng = await register('engineer', org);
    const res = await ctx.http.post('/api/requests').set(auth(am.token)).send({
      clientName: 'Ada Client', clientEmail: 'ada@client.example', clientCompany: 'Client Ltd', projectName: 'Assigned at creation',
      startDate: '2026-11-01', endDate: '2026-11-30', priority: 'low', resources: [{ type: 'Database', quantity: 1 }], assignedEngineerId: eng.user.id,
    });
    expect(res.body.activity.map((e: Entry) => e.action)).toEqual(['assigned', 'created']);
  });

  it('ignores actor and timestamp values sent by the browser', async () => {
    const s = await scenario();
    await assign(s.am.token, s.id, s.eng.user.id);
    await ctx.http.patch(`/api/requests/${s.id}/status`).set(auth(s.eng.token))
      .send({ status: 'provisioning', actor: { id: s.am.user.id }, createdAt: '2000-01-01T00:00:00Z', action: 'created' });
    const [latest] = await entries(s.am.token, s.id);
    expect(latest).toMatchObject({ action: 'status_changed', actor: { id: s.eng.user.id } });
    expect(new Date(latest.createdAt).getFullYear()).toBeGreaterThan(2000);
  });

  it('pages through history and hides it from other organisations', async () => {
    const s = await scenario();
    await assign(s.am.token, s.id, s.eng.user.id);
    await assign(s.am.token, s.id, s.other.user.id);
    const page1 = await ctx.http.get(`/api/requests/${s.id}/activity?page=1&limit=2`).set(auth(s.eng.token));
    const page2 = await ctx.http.get(`/api/requests/${s.id}/activity?page=2&limit=2`).set(auth(s.eng.token));
    expect(page1.body).toMatchObject({ total: 3, page: 1, limit: 2 });
    expect(page1.body.items.map((e: Entry) => e.action)).toEqual(['reassigned', 'assigned']);
    expect(page2.body.items.map((e: Entry) => e.action)).toEqual(['created']);
    expect((await ctx.http.get(`/api/requests/${s.id}/activity?limit=500`).set(auth(s.am.token))).status).toBe(400);
    const outsider = await register('account_manager', newOrg());
    expect((await ctx.http.get(`/api/requests/${s.id}/activity`).set(auth(outsider.token))).status).toBe(404);
  });

  it('has no API to edit or delete history', async () => {
    const s = await scenario();
    const [entry] = await entries(s.am.token, s.id);
    for (const path of [`/api/requests/${s.id}/activity`, `/api/requests/${s.id}/activity/${(entry as unknown as { id: string }).id}`]) {
      expect((await ctx.http.delete(path).set(auth(s.am.token))).status).toBe(404);
      expect((await ctx.http.patch(path).set(auth(s.am.token)).send({ message: 'edited' })).status).toBe(404);
    }
  });
});
