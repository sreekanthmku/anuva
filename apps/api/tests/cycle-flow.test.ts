import { describe, it, expect } from 'vitest';
import type { PeriodLogEntry } from '@anuva/shared';
import {
  FLOW_BACKLOG_MAX,
  bleedingDays,
  isBleedingDay,
  pendingFlowDates,
} from '../src/cycleCalc.js';

function period(id: string, startDate: string, endDate: string | null = null): PeriodLogEntry {
  return { id, startDate, endDate };
}

/** Local noon, so the local calendar day is unambiguous in any timezone. */
function at(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number) as [number, number, number];
  return new Date(y, m - 1, d, 12, 0, 0);
}

describe('bleedingDays', () => {
  it('is empty with no logged periods', () => {
    expect(bleedingDays([], 5, at('2026-08-27'))).toEqual([]);
  });

  it('spans start to endDate inclusive for a closed period', () => {
    const days = bleedingDays([period('1', '2026-08-20', '2026-08-23')], 5, at('2026-08-27'));
    expect(days).toEqual(['2026-08-20', '2026-08-21', '2026-08-22', '2026-08-23']);
  });

  it('runs an open period for the effective period length', () => {
    const days = bleedingDays([period('1', '2026-08-20')], 4, at('2026-08-27'));
    expect(days).toEqual(['2026-08-20', '2026-08-21', '2026-08-22', '2026-08-23']);
  });

  it('clamps an open period at today so future days are never bleeding days', () => {
    const days = bleedingDays([period('1', '2026-08-26')], 5, at('2026-08-27'));
    expect(days).toEqual(['2026-08-26', '2026-08-27']);
  });

  it('clamps a closed period whose endDate is in the future', () => {
    const days = bleedingDays([period('1', '2026-08-26', '2026-08-30')], 5, at('2026-08-27'));
    expect(days).toEqual(['2026-08-26', '2026-08-27']);
  });

  it('ignores a period that has not started yet', () => {
    expect(bleedingDays([period('1', '2026-09-01')], 5, at('2026-08-27'))).toEqual([]);
  });

  it('merges overlapping periods without duplicating a day', () => {
    const days = bleedingDays(
      [period('1', '2026-08-20', '2026-08-24'), period('2', '2026-08-23', '2026-08-25')],
      5,
      at('2026-08-27'),
    );
    expect(days).toEqual([
      '2026-08-20',
      '2026-08-21',
      '2026-08-22',
      '2026-08-23',
      '2026-08-24',
      '2026-08-25',
    ]);
    expect(new Set(days).size).toBe(days.length);
  });

  it('crosses a month boundary', () => {
    const days = bleedingDays([period('1', '2026-07-30', '2026-08-02')], 5, at('2026-08-27'));
    expect(days).toEqual(['2026-07-30', '2026-07-31', '2026-08-01', '2026-08-02']);
  });
});

describe('isBleedingDay', () => {
  const periods = [period('1', '2026-08-25', '2026-08-28')];

  it('accepts a day inside the logged period', () => {
    expect(isBleedingDay('2026-08-26', periods, 5, at('2026-08-27'))).toBe(true);
  });

  it('rejects a day after today, even inside the logged range', () => {
    expect(isBleedingDay('2026-08-28', periods, 5, at('2026-08-27'))).toBe(false);
  });

  it('rejects a day outside any logged period', () => {
    expect(isBleedingDay('2026-08-24', periods, 5, at('2026-08-27'))).toBe(false);
  });
});

describe('pendingFlowDates', () => {
  const now = at('2026-08-27');

  it('is empty when every bleeding day is answered', () => {
    const bleeding = ['2026-08-26', '2026-08-27'];
    expect(pendingFlowDates(bleeding, bleeding, now)).toEqual([]);
  });

  it('asks about today before yesterday', () => {
    const bleeding = ['2026-08-25', '2026-08-26', '2026-08-27'];
    expect(pendingFlowDates(bleeding, [], now)).toEqual([
      '2026-08-27',
      '2026-08-26',
      '2026-08-25',
    ]);
  });

  it('skips days that already carry an answer', () => {
    const bleeding = ['2026-08-25', '2026-08-26', '2026-08-27'];
    expect(pendingFlowDates(bleeding, ['2026-08-27'], now)).toEqual(['2026-08-26', '2026-08-25']);
  });

  it('caps how many unanswered days it offers at once', () => {
    const bleeding = ['2026-08-23', '2026-08-24', '2026-08-25', '2026-08-26', '2026-08-27'];
    expect(pendingFlowDates(bleeding, [], now)).toHaveLength(FLOW_BACKLOG_MAX);
  });

  it('leaves pre-feature history alone — days outside the backlog window are never asked', () => {
    // A period logged months ago carries no flow answers, and must not queue up.
    const bleeding = ['2026-05-01', '2026-05-02', '2026-05-03'];
    expect(pendingFlowDates(bleeding, [], now)).toEqual([]);
  });
});
