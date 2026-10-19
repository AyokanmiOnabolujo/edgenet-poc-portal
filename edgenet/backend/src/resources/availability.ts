/** A reservation of `quantity` units over inclusive calendar dates (YYYY-MM-DD). */
export interface Booking { startDate: string; endDate: string; quantity: number }

const day = (d: string) => Date.parse(`${d}T00:00:00Z`) / 86_400_000;

/**
 * The most units booked on any single day between start and end (both inclusive).
 * Adding up every overlapping booking would overcount: two bookings that each overlap the window but not each other
 * never use capacity at the same time.
 */
export function peakUsage(bookings: Booking[], start: string, end: string): number {
  const events: [number, number][] = [];
  for (const b of bookings) {
    const s = Math.max(day(b.startDate), day(start));
    const e = Math.min(day(b.endDate), day(end));
    if (s <= e) events.push([s, b.quantity], [e + 1, -b.quantity]);
  }
  // On the same day, a booking ending the day before is released before one starting that day takes its place.
  events.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  let used = 0, peak = 0;
  for (const [, q] of events) peak = Math.max(peak, (used += q));
  return peak;
}
