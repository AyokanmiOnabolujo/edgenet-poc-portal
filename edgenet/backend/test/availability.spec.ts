import { peakUsage } from '../src/resources/availability';

const b = (startDate: string, endDate: string, quantity = 1) => ({ startDate, endDate, quantity });

describe('peakUsage', () => {
  it('is 0 with no bookings or none in the window', () => {
    expect(peakUsage([], '2026-11-01', '2026-11-30')).toBe(0);
    expect(peakUsage([b('2026-10-01', '2026-10-31')], '2026-11-01', '2026-11-30')).toBe(0);
  });

  it('treats both end dates as inclusive', () => {
    expect(peakUsage([b('2026-10-20', '2026-11-01')], '2026-11-01', '2026-11-30')).toBe(1);
    expect(peakUsage([b('2026-11-30', '2026-12-05')], '2026-11-01', '2026-11-30')).toBe(1);
  });

  it('does not count back-to-back bookings as overlapping', () => {
    expect(peakUsage([b('2026-11-01', '2026-11-10'), b('2026-11-11', '2026-11-20')], '2026-11-01', '2026-11-30')).toBe(1);
  });

  it('uses the busiest day, not the sum of every overlapping booking', () => {
    const bookings = [b('2026-11-01', '2026-11-10'), b('2026-11-20', '2026-11-30')];
    expect(peakUsage(bookings, '2026-11-05', '2026-11-25')).toBe(1);
    expect(peakUsage([...bookings, b('2026-11-08', '2026-11-22', 3)], '2026-11-05', '2026-11-25')).toBe(4);
  });

  it('works across month and year boundaries', () => {
    expect(peakUsage([b('2026-12-30', '2027-01-02', 2), b('2027-01-01', '2027-01-01', 1)], '2026-12-31', '2027-01-01')).toBe(3);
  });
});
