import { describe, expect, it } from 'vitest';
import {
  WELLNESS_BANDS,
  reportInsightSchema,
  reportReferenceSchema,
  reportRingKeySchema,
  reportRingSchema,
  reportStatSchema,
  summaryDayBalanceSchema,
  summaryGlanceTileSchema,
  summaryHeadlineSchema,
  summaryPeriodSchema,
  summarySuggestionSchema,
  summaryWeekBreakdownSchema,
  weeklyReportQuerySchema,
  weeklyReportResponseSchema,
  wellnessBandFor,
  wellnessGroupFor,
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
    deltaValue: 4,
    reference: { value: 60, label: 'last week' },
    daysLogged: 5,
    symptomDays: 2,
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
    seriesNote: 'Episodes each day. The figure is the total for the week.',
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

describe('wellness bands', () => {
  it('names every 20-point step of the ladder', () => {
    expect(wellnessBandFor(100)).toBe('Great');
    expect(wellnessBandFor(80)).toBe('Great');
    expect(wellnessBandFor(79)).toBe('Good');
    expect(wellnessBandFor(60)).toBe('Good');
    expect(wellnessBandFor(59)).toBe('Okay');
    expect(wellnessBandFor(40)).toBe('Okay');
    expect(wellnessBandFor(39)).toBe('Hard');
    expect(wellnessBandFor(20)).toBe('Hard');
    expect(wellnessBandFor(19)).toBe('Very hard');
    expect(wellnessBandFor(0)).toBe('Very hard');
  });

  it('leaves an unlogged day unbanded rather than calling it bad', () => {
    expect(wellnessBandFor(null)).toBeNull();
    expect(wellnessGroupFor(null)).toBeNull();
  });

  it('covers the whole 0-100 range with no gap between bands', () => {
    const mins = WELLNESS_BANDS.map((b) => b.min);
    expect(mins).toEqual([...mins].sort((a, b) => b - a));
    expect(mins.at(-1)).toBe(0);
    for (let score = 0; score <= 100; score += 1) {
      expect(wellnessBandFor(score)).not.toBeNull();
    }
  });

  it('groups days on the ladder’s own edges, not new ones', () => {
    expect(wellnessGroupFor(60)).toBe('good');
    expect(wellnessGroupFor(59)).toBe('okay');
    expect(wellnessGroupFor(40)).toBe('okay');
    expect(wellnessGroupFor(39)).toBe('hard');
    // A grouped day is exactly a day the gauge paints the same colour.
    expect(wellnessGroupFor(80)).toBe('good');
    expect(wellnessGroupFor(0)).toBe('hard');
  });
});

describe('summaryHeadlineSchema', () => {
  it('accepts a scored headline', () => {
    expect(
      summaryHeadlineSchema.parse({
        score: 72,
        band: 'Good',
        headline: 'Doing well',
        body: 'Energy is strong and stress is manageable.',
      }),
    ).toMatchObject({ score: 72, band: 'Good' });
  });

  it('accepts an unscored window but still requires the copy', () => {
    expect(
      summaryHeadlineSchema.parse({
        score: null,
        band: null,
        headline: 'Nothing logged yet',
        body: 'A couple of check-ins and I can tell you how the day went.',
      }),
    ).toMatchObject({ score: null, band: null });
    expect(
      summaryHeadlineSchema.safeParse({ score: null, band: null, headline: 'x' }).success,
    ).toBe(false);
  });
});

describe('summaryDayBalanceSchema', () => {
  it('accepts four integer counts', () => {
    expect(summaryDayBalanceSchema.parse({ good: 4, okay: 2, hard: 1, untracked: 0 })).toEqual({
      good: 4,
      okay: 2,
      hard: 1,
      untracked: 0,
    });
  });

  it('rejects a fractional day', () => {
    expect(
      summaryDayBalanceSchema.safeParse({ good: 4.5, okay: 0, hard: 0, untracked: 0 }).success,
    ).toBe(false);
  });

  it('rejects a missing bucket — the client must not infer one', () => {
    expect(summaryDayBalanceSchema.safeParse({ good: 4, okay: 2, hard: 1 }).success).toBe(false);
  });
});

describe('summaryGlanceTileSchema', () => {
  const tile = {
    key: 'improvement',
    eyebrow: 'Biggest improvement',
    label: 'Mood stability',
    value: '+18 pts',
    note: 'vs last month',
    ringKey: 'mood',
    tone: 'improving',
  };

  it('accepts a metric tile', () => {
    expect(summaryGlanceTileSchema.parse(tile)).toEqual(tile);
  });

  it('accepts a count tile with no metric behind it', () => {
    expect(
      summaryGlanceTileSchema.parse({
        ...tile,
        key: 'tracked',
        eyebrow: 'Tracked days',
        label: '21 of 30',
        value: null,
        note: 'days this month',
        ringKey: null,
        tone: 'neutral',
      }),
    ).toMatchObject({ ringKey: null, value: null });
  });

  it('rejects an unknown tone or ring key', () => {
    expect(summaryGlanceTileSchema.safeParse({ ...tile, tone: 'warning' }).success).toBe(false);
    expect(summaryGlanceTileSchema.safeParse({ ...tile, ringKey: 'hydration' }).success).toBe(
      false,
    );
  });
});

describe('summarySuggestionSchema', () => {
  it('accepts a title and body', () => {
    expect(
      summarySuggestionSchema.parse({ title: "Today's nudge", body: 'Hydrate well.' }),
    ).toMatchObject({ title: "Today's nudge" });
  });

  it('rejects a body-less suggestion', () => {
    expect(summarySuggestionSchema.safeParse({ title: 'x' }).success).toBe(false);
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
    seriesCoverageStart: '2026-08-03',
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
    headline: {
      score: 58,
      band: 'Okay',
      headline: 'A mixed week',
      body: 'Energy is slightly low and stress is manageable.',
    },
    dayBalance: { good: 2, okay: 1, hard: 1, untracked: 0 },
    glance: [],
    suggestion: null,
    rings: [
      {
        key: 'energy',
        label: 'Energy',
        pct: 55,
        band: 'Slightly low',
        detail: null,
        delta: 'Steady vs last week',
        deltaTone: 'neutral',
        deltaValue: null,
        reference: { value: 58, label: 'last week' },
        daysLogged: 4,
        symptomDays: 0,
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
        seriesNote: 'Hours slept each night. The figure is the average of the week.',
      },
    ],
    insights: [{ tone: 'positive', title: 'Steady week', body: 'Energy held.' }],
    joints: null,
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
