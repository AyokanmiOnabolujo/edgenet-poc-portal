import { assign, auth, closeOut, ctx, move, REQUIRED_TASKS, scenario, tick, useApp } from './helpers';

useApp();

type S = Awaited<ReturnType<typeof scenario>>;
type Item = { key: string; mandatory: boolean; auto: boolean; done: boolean; completedBy: { id: string } | null; notes: string | null };
const view = async (token: string, id: string) => (await ctx.http.get(`/api/requests/${id}`).set(auth(token))).body;
const actions = async (s: S) => ((await view(s.am.token, s.id)).activity as { action: string }[]).map((a) => a.action);

/** Assigned to the engineer and moved to Completed. */
async function completed() {
  const s = await scenario();
  await assign(s.am.token, s.id, s.eng.user.id);
  for (const status of ['provisioning', 'testing', 'completed']) expect((await move(s.eng.token, s.id, status)).status).toBe(200);
  return s;
}
async function allocateServer(s: S) {
  const res = await ctx.http.post('/api/resources').set(auth(s.am.token)).send({ name: 'Dell R750', type: 'Physical server', unit: 'server', capacity: 1 });
  const a = await ctx.http.post(`/api/requests/${s.id}/allocations`).set(auth(s.am.token)).send({ resourceId: res.body.id, quantity: 1 });
  expect(a.status).toBe(201);
  return a.body.id as string;
}

describe('decommissioning checklist', () => {
  it('comes with every request, required tasks first-class, the resources task derived from allocations', async () => {
    const s = await scenario();
    const items: Item[] = (await view(s.am.token, s.id)).checklist;
    expect(items.filter((i) => i.mandatory).map((i) => i.key)).toEqual(['client_notified', 'resources_released', ...REQUIRED_TASKS.slice(1)]);
    expect(items.find((i) => i.key === 'resources_released')).toMatchObject({ auto: true, done: true });
    await allocateServer(s);
    expect((await view(s.am.token, s.id)).checklist.find((i: Item) => i.key === 'resources_released').done).toBe(false);
    expect((await tick(s.am.token, s.id, 'resources_released')).status).toBe(400);
    expect((await tick(s.am.token, s.id, 'no_such_task')).status).toBe(404);
  });

  it('blocks Decommissioned until required tasks are ticked and resources released', async () => {
    const s = await completed();
    const res = await move(s.eng.token, s.id, 'decommissioned');
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/3 required checklist tasks still open/);
    expect((await view(s.eng.token, s.id)).nextStatuses[0].blocked).toMatch(/Finish the decommissioning checklist/);
    await tick(s.eng.token, s.id, 'client_notified');
    await tick(s.eng.token, s.id, 'access_revoked');
    expect((await move(s.eng.token, s.id, 'decommissioned')).body.message).toMatch(/1 required checklist task still open/);
    await tick(s.eng.token, s.id, 'data_handled');
    const ok = await move(s.eng.token, s.id, 'decommissioned');
    expect(ok.status).toBe(200);
    expect(ok.body.canEditChecklist).toBe(false);
  });

  it('refuses to close while a resource is still allocated', async () => {
    const s = await scenario();
    await assign(s.am.token, s.id, s.eng.user.id);
    const allocationId = await allocateServer(s);
    for (const status of ['provisioning', 'testing', 'completed']) await move(s.am.token, s.id, status);
    await closeOut(s.am.token, s.id);
    const res = await move(s.am.token, s.id, 'decommissioned');
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/1 resource allocation not yet released/);
    await ctx.http.patch(`/api/requests/${s.id}/allocations/${allocationId}/release`).set(auth(s.am.token));
    expect((await move(s.am.token, s.id, 'decommissioned')).status).toBe(200);
  });

  it('records who ticked what, ignores repeats, logs unticks, and freezes once decommissioned', async () => {
    const s = await completed();
    expect((await tick(s.other.token, s.id, 'client_notified')).status).toBe(403);
    await Promise.all([tick(s.eng.token, s.id, 'client_notified', true, 'Results deck sent'), tick(s.eng.token, s.id, 'client_notified')]);
    const item = (await view(s.am.token, s.id)).checklist.find((i: Item) => i.key === 'client_notified');
    expect(item).toMatchObject({ done: true, completedBy: { id: s.eng.user.id } });
    expect((await actions(s)).filter((a) => a === 'check_completed')).toHaveLength(1);

    await tick(s.am.token, s.id, 'client_notified', false);
    await tick(s.am.token, s.id, 'client_notified', false);
    expect((await actions(s)).filter((a) => a === 'check_reopened')).toHaveLength(1);

    await closeOut(s.am.token, s.id);
    await move(s.am.token, s.id, 'decommissioned');
    expect((await tick(s.am.token, s.id, 'closure_report')).status).toBe(409);
  });
});

describe('cancelling an unfinished PoC', () => {
  it('is for the Account Manager only, needs a reason, goes through the checklist and is recorded as a cancellation', async () => {
    const s = await scenario();
    await assign(s.am.token, s.id, s.eng.user.id);
    await move(s.eng.token, s.id, 'provisioning');
    expect((await view(s.eng.token, s.id)).nextStatuses.map((t: { to: string }) => t.to)).toEqual(['testing']);
    expect((await view(s.am.token, s.id)).nextStatuses).toContainEqual(expect.objectContaining({ to: 'decommissioned', cancel: true, needsReason: true }));

    expect((await move(s.eng.token, s.id, 'decommissioned', 'Client withdrew')).status).toBe(403);
    expect((await move(s.am.token, s.id, 'decommissioned')).status).toBe(400);
    expect((await move(s.am.token, s.id, 'decommissioned', 'Client withdrew')).body.message).toMatch(/checklist/);

    await closeOut(s.am.token, s.id);
    const res = await move(s.am.token, s.id, 'decommissioned', 'Client withdrew');
    expect(res.status).toBe(200);
    expect(res.body.activity[0]).toMatchObject({ action: 'cancelled', fromValue: 'provisioning', toValue: 'decommissioned', remarks: 'Client withdrew' });
  });

  it('stops new allocations once the PoC is cancelled', async () => {
    const s = await scenario();
    await closeOut(s.am.token, s.id);
    await move(s.am.token, s.id, 'decommissioned', 'Budget cut');
    const res = await ctx.http.post('/api/resources').set(auth(s.am.token)).send({ name: 'Licence', type: 'Software licence', capacity: 5 });
    expect((await ctx.http.post(`/api/requests/${s.id}/allocations`).set(auth(s.am.token)).send({ resourceId: res.body.id, quantity: 1 })).status).toBe(409);
  });
});

describe('closing while someone allocates', () => {
  it('never leaves a decommissioned request holding an active allocation', async () => {
    const s = await scenario();
    await assign(s.am.token, s.id, s.eng.user.id);
    await closeOut(s.am.token, s.id);
    const res = await ctx.http.post('/api/resources').set(auth(s.am.token)).send({ name: 'Licence pool', type: 'Software licence', unit: 'seat', capacity: 50 });
    const allocate = () => ctx.http.post(`/api/requests/${s.id}/allocations`).set(auth(s.eng.token)).send({ resourceId: res.body.id, quantity: 1 });
    // Few enough allocations that the decommission request still gets a database connection while they run.
    await Promise.all([...Array.from({ length: 4 }, allocate), move(s.am.token, s.id, 'decommissioned', 'Client withdrew'), ...Array.from({ length: 3 }, allocate)]);
    const after = await view(s.am.token, s.id);
    const active = (await ctx.http.get(`/api/requests/${s.id}/allocations`).set(auth(s.am.token))).body.filter((a: { status: string }) => a.status === 'active');
    expect(after.status === 'decommissioned' && active.length > 0).toBe(false);
  });
});
