import { Status } from '../entities';

// Deadline rules. Start and end dates are calendar dates with no time of day, so "today" is the calendar date in the
// company's time zone (APP_TIMEZONE), not the server's: Render runs in UTC, an hour behind Lagos.
//   overdue    : the end date has passed and the PoC is not Completed or Decommissioned
//   due soon   : not overdue, and the end date is today or within DEADLINE_WARNING_DAYS days
//   late start : still a New Request after its start date
// Completed and Decommissioned requests never raise alerts.

export interface DeadlineSettings { timeZone: string; warnDays: number }
export interface Deadline { daysLeft: number | null; overdue: boolean; dueSoon: boolean; lateStart: boolean }

const CLOSED: Status[] = ['completed', 'decommissioned'];
const DAY_MS = 86_400_000;
const dayNumber = (d: string) => Date.parse(`${d}T00:00:00Z`) / DAY_MS;

/** Reads and checks APP_TIMEZONE and DEADLINE_WARNING_DAYS; throws at startup if either is invalid. */
export function deadlineSettings(env: NodeJS.ProcessEnv = process.env): DeadlineSettings {
  const timeZone = env.APP_TIMEZONE || 'Africa/Lagos';
  try { new Intl.DateTimeFormat('en-CA', { timeZone }); } catch { throw new Error(`APP_TIMEZONE "${timeZone}" is not a valid IANA time zone.`); }
  const warnDays = env.DEADLINE_WARNING_DAYS === undefined || env.DEADLINE_WARNING_DAYS === '' ? 7 : Number(env.DEADLINE_WARNING_DAYS);
  if (!Number.isInteger(warnDays) || warnDays < 0 || warnDays > 365) throw new Error('DEADLINE_WARNING_DAYS must be a whole number from 0 to 365.');
  return { timeZone, warnDays };
}

/** Today's calendar date (YYYY-MM-DD) in the given time zone. */
export function todayIn(timeZone: string, now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

export function deadline(r: { status: Status; startDate: string; endDate: string }, today: string, warnDays: number): Deadline {
  if (CLOSED.includes(r.status)) return { daysLeft: null, overdue: false, dueSoon: false, lateStart: false };
  const daysLeft = dayNumber(r.endDate) - dayNumber(today);
  return {
    daysLeft,
    overdue: daysLeft < 0,
    dueSoon: daysLeft >= 0 && daysLeft <= warnDays,
    lateStart: r.status === 'new_request' && r.startDate < today,
  };
}
