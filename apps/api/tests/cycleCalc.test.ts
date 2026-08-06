import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { PeriodLogEntry } from '@anuva/shared';
import { computeAvgPeriodLength, computeCycleState } from '../src/cycleCalc.js';

function period(id: string, startDate: string, endDate: string | null = null): PeriodLogEntry {
  return { id, startDate, endDate };
}

/** Mirror of cycleCalc daysBetween — used only to pick inputs that land on a target cycle day. */
function daysBetween(a: Date, b: Date): number {
  return Math.floor((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * Build a YYYY-MM-DD startDate that yields `targetCycleDay` under the same
 * `new Date(iso)` + local-midnight-today rules as computeCycleState.
 */
function startDateForCycleDay(targetCycleDay: number, today: Date): string {
  const desiredDelta = targetCycleDay - 1;
  // Prefer a UTC calendar date near (today - desiredDelta).
  const probe = new Date(today);
  probe.setDate(probe.getDate() - desiredDelta);
  const iso = `${probe.getFullYear()}-${String(probe.getMonth() + 1).padStart(2, '0')}-${String(probe.getDate()).padStart(2, '0')}`;
  const actual = daysBetween(new Date(iso), today) + 1;
  if (actual === targetCycleDay) return iso;

  // Nudge by calendar day if timezone skew shifted the cycle day.
  const adjust = targetCycleDay - actual;
  probe.setDate(probe.getDate() - adjust);
  return `${probe.getFullYear()}-${String(probe.getMonth() + 1).padStart(2, '0')}-${String(probe.getDate()).padStart(2, '0')}`;
}

describe('computeAvgPeriodLength', () => {
  it('returns null when periods is empty', () => {
    expect(computeAvgPeriodLength([])).toBeNull();
  });

  it('returns null when every period is still open (no endDate)', () => {
    const periods = [period('1', '2024-01-01'), period('2', '2024-02-01')];
    expect(computeAvgPeriodLength(periods)).toBeNull();
  });

  it('ignores open periods and averages completed ones (inclusive day count)', () => {
    // Jan 1–5 = 5 days; Feb 1–3 = 3 days → avg 4
    const periods = [
      period('1', '2024-01-01', '2024-01-05'),
      period('2', '2024-02-01', '2024-02-03'),
      period('open', '2024-03-01', null),
    ];
    expect(computeAvgPeriodLength(periods)).toBe(4);
  });

  it('returns the inclusive length of a single completed period', () => {
    expect(computeAvgPeriodLength([period('1', '2024-06-10', '2024-06-10')])).toBe(1);
    expect(computeAvgPeriodLength([period('1', '2024-06-10', '2024-06-16')])).toBe(7);
  });

  it('rounds the average to the nearest integer', () => {
    // 5 + 5 + 4 = 14 / 3 = 4.666… → 5
    const periods = [
      period('1', '2024-01-01', '2024-01-05'),
      period('2', '2024-02-01', '2024-02-05'),
      period('3', '2024-03-01', '2024-03-04'),
    ];
    expect(computeAvgPeriodLength(periods)).toBe(5);
  });
});

describe('computeCycleState', () => {
  const CYCLE = 28;
  const PERIOD = 5;

  beforeEach(() => {
    // Noon local avoids DST midnight edge cases when freezing the clock.
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2024, 5, 20, 12, 0, 0)); // 20 Jun 2024
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns all-null fields when there are no periods', () => {
    expect(computeCycleState([], CYCLE, PERIOD)).toEqual({
      currentCycleDay: null,
      phase: null,
      nextPeriodDate: null,
      fertileWindowStart: null,
      fertileWindowEnd: null,
      ovulationDate: null,
    });
  });

  it('uses the most recent startDate when multiple periods exist', () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const recent = startDateForCycleDay(3, today);
    const state = computeCycleState(
      [period('old', '2024-01-01', '2024-01-05'), period('new', recent, null)],
      CYCLE,
      PERIOD,
    );
    expect(state.currentCycleDay).toBe(3);
    expect(state.phase).toBe('period');
  });

  it('marks phase as period on cycle days 1..periodLength', () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    for (const day of [1, 5]) {
      const start = startDateForCycleDay(day, today);
      const state = computeCycleState([period('p', start)], CYCLE, PERIOD);
      expect(state.currentCycleDay).toBe(day);
      expect(state.phase).toBe('period');
    }
  });

  it('marks phase as follicular between period end and pre-ovulatory', () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    // ovulationDayNum = 28 - 14 = 14; follicular while day < 13
    for (const day of [6, 12]) {
      const start = startDateForCycleDay(day, today);
      const state = computeCycleState([period('p', start)], CYCLE, PERIOD);
      expect(state.currentCycleDay).toBe(day);
      expect(state.phase).toBe('follicular');
    }
  });

  it('marks phase as ovulatory around ovulation day', () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    // ovulatory while day <= ovulationDayNum + 1 and not follicular → days 13–15
    for (const day of [13, 14, 15]) {
      const start = startDateForCycleDay(day, today);
      const state = computeCycleState([period('p', start)], CYCLE, PERIOD);
      expect(state.currentCycleDay).toBe(day);
      expect(state.phase).toBe('ovulatory');
    }
  });

  it('marks phase as luteal after the ovulatory window', () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    for (const day of [16, 28]) {
      const start = startDateForCycleDay(day, today);
      const state = computeCycleState([period('p', start)], CYCLE, PERIOD);
      expect(state.currentCycleDay).toBe(day);
      expect(state.phase).toBe('luteal');
    }
  });

  it('computes next period, ovulation, and fertile window from cycle length', () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const start = startDateForCycleDay(10, today);
    const state = computeCycleState([period('p', start)], CYCLE, PERIOD);

    const lastStart = new Date(start);
    const addDays = (d: Date, n: number) => {
      const r = new Date(d);
      r.setDate(r.getDate() + n);
      return r;
    };
    const toDateOnly = (d: Date) => d.toISOString().split('T')[0]!;
    const ovulationDayNum = CYCLE - 14;

    expect(state.currentCycleDay).toBe(10);
    expect(state.nextPeriodDate).toBe(toDateOnly(addDays(lastStart, CYCLE)));
    expect(state.ovulationDate).toBe(toDateOnly(addDays(lastStart, ovulationDayNum - 1)));
    expect(state.fertileWindowStart).toBe(toDateOnly(addDays(lastStart, ovulationDayNum - 6)));
    expect(state.fertileWindowEnd).toBe(toDateOnly(addDays(lastStart, ovulationDayNum)));
  });

  it('respects a shorter periodLength boundary for the period phase', () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const start = startDateForCycleDay(3, today);
    const shortPeriod = computeCycleState([period('p', start)], CYCLE, 2);
    const longPeriod = computeCycleState([period('p', start)], CYCLE, 5);
    expect(shortPeriod.currentCycleDay).toBe(3);
    expect(shortPeriod.phase).toBe('follicular');
    expect(longPeriod.phase).toBe('period');
  });
});
