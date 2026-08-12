import { describe, expect, it } from 'vitest';
import {
  reportInsightSchema,
  reportReferenceSchema,
  reportRingKeySchema,
  reportRingSchema,
  reportStatSchema,
  summaryPeriodSchema,
  summaryWeekBreakdownSchema,
  weeklyReportQuerySchema,
  weeklyReportResponseSchema,
} from '../src/report.js';

describe('summaryPeriodSchema', () => {
  it.each(['daily', 'weekly', 'monthly'] as const)('accepts %s', (period) => {
    expect(summaryPeriodSchema.parse(period)).toBe(period);
  });

  it('rejects unknown period', () => {
    expect(summaryPeriodSchema.safeParse('yearly').success).toBe(false);
  });
});

describe('reportRingKeySchema', () => {
  it.each(['sleep', 'energy', 'stress', 'mood', 'focus', 'hotFlashes'] as const)(
    'accepts %s',
    (key) => {
      expect(reportRingKeySchema.parse(key)).toBe(key);
    },
  );

  it('rejects unknown key', () => {
    expect(reportRingKeySchema.safeParse('hydration').success).toBe(false);
  });
});

describe('reportReferenceSchema', () => {
  it('accepts valid reference', () => {
    expect(reportReferenceSchema.parse({ value: 62, label: 'your usual' })).toEqual({
      value: 62,
      label: 'your usual',
    });
  });

  it('rejects missing label', () => {
    expect(reportReferenceSchema.safeParse({ value: 50 }).success).toBe(false);
  });
});

describe('reportRingSchema', () => {
  const valid = {
    key: 'sleep',
    label: 'Sleep',
    pct: 72,
    band: 'Some waking',
    detail: null,
    delta: '+4 pts · improving',
    deltaTone: 'positive',
    reference: { value: 60, label: 'last week' },
    daysLogged: 5,
    series: [50, null, 70],
  };

  it('accepts valid ring with nullable pct and series', () => {
    expect(reportRingSchema.parse(valid)).toEqual(valid);
    expect(reportRingSchema.parse({ ...valid, pct: null })).toMatchObject({ pct: null });
  });

  it('accepts a ring with no comparable history — no reference dot is drawn', () => {
    expect(
      reportRingSchema.parse({ ...valid, reference: null, delta: 'First week of data', deltaTone: 'none' }),
    ).toMatchObject({ reference: null });
  });

  it('rejects an unknown delta tone', () => {
    expect(reportRingSchema.safeParse({ ...valid, deltaTone: 'good' }).success).toBe(false);
  });

  it('rejects non-int daysLogged', () => {
    expect(reportRingSchema.safeParse({ ...valid, daysLogged: 1.5 }).success).toBe(false);
  });

  it('rejects invalid ring key', () => {
    expect(reportRingSchema.safeParse({ ...valid, key: 'caffeine' }).success).toBe(false);
  });
});

describe('reportStatSchema', () => {
  const valid = {
    key: 'hotFlashCount',
    label: 'Hot flashes',
    value: '3',
    unit: 'avg/day',
    trend: [1, null, 0],
  };

  it('accepts nullable value and trend entries', () => {
    expect(reportStatSchema.parse(valid)).toEqual(valid);
    expect(reportStatSchema.parse({ ...valid, value: null })).toMatchObject({ value: null });
  });

  it('rejects missing trend', () => {
    const { trend: _omit, ...rest } = valid;
    expect(reportStatSchema.safeParse(rest).success).toBe(false);
  });
});

describe('reportInsightSchema', () => {
  it.each(['positive', 'attention', 'neutral'] as const)('accepts tone %s', (tone) => {
    expect(
      reportInsightSchema.parse({ tone, title: 'Title', body: 'Body text' }),
    ).toMatchObject({ tone });
  });

  it('rejects unknown tone', () => {
    expect(
      reportInsightSchema.safeParse({ tone: 'warning', title: 't', body: 'b' }).success,
    ).toBe(false);
  });
});

describe('summaryWeekBreakdownSchema', () => {
  it('accepts nullable wellness', () => {
    expect(
      summaryWeekBreakdownSchema.parse({
        startDate: '2026-08-01',
        endDate: '2026-08-07',
        wellness: null,
        daysLogged: 0,
      }),
    ).toMatchObject({ wellness: null, daysLogged: 0 });
  });

  it('rejects non-int daysLogged', () => {
    expect(
      summaryWeekBreakdownSchema.safeParse({
        startDate: '2026-08-01',
        endDate: '2026-08-07',
        wellness: 50,
        daysLogged: 2.2,
      }).success,
    ).toBe(false);
  });
});

describe('weeklyReportQuerySchema', () => {
  it('applies defaults when empty', () => {
    expect(weeklyReportQuerySchema.parse({})).toEqual({ period: 'daily', offset: 0 });
  });

  it('coerces offset from string', () => {
    expect(weeklyReportQuerySchema.parse({ period: 'weekly', offset: '2' })).toEqual({
      period: 'weekly',
      offset: 2,
    });
  });

  it('rejects negative offset', () => {
    expect(weeklyReportQuerySchema.safeParse({ offset: -1 }).success).toBe(false);
  });

  it('rejects invalid period', () => {
    expect(weeklyReportQuerySchema.safeParse({ period: 'quarterly' }).success).toBe(false);
  });
});

describe('weeklyReportResponseSchema', () => {
  const valid = {
    period: 'weekly',
    offset: 0,
    periodStart: '2026-08-03',
    periodEnd: '2026-08-09',
    coverageStart: '2026-08-03',
    coverageEnd: '2026-08-06',
    seriesStart: '2026-08-03',
    canGoBack: true,
    canGoForward: false,
    calibrating: false,
    daysLogged: 4,
    daysElapsed: 4,
    periodLength: 7,
    daysElapsedInPeriod: 4,
    trackingLabel: '4 of 4 days tracked so far',
    trackingNote: null,
    dataState: 'ready',
    referenceNote: 'Dots mark last week.',
    rings: [
      {
        key: 'energy',
        label: 'Energy',
        pct: 55,
        band: 'Slightly low',
        detail: null,
        delta: 'Steady vs last week',
        deltaTone: 'neutral',
        reference: { value: 58, label: 'last week' },
        daysLogged: 4,
        series: [50, 55, null, 60],
      },
    ],
    stats: [
      {
        key: 'sleepHours',
        label: 'Sleep',
        value: '6.5',
        unit: 'hrs',
        trend: [6, 7, null, 6],
      },
    ],
    insights: [{ tone: 'positive', title: 'Steady week', body: 'Energy held.' }],
    weekBreakdown: [],
    anuReflection: 'A quiet, steady week.',
  };

  it('accepts a full weekly response', () => {
    expect(weeklyReportResponseSchema.parse(valid)).toEqual(valid);
  });

  it('accepts monthly weekBreakdown entries', () => {
    const monthly = {
      ...valid,
      period: 'monthly',
      weekBreakdown: [
        {
          startDate: '2026-08-01',
          endDate: '2026-08-02',
          wellness: 61,
          daysLogged: 2,
        },
      ],
    };
    expect(weeklyReportResponseSchema.parse(monthly).weekBreakdown).toHaveLength(1);
  });

  it('rejects missing anuReflection', () => {
    const { anuReflection: _omit, ...rest } = valid;
    expect(weeklyReportResponseSchema.safeParse(rest).success).toBe(false);
  });

  it('rejects non-boolean calibrating', () => {
    expect(
      weeklyReportResponseSchema.safeParse({ ...valid, calibrating: 'yes' }).success,
    ).toBe(false);
  });

  it('rejects an unknown dataState', () => {
    expect(
      weeklyReportResponseSchema.safeParse({ ...valid, dataState: 'partial' }).success,
    ).toBe(false);
  });
});
