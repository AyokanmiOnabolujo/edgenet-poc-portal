import { Status } from '../src/entities';
import { deadline, deadlineSettings, todayIn } from '../src/requests/deadlines';

const TODAY = '2026-11-15';
const r = (status: Status, startDate: string, endDate: string) => ({ status, startDate, endDate });

describe('todayIn', () => {
  it('uses the calendar date in the company time zone, not UTC', () => {
    const lateEveningUtc = new Date('2026-10-19T23:30:00Z'); // 00:30 on the 20th in Lagos
    expect(todayIn('UTC', lateEveningUtc)).toBe('2026-10-19');
    expect(todayIn('Africa/Lagos', lateEveningUtc)).toBe('2026-10-20');
    expect(todayIn('America/New_York', lateEveningUtc)).toBe('2026-10-19');
  });
});

describe('deadline', () => {
  it('flags overdue only after the end date has passed', () => {
    expect(deadline(r('testing', '2026-11-01', '2026-11-14'), TODAY, 7)).toMatchObject({ overdue: true, dueSoon: false, daysLeft: -1 });
    expect(deadline(r('testing', '2026-11-01', '2026-11-15'), TODAY, 7)).toMatchObject({ overdue: false, dueSoon: true, daysLeft: 0 });
  });

  it('flags due soon within the warning window, inclusive', () => {
    expect(deadline(r('provisioning', '2026-11-01', '2026-11-22'), TODAY, 7).dueSoon).toBe(true);
    expect(deadline(r('provisioning', '2026-11-01', '2026-11-23'), TODAY, 7).dueSoon).toBe(false);
    expect(deadline(r('provisioning', '2026-11-01', '2026-11-16'), TODAY, 0).dueSoon).toBe(false);
  });

  it('flags a late start only while the request is still new', () => {
    expect(deadline(r('new_request', '2026-11-14', '2026-12-31'), TODAY, 7).lateStart).toBe(true);
    expect(deadline(r('new_request', '2026-11-15', '2026-12-31'), TODAY, 7).lateStart).toBe(false);
    expect(deadline(r('provisioning', '2026-11-01', '2026-12-31'), TODAY, 7).lateStart).toBe(false);
  });

  it('never alerts on completed or decommissioned requests', () => {
    for (const s of ['completed', 'decommissioned'] as Status[]) {
      expect(deadline(r(s, '2026-01-01', '2026-01-31'), TODAY, 7)).toEqual({ daysLeft: null, overdue: false, dueSoon: false, lateStart: false });
    }
  });

  it('counts days correctly across month and year ends', () => {
    expect(deadline(r('testing', '2026-12-01', '2027-01-02'), '2026-12-30', 7).daysLeft).toBe(3);
  });
});

describe('deadlineSettings', () => {
  it('defaults to Lagos and 7 days, and rejects bad values', () => {
    expect(deadlineSettings({})).toEqual({ timeZone: 'Africa/Lagos', warnDays: 7 });
    expect(deadlineSettings({ APP_TIMEZONE: 'Europe/London', DEADLINE_WARNING_DAYS: '3' })).toEqual({ timeZone: 'Europe/London', warnDays: 3 });
    expect(() => deadlineSettings({ APP_TIMEZONE: 'Mars/Olympus' })).toThrow(/APP_TIMEZONE/);
    expect(() => deadlineSettings({ DEADLINE_WARNING_DAYS: 'soon' })).toThrow(/DEADLINE_WARNING_DAYS/);
    expect(() => deadlineSettings({ DEADLINE_WARNING_DAYS: '-1' })).toThrow(/DEADLINE_WARNING_DAYS/);
  });
});
