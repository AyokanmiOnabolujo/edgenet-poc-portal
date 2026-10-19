import { todayIn } from '../src/requests/deadlines';
import { assign, auth, ctx, move, newOrg, register, useApp } from './helpers';

useApp();

const today = todayIn('Africa/Lagos');
const shift = (days: number) => new Date(Date.parse(`${today}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);

async function org() {
  const name = newOrg();
  const am = await register('account_manager', name);
  const eng = await register('engineer', name);
  const raise = async (projectName: string, startDate: string, endDate: string) => {
    const res = await ctx.http.post('/api/requests').set(auth(am.token)).send({
      clientName: 'Ada Client', clientEmail: 'ada@client.example', clientCompany: 'Client Ltd', projectName,
      startDate, endDate, priority: 'medium', resources: [{ type: 'Virtual machine', quantity: 1 }],
    });
    expect(res.status).toBe(201);
    return res.body as { id: string; endDate: string; deadline: unknown };
  };
  return { am, eng, raise };
}

describe('deadline alerts', () => {
  it('lists overdue, due-soon and late-start requests, most urgent first, and leaves out the rest', async () => {
    const o = await org();
    const overdue = await o.raise('Overdue PoC', shift(-30), shift(-2));
    const soon = await o.raise('Due soon PoC', shift(-5), shift(3));
    const late = await o.raise('Late start PoC', shift(-1), shift(40));
    await o.raise('Comfortable PoC', shift(1), shift(40));
    const done = await o.raise('Finished PoC', shift(-30), shift(-10));
    await assign(o.am.token, done.id, o.eng.user.id);
    for (const s of ['provisioning', 'testing', 'completed']) await move(o.am.token, done.id, s);

    const res = await ctx.http.get('/api/requests/alerts').set(auth(o.am.token));
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ today, timeZone: 'Africa/Lagos', warnDays: 7, counts: { overdue: 1, dueSoon: 1, lateStart: 3 } }); // all three are still New Requests past their start date
    expect(res.body.items.map((i: { id: string }) => i.id)).toEqual([overdue.id, soon.id, late.id]);
    expect(res.body.items[0].deadline).toEqual({ daysLeft: -2, overdue: true, dueSoon: false, lateStart: true });
  });

  it('shows an engineer only the requests assigned to them', async () => {
    const o = await org();
    const mine = await o.raise('Mine', shift(-10), shift(-1));
    await o.raise('Not mine', shift(-10), shift(-1));
    await assign(o.am.token, mine.id, o.eng.user.id);
    const res = await ctx.http.get('/api/requests/alerts').set(auth(o.eng.token));
    expect(res.body.items.map((i: { id: string }) => i.id)).toEqual([mine.id]);
    expect((await ctx.http.get('/api/requests/alerts')).status).toBe(401);
  });

  it('adds the same deadline to list and detail responses, and keeps dates as plain calendar dates', async () => {
    const o = await org();
    const r = await o.raise('Dated PoC', shift(-3), shift(2));
    expect(r.endDate).toBe(shift(2));
    expect(r.deadline).toEqual({ daysLeft: 2, overdue: false, dueSoon: true, lateStart: true });
    const list = await ctx.http.get('/api/requests').set(auth(o.am.token));
    expect(list.body.find((x: { id: string }) => x.id === r.id).deadline).toEqual(r.deadline);
  });
});
