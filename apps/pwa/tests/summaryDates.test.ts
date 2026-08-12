import { afterEach, describe, expect, it, vi } from 'vitest';
import type { WeeklyReportResponse } from '@anuva/shared';
import {
  PERIOD_NOUN,
  addDaysIso,
  daysBetweenIso,
  formatDay,
  formatMonth,
  formatRange,
  formatShortDay,
  parseIso,
  periodDetail,
  periodHeadline,
} from '../src/features/core/summaryDates';

function report(
  overrides: Pick<WeeklyReportResponse, 'period' | 'offset' | 'periodStart' | 'periodEnd'> &
    Partial<Pick<WeeklyReportResponse, 'coverageStart'>>
): WeeklyReportResponse {
  return {
    periodEnd: overrides.periodEnd,
    periodStart: overrides.periodStart,
    period: overrides.period,
    offset: overrides.offset,
    coverageStart: overrides.coverageStart ?? overrides.periodStart,
    coverageEnd: overrides.periodEnd,
    seriesStart: overrides.periodStart,
    canGoBack: true,
    canGoForward: false,
    calibrating: false,
    daysLogged: 0,
    daysElapsed: 1,
    periodLength: 1,
    daysElapsedInPeriod: 1,
    trackingLabel: '',
    trackingNote: null,
    dataState: 'empty',
    referenceNote: '',
    rings: [],
    stats: [],
    insights: [],
    weekBreakdown: [],
    anuReflection: '',
  };
}

describe('parseIso', () => {
  it('parses YYYY-MM-DD as local midnight', () => {
    const d = parseIso('2024-06-20');
    expect(d.getFullYear()).toBe(2024);
    expect(d.getMonth()).toBe(5);
    expect(d.getDate()).toBe(20);
    expect(d.getHours()).toBe(0);
    expect(d.getMinutes()).toBe(0);
  });
});

describe('addDaysIso', () => {
  it('adds days from a parsed ISO local midnight', () => {
    const d = addDaysIso('2024-01-31', 1);
    expect(d.getFullYear()).toBe(2024);
    expect(d.getMonth()).toBe(1);
    expect(d.getDate()).toBe(1);
  });

  it('supports negative offsets and year rollover', () => {
    const d = addDaysIso('2024-01-01', -1);
    expect(d.getFullYear()).toBe(2023);
    expect(d.getMonth()).toBe(11);
    expect(d.getDate()).toBe(31);
  });
});

describe('daysBetweenIso', () => {
  it('counts inclusive days for same-day and multi-day ranges', () => {
    expect(daysBetweenIso('2024-06-20', '2024-06-20')).toBe(1);
    expect(daysBetweenIso('2024-06-01', '2024-06-07')).toBe(7);
    expect(daysBetweenIso('2024-01-31', '2024-02-02')).toBe(3);
  });

  it('returns 0 when end precedes start', () => {
    expect(daysBetweenIso('2024-06-10', '2024-06-01')).toBe(0);
  });
});

describe('formatters', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('formatDay uses short weekday + month + day', () => {
    const spy = vi.spyOn(Date.prototype, 'toLocaleDateString').mockReturnValue('Thu, Jun 20');
    expect(formatDay('2024-06-20')).toBe('Thu, Jun 20');
    expect(spy).toHaveBeenCalledWith(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  });

  it('formatShortDay uses short month + day', () => {
    const spy = vi.spyOn(Date.prototype, 'toLocaleDateString').mockReturnValue('Jun 20');
    expect(formatShortDay('2024-06-20')).toBe('Jun 20');
    expect(spy).toHaveBeenCalledWith(undefined, { month: 'short', day: 'numeric' });
  });

  it('formatMonth uses long month + year', () => {
    const spy = vi.spyOn(Date.prototype, 'toLocaleDateString').mockReturnValue('June 2024');
    expect(formatMonth('2024-06-01')).toBe('June 2024');
    expect(spy).toHaveBeenCalledWith(undefined, { month: 'long', year: 'numeric' });
  });

  it('formatRange collapses to short day when start equals end', () => {
    vi.spyOn(Date.prototype, 'toLocaleDateString').mockReturnValue('Jun 20');
    expect(formatRange('2024-06-20', '2024-06-20')).toBe('Jun 20');
  });

  it('formatRange omits end month when both ends share a month', () => {
    vi.spyOn(Date.prototype, 'toLocaleDateString').mockImplementation(function (
      this: Date,
      _locales?: Intl.LocalesArgument,
      options?: Intl.DateTimeFormatOptions
    ) {
      if (options?.month === 'short' && options.day === 'numeric') return 'Jun 1';
      if (options?.month === 'short') return 'Jun';
      return 'x';
    });
    expect(formatRange('2024-06-01', '2024-06-07')).toBe('Jun 1 – 7');
  });

  it('formatRange includes both months when they differ', () => {
    vi.spyOn(Date.prototype, 'toLocaleDateString').mockImplementation(function (
      this: Date,
      _locales?: Intl.LocalesArgument,
      options?: Intl.DateTimeFormatOptions
    ) {
      if (options?.month === 'short' && options.day === 'numeric') {
        return this.getMonth() === 5 ? 'Jun 28' : 'Jul 4';
      }
      if (options?.month === 'short') {
        return this.getMonth() === 5 ? 'Jun' : 'Jul';
      }
      return 'x';
    });
    expect(formatRange('2024-06-28', '2024-07-04')).toBe('Jun 28 – Jul 4');
  });
});

describe('periodHeadline', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('daily: Today / Yesterday / formatted day', () => {
    expect(periodHeadline(report({ period: 'daily', offset: 0, periodStart: '2024-06-20', periodEnd: '2024-06-20' }))).toBe(
      'Today'
    );
    expect(periodHeadline(report({ period: 'daily', offset: 1, periodStart: '2024-06-19', periodEnd: '2024-06-19' }))).toBe(
      'Yesterday'
    );
    vi.spyOn(Date.prototype, 'toLocaleDateString').mockReturnValue('Tue, Jun 18');
    expect(periodHeadline(report({ period: 'daily', offset: 2, periodStart: '2024-06-18', periodEnd: '2024-06-18' }))).toBe(
      'Tue, Jun 18'
    );
  });

  it('weekly: This week / Last week / formatted range', () => {
    expect(periodHeadline(report({ period: 'weekly', offset: 0, periodStart: '2024-06-17', periodEnd: '2024-06-23' }))).toBe(
      'This week'
    );
    expect(periodHeadline(report({ period: 'weekly', offset: 1, periodStart: '2024-06-10', periodEnd: '2024-06-16' }))).toBe(
      'Last week'
    );
    vi.spyOn(Date.prototype, 'toLocaleDateString').mockImplementation(function (
      this: Date,
      _locales?: Intl.LocalesArgument,
      options?: Intl.DateTimeFormatOptions
    ) {
      if (options?.month === 'short') return 'Jun';
      return 'x';
    });
    expect(periodHeadline(report({ period: 'weekly', offset: 2, periodStart: '2024-06-03', periodEnd: '2024-06-09' }))).toBe(
      'Jun 3 – 9'
    );
  });

  it('monthly: This month / formatted month', () => {
    expect(periodHeadline(report({ period: 'monthly', offset: 0, periodStart: '2024-06-01', periodEnd: '2024-06-30' }))).toBe(
      'This month'
    );
    vi.spyOn(Date.prototype, 'toLocaleDateString').mockReturnValue('May 2024');
    expect(periodHeadline(report({ period: 'monthly', offset: 1, periodStart: '2024-05-01', periodEnd: '2024-05-31' }))).toBe(
      'May 2024'
    );
  });
});

describe('periodDetail', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns the base date label when coverage matches period start', () => {
    vi.spyOn(Date.prototype, 'toLocaleDateString').mockReturnValue('Thu, Jun 20');
    expect(
      periodDetail(report({ period: 'daily', offset: 0, periodStart: '2024-06-20', periodEnd: '2024-06-20' }))
    ).toBe('Thu, Jun 20');
  });

  it('appends mid-period join note when coverageStart differs', () => {
    vi.spyOn(Date.prototype, 'toLocaleDateString').mockImplementation(function (
      this: Date,
      _locales?: Intl.LocalesArgument,
      options?: Intl.DateTimeFormatOptions
    ) {
      if (options?.weekday === 'short') return 'Mon, Jun 17';
      if (options?.month === 'short' && options.day === 'numeric') return 'Jun 19';
      if (options?.month === 'short') return 'Jun';
      return 'x';
    });
    expect(
      periodDetail(
        report({
          period: 'weekly',
          offset: 0,
          periodStart: '2024-06-17',
          periodEnd: '2024-06-23',
          coverageStart: '2024-06-19',
        })
      )
    ).toBe('Jun 17 – 23 · your data from Jun 19');
  });

  it('monthly detail uses formatMonth as the base', () => {
    vi.spyOn(Date.prototype, 'toLocaleDateString').mockReturnValue('June 2024');
    expect(
      periodDetail(report({ period: 'monthly', offset: 0, periodStart: '2024-06-01', periodEnd: '2024-06-30' }))
    ).toBe('June 2024');
  });
});

describe('PERIOD_NOUN', () => {
  it('maps each period to a singular noun', () => {
    expect(PERIOD_NOUN).toEqual({
      daily: 'day',
      weekly: 'week',
      monthly: 'month',
    });
  });
});
