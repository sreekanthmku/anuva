import { describe, it, expect } from 'vitest';
import { resolvePeriodWindow, WEEK_DAYS } from '../src/report/build.js';

/** Local calendar helpers — match build.ts semantics for assertions. */
function localYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function startOfLocalDay(d: Date): Date {
  const s = new Date(d);
  s.setHours(0, 0, 0, 0);
  return s;
}

describe('WEEK_DAYS', () => {
  it('is 7', () => {
    expect(WEEK_DAYS).toBe(7);
  });
});

describe('resolvePeriodWindow — daily', () => {
  const now = new Date(2024, 5, 20, 15, 30, 0); // Thu 20 Jun 2024 local
  const anchor = new Date(2024, 5, 10); // joined 10 Jun

  it('offset 0 is today, compares against the prior 7 days', () => {
    const w = resolvePeriodWindow(anchor, 'daily', 0, now);
    expect(w.period).toBe('daily');
    expect(w.offset).toBe(0);
    expect(localYmd(w.start)).toBe('2024-06-20');
    expect(localYmd(w.end)).toBe('2024-06-20');
    expect(localYmd(w.prevStart)).toBe('2024-06-13');
    expect(localYmd(w.prevEnd)).toBe('2024-06-19');
    expect(localYmd(w.fetchStart)).toBe('2024-06-06'); // start − 14 volatility days
    expect(localYmd(w.fetchEnd)).toBe('2024-06-20');
    expect(w.daysElapsed).toBe(1);
    expect(w.canGoForward).toBe(false);
    expect(w.canGoBack).toBe(true);
  });

  it('clamps negative requested offset to 0', () => {
    const w = resolvePeriodWindow(anchor, 'daily', -5, now);
    expect(w.offset).toBe(0);
    expect(localYmd(w.start)).toBe('2024-06-20');
  });

  it('clamps offset past the trial anchor', () => {
    // maxOffset = days from Jun 10 → Jun 20 = 10
    const w = resolvePeriodWindow(anchor, 'daily', 99, now);
    expect(w.offset).toBe(10);
    expect(localYmd(w.start)).toBe('2024-06-10');
    expect(w.canGoBack).toBe(false);
    expect(w.canGoForward).toBe(true);
  });

  it('never lets daily start precede the trial anchor (offset clamp)', () => {
    // Daily maxOffset equals days since anchor, so start cannot land before it.
    const lateAnchor = new Date(2024, 5, 18);
    const w = resolvePeriodWindow(lateAnchor, 'daily', 99, now);
    expect(w.offset).toBe(2); // Jun 18 → Jun 20
    expect(localYmd(w.start)).toBe('2024-06-18');
    expect(localYmd(w.coverageStart)).toBe('2024-06-18');
    expect(w.daysElapsed).toBe(1);
    expect(w.canGoBack).toBe(false);
  });

  it('sets canGoBack false when anchor is today (no history)', () => {
    const sameDay = startOfLocalDay(now);
    const w = resolvePeriodWindow(sameDay, 'daily', 0, now);
    expect(w.offset).toBe(0);
    expect(w.canGoBack).toBe(false);
    expect(w.canGoForward).toBe(false);
  });
});

describe('resolvePeriodWindow — weekly', () => {
  // 20 Jun 2024 is Thursday; week is Mon 17 – Sun 23
  const now = new Date(2024, 5, 20, 12, 0, 0);
  const anchor = new Date(2024, 4, 1); // 1 May 2024 — several weeks of history

  it('offset 0 is the current Mon–Sun week', () => {
    const w = resolvePeriodWindow(anchor, 'weekly', 0, now);
    expect(w.period).toBe('weekly');
    expect(w.offset).toBe(0);
    expect(localYmd(w.start)).toBe('2024-06-17');
    expect(localYmd(w.end)).toBe('2024-06-23');
    expect(localYmd(w.prevStart)).toBe('2024-06-10');
    expect(localYmd(w.prevEnd)).toBe('2024-06-16');
    expect(localYmd(w.fetchStart)).toBe('2024-06-10');
    expect(localYmd(w.coverageEnd)).toBe('2024-06-20'); // clipped to today
    expect(w.daysElapsed).toBe(4); // Mon 17 … Thu 20 inclusive
    expect(w.canGoForward).toBe(false);
    expect(w.canGoBack).toBe(true);
  });

  it('offset 1 is the previous full week', () => {
    const w = resolvePeriodWindow(anchor, 'weekly', 1, now);
    expect(w.offset).toBe(1);
    expect(localYmd(w.start)).toBe('2024-06-10');
    expect(localYmd(w.end)).toBe('2024-06-16');
    expect(localYmd(w.coverageEnd)).toBe('2024-06-16');
    expect(w.daysElapsed).toBe(7);
    expect(w.canGoForward).toBe(true);
  });

  it('clamps weekly offset to weeks since the anchor week', () => {
    const recentAnchor = new Date(2024, 5, 12); // Wed in week of Mon 10
    const w = resolvePeriodWindow(recentAnchor, 'weekly', 50, now);
    // weeks from Mon 10 → Mon 17 = 1
    expect(w.offset).toBe(1);
    expect(localYmd(w.start)).toBe('2024-06-10');
    expect(w.canGoBack).toBe(false);
    expect(w.canGoForward).toBe(true);
  });

  it('clips coverageStart when the user joined mid-week', () => {
    const midWeekAnchor = new Date(2024, 5, 19); // Wed 19 Jun
    const w = resolvePeriodWindow(midWeekAnchor, 'weekly', 0, now);
    expect(localYmd(w.start)).toBe('2024-06-17');
    expect(localYmd(w.coverageStart)).toBe('2024-06-19');
    expect(localYmd(w.coverageEnd)).toBe('2024-06-20');
    expect(w.daysElapsed).toBe(2); // Wed 19 … Thu 20
  });
});

describe('resolvePeriodWindow — monthly', () => {
  const now = new Date(2024, 5, 20, 12, 0, 0); // Jun 2024
  const anchor = new Date(2024, 2, 15); // 15 Mar 2024

  it('offset 0 is the current calendar month, clipped to today', () => {
    const w = resolvePeriodWindow(anchor, 'monthly', 0, now);
    expect(w.period).toBe('monthly');
    expect(w.offset).toBe(0);
    expect(localYmd(w.start)).toBe('2024-06-01');
    expect(localYmd(w.end)).toBe('2024-06-30');
    expect(localYmd(w.prevStart)).toBe('2024-05-01');
    expect(localYmd(w.prevEnd)).toBe('2024-05-31');
    expect(localYmd(w.coverageStart)).toBe('2024-06-01');
    expect(localYmd(w.coverageEnd)).toBe('2024-06-20');
    expect(w.daysElapsed).toBe(20);
    expect(w.canGoForward).toBe(false);
    expect(w.canGoBack).toBe(true);
  });

  it('offset 1 is the previous month in full', () => {
    const w = resolvePeriodWindow(anchor, 'monthly', 1, now);
    expect(w.offset).toBe(1);
    expect(localYmd(w.start)).toBe('2024-05-01');
    expect(localYmd(w.end)).toBe('2024-05-31');
    expect(w.daysElapsed).toBe(31);
    expect(w.canGoForward).toBe(true);
  });

  it('clamps monthly offset to months since the anchor month', () => {
    // Mar → Jun = 3 months
    const w = resolvePeriodWindow(anchor, 'monthly', 100, now);
    expect(w.offset).toBe(3);
    expect(localYmd(w.start)).toBe('2024-03-01');
    expect(localYmd(w.end)).toBe('2024-03-31');
    expect(localYmd(w.coverageStart)).toBe('2024-03-15'); // clipped to anchor
    expect(w.daysElapsed).toBe(17); // Mar 15 … Mar 31
    expect(w.canGoBack).toBe(false);
  });

  it('handles February in a leap year', () => {
    const leapNow = new Date(2024, 2, 5, 12, 0, 0); // 5 Mar 2024
    const leapAnchor = new Date(2024, 0, 1);
    const w = resolvePeriodWindow(leapAnchor, 'monthly', 1, leapNow);
    expect(localYmd(w.start)).toBe('2024-02-01');
    expect(localYmd(w.end)).toBe('2024-02-29');
    expect(w.daysElapsed).toBe(29);
  });
});
