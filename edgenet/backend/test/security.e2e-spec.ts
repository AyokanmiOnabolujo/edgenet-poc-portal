import { JwtService } from '@nestjs/jwt';
import { auth, ctx, newOrg, register, scenario, useApp } from './helpers';

useApp();

const signUp = (body: Record<string, unknown>) => ctx.http.post('/api/auth/register').send({ password: 'password123', ...body });
const login = (email: string) => ctx.http.post('/api/auth/login').send({ email, password: 'password123' });
const pendingFor = async (token: string) => (await ctx.http.get('/api/users/pending').set(auth(token))).body as { id: string; email: string }[];

describe('engineer approval', () => {
  it('gives a new engineer no token and no sign-in until their Account Manager approves', async () => {
    const org = newOrg();
    const am = await register('account_manager', org);
    const email = `new.eng.${Date.now()}@example.test`;
    // Sending approved: true must not help: unknown fields are stripped.
    const res = await signUp({ name: 'New Engineer', email, role: 'engineer', organisation: org, approved: true });
    expect(res.status).toBe(201);
    expect(res.body).toEqual({ pending: true, message: expect.stringMatching(/waiting for approval/) });
    expect(res.body.token).toBeUndefined();

    const refused = await login(email);
    expect(refused.status).toBe(403);
    expect(refused.body.message).toMatch(/waiting for approval/);

    const [p] = await pendingFor(am.token);
    expect(p.email).toBe(email);
    expect((await ctx.http.patch(`/api/users/${p.id}/approve`).set(auth(am.token))).status).toBe(200);
    expect((await login(email)).status).toBe(201);
    expect(await pendingFor(am.token)).toEqual([]);
  });

  it('only lets the same organisation\'s Account Manager approve or reject', async () => {
    const s = await scenario();
    const email = `outsider.${Date.now()}@example.test`;
    await signUp({ name: 'Pending Person', email, role: 'engineer', organisation: s.org });
    const [p] = await pendingFor(s.am.token);
    const otherAm = await register('account_manager', newOrg());
    expect((await ctx.http.patch(`/api/users/${p.id}/approve`).set(auth(otherAm.token))).status).toBe(404);
    expect((await ctx.http.delete(`/api/users/pending/${p.id}`).set(auth(otherAm.token))).status).toBe(404);
    expect((await ctx.http.patch(`/api/users/${p.id}/approve`).set(auth(s.eng.token))).status).toBe(403);
    expect((await ctx.http.get('/api/users/pending').set(auth(s.eng.token))).status).toBe(403);
    // An approved engineer is not "pending", so it cannot be approved again or rejected.
    expect((await ctx.http.delete(`/api/users/pending/${s.eng.user.id}`).set(auth(s.am.token))).status).toBe(404);
  });

  it('keeps pending engineers out of assignment, engineer lists and the report', async () => {
    const s = await scenario();
    await signUp({ name: 'Not Yet', email: `notyet.${Date.now()}@example.test`, role: 'engineer', organisation: s.org });
    const [p] = await pendingFor(s.am.token);
    expect((await ctx.http.patch(`/api/requests/${s.id}/assign`).set(auth(s.am.token)).send({ engineerId: p.id })).status).toBe(400);
    const engineers = (await ctx.http.get('/api/users/engineers').set(auth(s.am.token))).body.map((e: { id: string }) => e.id);
    expect(engineers).not.toContain(p.id);
    const workload = (await ctx.http.get('/api/requests/report').set(auth(s.am.token))).body.workload.map((w: { id: string }) => w.id);
    expect(workload).not.toContain(p.id);
  });

  it('lets a rejected person register again with the same email', async () => {
    const s = await scenario();
    const email = `retry.${Date.now()}@example.test`;
    await signUp({ name: 'Typo Name', email, role: 'engineer', organisation: s.org });
    const [p] = await pendingFor(s.am.token);
    expect((await ctx.http.delete(`/api/users/pending/${p.id}`).set(auth(s.am.token))).status).toBe(200);
    expect((await login(email)).status).toBe(401);
    expect((await signUp({ name: 'Right Name', email, role: 'engineer', organisation: s.org })).status).toBe(201);
  });
});

describe('tokens', () => {
  it('rejects tokens signed with another key, malformed tokens and tokens for unknown users', async () => {
    const s = await scenario();
    const forged = new JwtService({ secret: 'dev-secret' }).sign({ sub: s.am.user.id });
    expect((await ctx.http.get('/api/auth/me').set(auth(forged))).status).toBe(401);
    expect((await ctx.http.get('/api/auth/me').set(auth('not-a-token'))).status).toBe(401);
    const ghost = new JwtService({ secret: process.env.JWT_SECRET }).sign({ sub: '00000000-0000-4000-8000-000000000000' });
    expect((await ctx.http.get('/api/auth/me').set(auth(ghost))).status).toBe(401);
  });

  it('never returns password hashes', async () => {
    const s = await scenario();
    const bodies = await Promise.all([
      ctx.http.get('/api/auth/me').set(auth(s.am.token)),
      ctx.http.get('/api/users/engineers').set(auth(s.am.token)),
      ctx.http.get(`/api/requests/${s.id}`).set(auth(s.am.token)),
      ctx.http.get('/api/requests').set(auth(s.eng.token)),
    ]);
    for (const b of bodies) expect(JSON.stringify(b.body)).not.toMatch(/passwordHash|\$2[aby]\$/);
  });
});

describe('input that tries to change protected fields', () => {
  it('ignores role, organisation and approval in a profile update', async () => {
    const s = await scenario();
    const res = await ctx.http.patch('/api/users/me').set(auth(s.eng.token))
      .send({ name: 'Renamed Engineer', email: `renamed.${Date.now()}@example.test`, role: 'account_manager', organisation: 'Someone Else', approved: true });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ name: 'Renamed Engineer', role: 'engineer', organisation: s.org });
    expect((await ctx.http.post('/api/resources').set(auth(s.eng.token)).send({ name: 'x', type: 'Other', capacity: 1 })).status).toBe(403);
  });
});

describe('simultaneous registrations', () => {
  it('answers a duplicate that slips past the checks with 409, not a server error', async () => {
    const org = newOrg();
    const email = `twin.${Date.now()}@example.test`;
    const [a, b] = await Promise.all([
      signUp({ name: 'First', email: `a.${email}`, role: 'account_manager', organisation: org }),
      signUp({ name: 'Second', email: `b.${email}`, role: 'account_manager', organisation: org }),
    ]);
    expect([a.status, b.status].sort()).toEqual([201, 409]);
    const [c, d] = await Promise.all([
      signUp({ name: 'Same', email, role: 'account_manager', organisation: newOrg() }),
      signUp({ name: 'Same', email, role: 'account_manager', organisation: newOrg() }),
    ]);
    expect([c.status, d.status].sort()).toEqual([201, 409]);
    expect([c.body.message, d.body.message].join()).toMatch(/already exists/);
  });
});
