import { assign, auth, ctx, move, register, scenario, useApp } from './helpers';

useApp();

type S = Awaited<ReturnType<typeof scenario>>;

async function addResource(s: S, body: Record<string, unknown>) {
  const res = await ctx.http.post('/api/resources').set(auth(s.am.token)).send(body);
  expect(res.status).toBe(201);
  return res.body.id as string;
}
const server = (s: S) => addResource(s, { name: 'Dell R750 #1', type: 'Physical server', unit: 'server', capacity: 1, specs: '32 cores, 256 GB RAM' });
const licences = (s: S, capacity = 3) => addResource(s, { name: 'Splunk eval licence', type: 'Software licence', unit: 'seat', capacity });

/** A second request in the same organisation, for competing bookings. */
async function otherRequest(s: S, startDate = '2026-11-01', endDate = '2026-11-30') {
  const res = await ctx.http.post('/api/requests').set(auth(s.am.token)).send({
    clientName: 'Bo Client', clientEmail: 'bo@client.example', clientCompany: 'Other Ltd', projectName: 'Rival PoC',
    startDate, endDate, priority: 'medium', resources: [{ type: 'Physical server', quantity: 1 }],
  });
  return res.body.id as string;
}
const allocate = (token: string, requestId: string, body: Record<string, unknown>) =>
  ctx.http.post(`/api/requests/${requestId}/allocations`).set(auth(token)).send(body);
const release = (token: string, requestId: string, allocationId: string) =>
  ctx.http.patch(`/api/requests/${requestId}/allocations/${allocationId}/release`).set(auth(token));
const available = async (s: S, id: string, start = '2026-11-15') =>
  ((await ctx.http.get(`/api/resources?start=${start}`).set(auth(s.am.token))).body as { id: string; available: number }[]).find((r) => r.id === id)!.available;

describe('inventory', () => {
  it('is managed by the Account Manager and visible to the organisation only', async () => {
    const s = await scenario();
    const id = await server(s);
    expect((await ctx.http.post('/api/resources').set(auth(s.eng.token)).send({ name: 'x', type: 'Other', capacity: 1 })).status).toBe(403);
    expect((await ctx.http.patch(`/api/resources/${id}`).set(auth(s.eng.token)).send({ state: 'retired' })).status).toBe(403);
    const list = await ctx.http.get('/api/resources').set(auth(s.eng.token));
    expect(list.body).toEqual([expect.objectContaining({ id, capacity: 1, inUse: 0, available: 1 })]);
    const outsider = await register('account_manager', `Org outsider ${Date.now()}`);
    expect((await ctx.http.get('/api/resources').set(auth(outsider.token))).body).toEqual([]);
    expect((await allocate(s.am.token, s.id, { resourceId: id, quantity: 1 })).status).toBe(201);
    expect((await ctx.http.patch(`/api/resources/${id}`).set(auth(outsider.token)).send({ state: 'retired' })).status).toBe(404);
  });

  it('rejects invalid capacity and dates', async () => {
    const s = await scenario();
    expect((await ctx.http.post('/api/resources').set(auth(s.am.token)).send({ name: 'x', type: 'Other', capacity: 0 })).status).toBe(400);
    expect((await ctx.http.get('/api/resources?start=2026-02-30').set(auth(s.am.token))).status).toBe(400);
    expect((await ctx.http.get('/api/resources?start=2026-11-10&end=2026-11-01').set(auth(s.am.token))).status).toBe(400);
  });

  it('will not lower capacity below what is already allocated', async () => {
    const s = await scenario();
    const id = await licences(s, 3);
    await allocate(s.am.token, s.id, { resourceId: id, quantity: 2 });
    expect((await ctx.http.patch(`/api/resources/${id}`).set(auth(s.am.token)).send({ capacity: 1 })).status).toBe(409);
    expect((await ctx.http.patch(`/api/resources/${id}`).set(auth(s.am.token)).send({ capacity: 2 })).status).toBe(200);
  });
});

describe('allocation', () => {
  it('lets the Account Manager or the assigned engineer allocate, using the request dates by default, and logs it', async () => {
    const s = await scenario();
    const id = await server(s);
    expect((await allocate(s.eng.token, s.id, { resourceId: id, quantity: 1 })).status).toBe(403); // not assigned yet
    await assign(s.am.token, s.id, s.eng.user.id);
    expect((await allocate(s.other.token, s.id, { resourceId: id, quantity: 1 })).status).toBe(403);
    const flags = async (token: string) => {
      const b = (await ctx.http.get(`/api/requests/${s.id}`).set(auth(token))).body;
      return [b.canAllocate, b.canRelease];
    };
    expect(await flags(s.eng.token)).toEqual([true, true]);
    expect(await flags(s.other.token)).toEqual([false, false]);
    const res = await allocate(s.eng.token, s.id, { resourceId: id, quantity: 1 });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ startDate: '2026-11-01', endDate: '2026-11-30', status: 'active', allocatedBy: { id: s.eng.user.id } });
    expect(await available(s, id)).toBe(0);
    const [latest] = (await ctx.http.get(`/api/requests/${s.id}`).set(auth(s.am.token))).body.activity;
    expect(latest).toMatchObject({ action: 'resource_allocated', toValue: res.body.id, actor: { id: s.eng.user.id } });
  });

  it('rejects an exclusive resource booked for overlapping dates, and explains the conflict', async () => {
    const s = await scenario();
    const id = await server(s);
    const rival = await otherRequest(s);
    await allocate(s.am.token, rival, { resourceId: id, quantity: 1, startDate: '2026-11-01', endDate: '2026-11-10' });
    const clash = await allocate(s.am.token, s.id, { resourceId: id, quantity: 1, startDate: '2026-11-10', endDate: '2026-11-20' });
    expect(clash.status).toBe(409);
    expect(clash.body).toMatchObject({ available: 0, conflicts: [{ projectName: 'Rival PoC', startDate: '2026-11-01', endDate: '2026-11-10', quantity: 1 }] });
    expect(clash.body.message).toMatch(/Only 0 of 1 server/);
    expect((await allocate(s.am.token, s.id, { resourceId: id, quantity: 1, startDate: '2026-11-11', endDate: '2026-11-20' })).status).toBe(201);
  });

  it('never over-allocates a pooled resource, counting the busiest day', async () => {
    const s = await scenario();
    const id = await licences(s, 2);
    const rival = await otherRequest(s);
    await allocate(s.am.token, rival, { resourceId: id, quantity: 1, startDate: '2026-11-01', endDate: '2026-11-10' });
    await allocate(s.am.token, rival, { resourceId: id, quantity: 1, startDate: '2026-11-20', endDate: '2026-11-30' });
    // Overlaps both bookings, but they never overlap each other, so at most 1 seat is in use on any day.
    expect((await allocate(s.am.token, s.id, { resourceId: id, quantity: 1, startDate: '2026-11-05', endDate: '2026-11-25' })).status).toBe(201);
    expect((await allocate(s.am.token, s.id, { resourceId: id, quantity: 1, startDate: '2026-11-05', endDate: '2026-11-25' })).status).toBe(409);
    expect((await allocate(s.am.token, s.id, { resourceId: id, quantity: 3 })).status).toBe(409);
  });

  it('refuses resources in maintenance, other organisations\' resources, bad dates and finished requests', async () => {
    const s = await scenario();
    const id = await server(s);
    await ctx.http.patch(`/api/resources/${id}`).set(auth(s.am.token)).send({ state: 'maintenance' });
    expect((await allocate(s.am.token, s.id, { resourceId: id, quantity: 1 })).status).toBe(409);
    const elsewhere = await scenario();
    const theirs = await server(elsewhere);
    expect((await allocate(s.am.token, s.id, { resourceId: theirs, quantity: 1 })).status).toBe(400);
    const ok = await server(s);
    expect((await allocate(s.am.token, s.id, { resourceId: ok, quantity: 1, startDate: '2026-11-20', endDate: '2026-11-10' })).status).toBe(400);
    await assign(s.am.token, s.id, s.eng.user.id);
    for (const status of ['provisioning', 'testing', 'completed']) await move(s.am.token, s.id, status);
    expect((await allocate(s.am.token, s.id, { resourceId: ok, quantity: 1 })).status).toBe(409);
  });

  it('lets only one of many simultaneous requests take the last unit', async () => {
    const s = await scenario();
    const id = await server(s);
    const results = await Promise.all(Array.from({ length: 40 }, () => allocate(s.am.token, s.id, { resourceId: id, quantity: 1 })));
    expect(results.filter((r) => r.status === 201)).toHaveLength(1);
    expect(results.filter((r) => r.status === 409)).toHaveLength(39);
    const active = (await ctx.http.get(`/api/requests/${s.id}/allocations`).set(auth(s.am.token))).body.filter((a: { status: string }) => a.status === 'active');
    expect(active).toHaveLength(1);
  });
});

describe('release', () => {
  it('frees the capacity once, records who released it, and cannot be repeated', async () => {
    const s = await scenario();
    const id = await server(s);
    const a = (await allocate(s.am.token, s.id, { resourceId: id, quantity: 1 })).body;
    const rival = await otherRequest(s);
    expect((await allocate(s.am.token, rival, { resourceId: id, quantity: 1 })).status).toBe(409);

    const res = await release(s.am.token, s.id, a.id);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'released', releasedBy: { id: s.am.user.id } });
    expect(res.body.releasedAt).toBeTruthy();
    expect(await available(s, id)).toBe(1);
    const again = await Promise.all([release(s.am.token, s.id, a.id), release(s.am.token, s.id, a.id)]);
    expect(again.map((r) => r.status)).toEqual([409, 409]);
    expect((await allocate(s.am.token, rival, { resourceId: id, quantity: 1 })).status).toBe(201);

    const log = (await ctx.http.get(`/api/requests/${s.id}`).set(auth(s.am.token))).body.activity;
    expect(log.filter((e: { action: string }) => e.action === 'resource_released')).toHaveLength(1);
  });

  it('is limited to the Account Manager and the assigned engineer, on that request', async () => {
    const s = await scenario();
    const id = await server(s);
    const a = (await allocate(s.am.token, s.id, { resourceId: id, quantity: 1 })).body;
    expect((await release(s.other.token, s.id, a.id)).status).toBe(403);
    const rival = await otherRequest(s);
    expect((await release(s.am.token, rival, a.id)).status).toBe(404);
  });
});
