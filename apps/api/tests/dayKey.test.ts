/**
 * The date-column convention, pinned. A regression here silently sends every
 * nudge answer to the wrong calendar day for any server east of UTC.
 */
import { describe, expect, it } from 'vitest';
import { dayKey, fromDayKey, isoDay, localDayStart } from '../src/dayKey.js';

describe('dayKey', () => {
  it('keeps the local calendar day, whatever the clock time', () => {
    for (const hour of [0, 6, 12, 23]) {
      expect(dayKey(new Date(2026, 7, 20, hour, 30)).toISOString()).toBe('2026-08-20T00:00:00.000Z');
    }
  });

  it('does not drift the day the way local midnight does', () => {
    const local = localDayStart(new Date(2026, 7, 20, 12));
    // The whole bug in one assertion: east of UTC these differ, and it is
    // `local` that Prisma would write as the 19th.
    expect(dayKey(local).getUTCDate()).toBe(20);
    expect(dayKey(local).toISOString()).toBe('2026-08-20T00:00:00.000Z');
  });

  it('round-trips a stored value back to its local day', () => {
    const stored = dayKey(new Date(2026, 7, 20, 21, 45));
    const back = fromDayKey(stored);
    expect([back.getFullYear(), back.getMonth(), back.getDate()]).toEqual([2026, 7, 20]);
    expect(isoDay(back)).toBe('2026-08-20');
  });

  it('handles month and year boundaries', () => {
    expect(dayKey(new Date(2026, 0, 1, 0, 15)).toISOString()).toBe('2026-01-01T00:00:00.000Z');
    expect(dayKey(new Date(2025, 11, 31, 23, 59)).toISOString()).toBe('2025-12-31T00:00:00.000Z');
  });

  it('leaves localDayStart as a local-time value for timestamp comparisons', () => {
    const start = localDayStart(new Date(2026, 7, 20, 14, 5));
    expect([start.getHours(), start.getMinutes(), start.getSeconds()]).toEqual([0, 0, 0]);
    expect(start.getDate()).toBe(20);
  });
});
