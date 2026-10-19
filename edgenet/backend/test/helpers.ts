import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { setup } from '../src/setup';

// Shared setup for the e2e tests. They run the real API against the local test database (see test/env.ts).
// Every test uses its own organisation, so tests never interfere with each other and nothing is deleted.
export const ctx = { http: null as unknown as ReturnType<typeof request> };
let app: INestApplication;
let n = 0;

export function useApp() {
  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = setup(mod.createNestApplication());
    await app.init();
    ctx.http = request(app.getHttpServer());
  });
  afterAll(() => app.close());
}

export const newOrg = () => `Org ${Date.now()}-${++n}`;
export const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

export async function register(role: 'account_manager' | 'engineer', organisation: string) {
  const res = await ctx.http.post('/api/auth/register').send({
    name: `${role} ${++n}`, email: `${role}${n}.${Date.now()}@example.test`, password: 'password123', role, organisation,
  });
  expect(res.status).toBe(201);
  return res.body as { token: string; user: { id: string } };
}

/** A fresh organisation with an Account Manager, two engineers and one new request for 1-30 Nov 2026. */
export async function scenario() {
  const org = newOrg();
  const am = await register('account_manager', org);
  const eng = await register('engineer', org);
  const other = await register('engineer', org);
  const created = await ctx.http.post('/api/requests').set(auth(am.token)).send({
    clientName: 'Ada Client', clientEmail: 'ada@client.example', clientCompany: 'Client Ltd', projectName: 'Edge cache PoC',
    startDate: '2026-11-01', endDate: '2026-11-30', priority: 'high', resources: [{ type: 'Virtual machine', quantity: 2 }],
  });
  expect(created.status).toBe(201);
  return { org, am, eng, other, id: created.body.id as string };
}

export const move = (token: string, id: string, status: string, remarks?: string) =>
  ctx.http.patch(`/api/requests/${id}/status`).set(auth(token)).send({ status, remarks });
export const assign = (token: string, id: string, engineerId: string) =>
  ctx.http.patch(`/api/requests/${id}/assign`).set(auth(token)).send({ engineerId });

/** Ticks a decommissioning checklist task (or unticks it with done = false). */
export const tick = (token: string, id: string, key: string, done = true, notes?: string) =>
  ctx.http.patch(`/api/requests/${id}/checklist/${key}`).set(auth(token)).send({ done, notes });
export const REQUIRED_TASKS = ['client_notified', 'access_revoked', 'data_handled'];
/** Completes every hand-ticked required task so the request can be decommissioned. */
export async function closeOut(token: string, id: string) {
  for (const key of REQUIRED_TASKS) expect((await tick(token, id, key)).status).toBe(200);
}
