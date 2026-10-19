import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { setup } from '../src/setup';

// Runs the real API against the local test database (see test/env.ts). Every test uses its own organisation,
// so tests never interfere with each other and nothing is deleted.
let app: INestApplication;
let http: ReturnType<typeof request>;
let n = 0;

beforeAll(async () => {
  const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = setup(mod.createNestApplication());
  await app.init();
  http = request(app.getHttpServer());
});
afterAll(() => app.close());

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

async function register(role: 'account_manager' | 'engineer', organisation: string) {
  const res = await http.post('/api/auth/register').send({
    name: `${role} ${++n}`, email: `${role}${n}.${Date.now()}@example.test`, password: 'password123', role, organisation,
  });
  expect(res.status).toBe(201);
  return res.body as { token: string; user: { id: string } };
}

/** A fresh organisation with an Account Manager, two engineers and one new request. */
async function scenario() {
  const org = `Org ${Date.now()}-${++n}`;
  const am = await register('account_manager', org);
  const eng = await register('engineer', org);
  const other = await register('engineer', org);
  const created = await http.post('/api/requests').set(auth(am.token)).send({
    clientName: 'Ada Client', clientEmail: 'ada@client.example', clientCompany: 'Client Ltd', projectName: 'Edge cache PoC',
    startDate: '2026-11-01', endDate: '2026-11-30', priority: 'high', resources: [{ type: 'Virtual machine', quantity: 2 }],
  });
  expect(created.status).toBe(201);
  return { org, am, eng, other, id: created.body.id as string };
}

const move = (token: string, id: string, status: string, remarks?: string) =>
  http.patch(`/api/requests/${id}/status`).set(auth(token)).send({ status, remarks });
const assign = (token: string, id: string, engineerId: string) =>
  http.patch(`/api/requests/${id}/assign`).set(auth(token)).send({ engineerId });
const activity = async (token: string, id: string) =>
  ((await http.get(`/api/requests/${id}`).set(auth(token))).body.activity as { message: string }[]).map((a) => a.message);

describe('existing behaviour (regression)', () => {
  it('registers, logs in and returns the current user', async () => {
    const org = `Org ${Date.now()}-${++n}`;
    const am = await register('account_manager', org);
    const email = (await http.get('/api/auth/me').set(auth(am.token))).body.email;
    const login = await http.post('/api/auth/login').send({ email, password: 'password123' });
    expect(login.status).toBe(201);
    expect(login.body.token).toBeTruthy();
    expect((await http.post('/api/auth/login').send({ email, password: 'wrong-password' })).status).toBe(401);
  });

  it('allows one Account Manager per organisation', async () => {
    const org = `Org ${Date.now()}-${++n}`;
    await register('account_manager', org);
    const res = await http.post('/api/auth/register').send({ name: 'Second', email: `dup${Date.now()}@example.test`, password: 'password123', role: 'account_manager', organisation: org });
    expect(res.status).toBe(409);
  });

  it('creates, lists and shows requests; engineers cannot create; other organisations cannot see them', async () => {
    const s = await scenario();
    const list = await http.get('/api/requests').set(auth(s.eng.token));
    expect(list.body.map((r: { id: string }) => r.id)).toContain(s.id);
    expect((await http.post('/api/requests').set(auth(s.eng.token)).send({})).status).toBe(403);
    const outsider = await register('account_manager', `Org ${Date.now()}-${++n}`);
    expect((await http.get(`/api/requests/${s.id}`).set(auth(outsider.token))).status).toBe(404);
    expect((await http.get('/api/requests')).status).toBe(401);
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
    const asOther = await http.get(`/api/requests/${s.id}`).set(auth(s.other.token));
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
    expect((await activity(s.am.token, s.id))[0]).toMatch(/Reason: Load balancer misconfigured/);
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
