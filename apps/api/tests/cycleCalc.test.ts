import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { PeriodLogEntry } from '@anuva/shared';
import {
  assumedEndDate,
  computeAvgPeriodLength,
  computeCycleGaps,
  computeCycleState,
  promptableBleedingDays,
  resolveEditablePeriodId,
} from '../src/cycleCalc.js';

function period(
  id: string,
  startDate: string,
  endDate: string | null = null,
  endDateSource?: 'user' | 'inferred',
): PeriodLogEntry {
  return { id, startDate, endDate, endDateSource };
}

/**
 * A YYYY-MM-DD start date that lands on `targetCycleDay` today.
 *
 * cycleCalc reads "today" from the local calendar and parses date-only strings at
 * UTC midnight, so a cycle day is a plain calendar-day difference — no timezone
 * arithmetic needed here, and none wanted: mixing the two is what used to make
 * these counts drift by a day in offset zones.
 */
function startDateForCycleDay(targetCycleDay: number, today: Date): string {
  const probe = new Date(today);
  probe.setDate(probe.getDate() - (targetCycleDay - 1));
  const y = probe.getFullYear();
  const m = String(probe.getMonth() + 1).padStart(2, '0');
  const d = String(probe.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
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

  const settings = (cycleLength = CYCLE, periodLength = PERIOD) => ({ cycleLength, periodLength });

  beforeEach(() => {
    // Noon local avoids DST midnight edge cases when freezing the clock.
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2024, 5, 20, 12, 0, 0)); // 20 Jun 2024
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns all-null fields when there are no periods', () => {
    expect(computeCycleState([], settings())).toMatchObject({
      status: 'unset',
      currentCycleDay: null,
      phase: null,
      nextPeriodDate: null,
      fertileWindowStart: null,
      fertileWindowEnd: null,
      ovulationDate: null,
      predictions: [],
    });
  });

  it('uses the most recent startDate when multiple periods exist', () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const recent = startDateForCycleDay(3, today);
    const state = computeCycleState(
      [period('old', '2024-01-01', '2024-01-05'), period('new', recent, null)],
      settings(),
    );
    expect(state.currentCycleDay).toBe(3);
    expect(state.phase).toBe('period');
  });

  it('marks phase as period on cycle days 1..periodLength', () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    for (const day of [1, 5]) {
      const start = startDateForCycleDay(day, today);
      const state = computeCycleState([period('p', start)], settings());
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
      const state = computeCycleState([period('p', start)], settings());
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
      const state = computeCycleState([period('p', start)], settings());
      expect(state.currentCycleDay).toBe(day);
      expect(state.phase).toBe('ovulatory');
    }
  });

  it('marks phase as luteal after the ovulatory window', () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    for (const day of [16, 28]) {
      const start = startDateForCycleDay(day, today);
      const state = computeCycleState([period('p', start)], settings());
      expect(state.currentCycleDay).toBe(day);
      expect(state.phase).toBe('luteal');
    }
  });

  it('computes next period, ovulation, and fertile window from cycle length', () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const start = startDateForCycleDay(10, today);
    const state = computeCycleState([period('p', start)], settings());

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
    const shortPeriod = computeCycleState([period('p', start)], settings(CYCLE, 2));
    const longPeriod = computeCycleState([period('p', start)], settings(CYCLE, 5));
    expect(shortPeriod.currentCycleDay).toBe(3);
    expect(shortPeriod.phase).toBe('follicular');
    expect(longPeriod.phase).toBe('period');
  });
});

describe('computeCycleGaps', () => {
  it('averages consistent gaps as-is', () => {
    const periods = ['2025-01-01', '2025-01-29', '2025-02-26', '2025-03-26'].map((d) =>
      period(d, d),
    );
    expect(computeCycleGaps(periods)).toEqual([28, 28, 28]);
  });

  it('drops a gap that is roughly double her own spacing', () => {
    // A 21-day cycler with one cycle missing from the record: 21, 42, 21, 21.
    // The 42 is inside the plausible 21–45 range, so only a comparison against
    // her own median can tell it from a genuinely long cycle.
    const periods = ['2025-01-01', '2025-01-22', '2025-03-05', '2025-03-26', '2025-04-16'].map(
      (d) => period(d, d),
    );
    expect(computeCycleGaps(periods)).toEqual([21, 21, 21]);
  });

  it('keeps the real variation of an irregular cycler', () => {
    const periods = ['2025-01-01', '2025-01-25', '2025-03-11', '2025-04-10', '2025-05-08'].map(
      (d) => period(d, d),
    );
    // 24, 45, 30, 28 — the 45 is under 1.75x the median of the others, so it stays.
    expect(computeCycleGaps(periods)).toEqual([24, 45, 30, 28]);
  });

  it('leaves gaps outside the plausible range out entirely', () => {
    const periods = ['2025-01-01', '2025-01-10', '2025-02-07'].map((d) => period(d, d));
    expect(computeCycleGaps(periods)).toEqual([28]);
  });
});

describe('computeAvgPeriodLength with assumed ends', () => {
  it('ignores an end date we inferred rather than one she gave us', () => {
    const periods = [
      period('confirmed', '2025-01-01', '2025-01-07'), // 7 days, her own
      period('assumed', '2025-02-01', '2025-02-05', 'inferred'), // 5 days, our guess
    ];
    // Averaging the guess in would drag 7 down towards it, and the guess is
    // itself derived from this average — so it must not feed back.
    expect(computeAvgPeriodLength(periods)).toBe(7);
  });

  it('returns null when every end date was inferred', () => {
    const periods = [period('a', '2025-01-01', '2025-01-05', 'inferred')];
    expect(computeAvgPeriodLength(periods)).toBeNull();
  });
});

describe('resolveEditablePeriodId', () => {
  it('names the most recent period by start date, not by list order', () => {
    const periods = [
      period('old', '2025-01-01', '2025-01-05'),
      period('newest', '2025-03-01'),
      period('middle', '2025-02-01', '2025-02-05'),
    ];
    expect(resolveEditablePeriodId(periods)).toBe('newest');
  });

  it('is null when nothing is logged', () => {
    expect(resolveEditablePeriodId([])).toBeNull();
  });
});

describe('assumedEndDate', () => {
  it('runs for her usual period length', () => {
    expect(assumedEndDate('2025-03-01', 5)).toBe('2025-03-05');
  });

  it('is cut short when a newer period starts sooner', () => {
    expect(assumedEndDate('2025-03-01', 5, '2025-03-03')).toBe('2025-03-03');
  });

  it('never ends before it started', () => {
    expect(assumedEndDate('2025-03-01', 5, '2025-02-27')).toBe('2025-03-01');
  });
});

describe('promptableBleedingDays', () => {
  const now = new Date(2025, 2, 10, 12, 0, 0); // 10 Mar 2025

  it('offers every day of a period she closed herself', () => {
    const periods = [period('p', '2025-03-05', '2025-03-08')];
    expect(promptableBleedingDays(periods, 5, [], now)).toEqual([
      '2025-03-05',
      '2025-03-06',
      '2025-03-07',
      '2025-03-08',
    ]);
  });

  it('offers only the first day of an open period until she answers', () => {
    const periods = [period('p', '2025-03-08')];
    expect(promptableBleedingDays(periods, 5, [], now)).toEqual(['2025-03-08']);
  });

  it('walks forward one day for each day she answers', () => {
    const periods = [period('p', '2025-03-08')];
    expect(promptableBleedingDays(periods, 5, ['2025-03-08'], now)).toEqual([
      '2025-03-08',
      '2025-03-09',
    ]);
    expect(promptableBleedingDays(periods, 5, ['2025-03-08', '2025-03-09'], now)).toEqual([
      '2025-03-08',
      '2025-03-09',
      '2025-03-10',
    ]);
  });

  it('never walks past today', () => {
    const periods = [period('p', '2025-03-09')];
    const answered = ['2025-03-09', '2025-03-10', '2025-03-11'];
    expect(promptableBleedingDays(periods, 5, answered, now)).toEqual(['2025-03-09', '2025-03-10']);
  });

  it('offers only the first day of a period we closed by assumption', () => {
    const periods = [period('p', '2025-03-05', '2025-03-09', 'inferred')];
    expect(promptableBleedingDays(periods, 5, [], now)).toEqual(['2025-03-05']);
  });
});
