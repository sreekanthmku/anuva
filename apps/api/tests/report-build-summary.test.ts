/**
 * Coverage for buildSummary — mocks every prisma model the report fetch touches.
 * Signature under test: buildSummary(userId, anchor, period, requestedOffset, now?)
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SummaryPeriod } from '@anuva/shared';

const sleepFindMany = vi.fn();
const energyFindMany = vi.fn();
const stressFindMany = vi.fn();
const moodFindMany = vi.fn();
const brainFogFindMany = vi.fn();
const hotFlashFindMany = vi.fn();

vi.mock('@anuva/database', () => ({
  prisma: {
    sleepLog: { findMany: (...args: unknown[]) => sleepFindMany(...args) },
    energyLog: { findMany: (...args: unknown[]) => energyFindMany(...args) },
    stressLog: { findMany: (...args: unknown[]) => stressFindMany(...args) },
    moodLog: { findMany: (...args: unknown[]) => moodFindMany(...args) },
    brainFogLog: { findMany: (...args: unknown[]) => brainFogFindMany(...args) },
    hotFlashDailyLog: { findMany: (...args: unknown[]) => hotFlashFindMany(...args) },
  },
}));

const { buildSummary } = await import('../src/report/build.js');

const USER_ID = 'user-report-1';
const RING_KEYS = ['sleep', 'energy', 'stress', 'mood', 'focus', 'hotFlashes'] as const;
const STAT_KEYS = ['avgSleep', 'hotFlashes', 'wellness'] as const;

/** Local calendar day at noon (timestamp logs). */
function localDay(y: number, m0: number, d: number, hour = 12): Date {
  return new Date(y, m0, d, hour, 0, 0, 0);
}

/** `@db.Date` column value — UTC midnight for the calendar day. */
function dateOnly(y: number, m0: number, d: number): Date {
  return new Date(Date.UTC(y, m0, d));
}

function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function emptyStores() {
  sleepFindMany.mockResolvedValue([]);
  energyFindMany.mockResolvedValue([]);
  stressFindMany.mockResolvedValue([]);
  moodFindMany.mockResolvedValue([]);
  brainFogFindMany.mockResolvedValue([]);
  hotFlashFindMany.mockResolvedValue([]);
}

type FixtureOpts = {
  /** Override per-day sleep category; default 'I slept well'. */
  sleepCategory?: string | null;
  sleepQuality?: number | null;
  sleepHours?: string | null;
  energyCategory?: string;
  stressCategory?: string;
  moodFeeling?: number | null;
  moodCategory?: string | null;
  moodShift?: string | null;
  focusCategory?: string;
  hotFlashCategory?: string;
  hotFlashCount?: number | null;
};

/** One day of all six metrics with scorable values. */
function dayBundle(y: number, m0: number, d: number, opts: FixtureOpts = {}) {
  const sleep = {
    loggedAt: localDay(y, m0, d, 8),
    quality: opts.sleepQuality ?? null,
    category: opts.sleepCategory === undefined ? 'I slept well' : opts.sleepCategory,
    hours: opts.sleepHours === undefined ? '7to8' : opts.sleepHours,
  };
  const energy = {
    date: dateOnly(y, m0, d),
    category: opts.energyCategory ?? 'Fresh and active',
  };
  const stress = {
    date: dateOnly(y, m0, d),
    category: opts.stressCategory ?? 'Low stress',
  };
  const mood = {
    loggedAt: localDay(y, m0, d, 9),
    feeling: opts.moodFeeling ?? null,
    category: opts.moodCategory === undefined ? 'Calm' : opts.moodCategory,
    moodShift: opts.moodShift ?? null,
  };
  const focus = {
    date: dateOnly(y, m0, d),
    category: opts.focusCategory ?? 'Clear and focused',
  };
  const hot = {
    date: dateOnly(y, m0, d),
    category: opts.hotFlashCategory ?? 'None',
    count: opts.hotFlashCount === undefined ? 0 : opts.hotFlashCount,
  };
  return { sleep, energy, stress, mood, focus, hot };
}

function installFixture(parts: ReturnType<typeof dayBundle>[]) {
  sleepFindMany.mockResolvedValue(parts.map((p) => p.sleep));
  energyFindMany.mockResolvedValue(parts.map((p) => p.energy));
  stressFindMany.mockResolvedValue(parts.map((p) => p.stress));
  moodFindMany.mockResolvedValue(parts.map((p) => p.mood));
  brainFogFindMany.mockResolvedValue(parts.map((p) => p.focus));
  hotFlashFindMany.mockResolvedValue(parts.map((p) => p.hot));
}

/** Inclusive local calendar walk. */
function eachDay(from: Date, to: Date, fn: (y: number, m0: number, d: number) => void) {
  const cursor = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const end = new Date(to.getFullYear(), to.getMonth(), to.getDate());
  while (cursor.getTime() <= end.getTime()) {
    fn(cursor.getFullYear(), cursor.getMonth(), cursor.getDate());
    cursor.setDate(cursor.getDate() + 1);
  }
}

function assertResponseShape(report: Awaited<ReturnType<typeof buildSummary>>) {
  expect(RING_KEYS).toEqual(expect.arrayContaining(report.rings.map((r) => r.key)));
  expect(report.rings).toHaveLength(6);
  for (const ring of report.rings) {
    expect(ring).toEqual(
      expect.objectContaining({
        key: expect.any(String),
        label: expect.any(String),
        delta: expect.any(String),
        daysLogged: expect.any(Number),
        series: expect.any(Array),
        reference: expect.objectContaining({
          value: expect.any(Number),
          label: expect.any(String),
        }),
      })
    );
    expect(ring.pct === null || typeof ring.pct === 'number').toBe(true);
  }

  expect(report.stats.map((s) => s.key)).toEqual([...STAT_KEYS]);
  for (const stat of report.stats) {
    expect(stat).toEqual(
      expect.objectContaining({
        label: expect.any(String),
        unit: expect.any(String),
        trend: expect.any(Array),
      })
    );
    expect(stat.value === null || typeof stat.value === 'string').toBe(true);
  }

  expect(typeof report.periodStart).toBe('string');
  expect(typeof report.periodEnd).toBe('string');
  expect(typeof report.coverageStart).toBe('string');
  expect(typeof report.coverageEnd).toBe('string');
  expect(typeof report.seriesStart).toBe('string');
  expect(typeof report.canGoBack).toBe('boolean');
  expect(typeof report.canGoForward).toBe('boolean');
  expect(typeof report.calibrating).toBe('boolean');
  expect(typeof report.daysLogged).toBe('number');
  expect(typeof report.daysElapsed).toBe('number');
  expect(typeof report.cohortLabel).toBe('string');
  expect(typeof report.referenceNote).toBe('string');
  expect(Array.isArray(report.insights)).toBe(true);
  expect(Array.isArray(report.weekBreakdown)).toBe(true);
  expect(typeof report.anuReflection).toBe('string');
  expect(report.anuReflection.length).toBeGreaterThan(0);
}

beforeEach(() => {
  vi.clearAllMocks();
  emptyStores();
});

describe('buildSummary — empty / sparse', () => {
  const now = localDay(2024, 5, 20, 15);
  const anchor = localDay(2024, 4, 1); // 1 May — past calibration window

  it('returns a full shape with null rings/stats and empty insights when nothing logged', async () => {
    const report = await buildSummary(USER_ID, anchor, 'weekly', 0, now);

    assertResponseShape(report);
    expect(report.period).toBe('weekly');
    expect(report.offset).toBe(0);
    expect(report.daysLogged).toBe(0);
    expect(report.calibrating).toBe(false);
    expect(report.insights).toEqual([]);
    expect(report.weekBreakdown).toEqual([]);
    expect(report.rings.every((r) => r.pct === null)).toBe(true);
    expect(report.stats.every((s) => s.value === null)).toBe(true);
    expect(report.anuReflection).toMatch(/don't have enough|check-ins/i);
    expect(report.referenceNote).toMatch(/typical level/i);
    expect(report.referenceNote).not.toMatch(/your usual/);
  });

  it('marks brand-new users (anchor = today) as calibrating with no back navigation', async () => {
    const sameDay = localDay(2024, 5, 20, 10);
    installFixture([dayBundle(2024, 5, 20)]);
    const report = await buildSummary(USER_ID, sameDay, 'daily', 0, sameDay);

    expect(report.period).toBe('daily');
    expect(report.offset).toBe(0);
    expect(report.canGoBack).toBe(false);
    expect(report.canGoForward).toBe(false);
    expect(report.calibrating).toBe(true);
    expect(report.daysElapsed).toBe(1);
    expect(report.periodStart).toBe('2024-06-20');
    // daysLogged > 0 so reflection uses the calibrating branch (not the empty-day copy).
    expect(report.anuReflection).toMatch(/1 day in|still learning/i);
  });

  it('clamps oversized daily offset and still queries all six log models', async () => {
    const report = await buildSummary(USER_ID, anchor, 'daily', 999, now);

    expect(report.period).toBe('daily');
    expect(report.offset).toBeLessThan(999);
    expect(report.canGoBack).toBe(false);
    expect(report.canGoForward).toBe(true);
    expect(sleepFindMany).toHaveBeenCalledTimes(1);
    expect(energyFindMany).toHaveBeenCalledTimes(1);
    expect(stressFindMany).toHaveBeenCalledTimes(1);
    expect(moodFindMany).toHaveBeenCalledTimes(1);
    expect(brainFogFindMany).toHaveBeenCalledTimes(1);
    expect(hotFlashFindMany).toHaveBeenCalledTimes(1);

    const sleepArgs = sleepFindMany.mock.calls[0]![0] as {
      where: { userId: string; loggedAt: { gte: Date; lt: Date } };
    };
    expect(sleepArgs.where.userId).toBe(USER_ID);
    expect(sleepArgs.where.loggedAt.gte).toBeInstanceOf(Date);
  });
});

describe('buildSummary — rich daily week', () => {
  // Thu 20 Jun 2024. Anchor far enough back that calibrating is false.
  const now = localDay(2024, 5, 20, 16);
  const anchor = localDay(2024, 4, 1);

  /**
   * Steady "usual" on Jun 6–19, then a mixed Jun 20 so above/below/typical
   * statuses and personal-baseline copy all fire.
   */
  function installRichDailyFixture() {
    const parts: ReturnType<typeof dayBundle>[] = [];

    // Volatility + baseline window: mostly steady high scores.
    eachDay(localDay(2024, 5, 6), localDay(2024, 5, 19), (y, m0, d) => {
      parts.push(
        dayBundle(y, m0, d, {
          sleepCategory: 'I woke up 1–2 times', // 70
          energyCategory: 'Slightly low', // 60
          stressCategory: 'Manageable', // 75
          moodCategory: 'Calm', // 100
          focusCategory: 'Slightly distracted', // 70
          hotFlashCategory: '1–2', // 70
          hotFlashCount: null, // exercise HOT_FLASH_COUNTS fallback
          sleepHours: '6to7',
        })
      );
    });

    // Selected day: sleep/focus much worse (pair insight), energy better, stress typical-ish.
    parts.push(
      dayBundle(2024, 5, 20, {
        sleepCategory: 'I barely slept', // 10 — below usual
        energyCategory: 'Fresh and active', // 100 — above usual
        stressCategory: 'Manageable', // 75 — typical
        moodFeeling: 2, // five-point path → 25 — below
        moodCategory: null,
        moodShift: null,
        focusCategory: 'Brain fog', // 25 — below (pairs with sleep)
        hotFlashCategory: 'More than 5', // 0 — below (pairs with stress? stress is typical)
        hotFlashCount: 7,
        sleepHours: 'lt5',
        sleepQuality: null,
      })
    );

    // Alternate scoring paths: one historical sleep via quality only; one mood via moodShift.
    parts.push({
      sleep: {
        loggedAt: localDay(2024, 5, 15, 22),
        quality: 5,
        category: null,
        hours: null,
      },
      energy: { date: dateOnly(2024, 5, 15), category: 'Slightly low' },
      stress: { date: dateOnly(2024, 5, 15), category: 'Manageable' },
      mood: {
        loggedAt: localDay(2024, 5, 18, 20),
        feeling: null,
        category: null,
        moodShift: 'No, mood was stable',
      },
      focus: { date: dateOnly(2024, 5, 15), category: 'Slightly distracted' },
      hot: { date: dateOnly(2024, 5, 15), category: '1–2', count: null },
    });

    installFixture(parts);
  }

  it('builds personal baselines, stats, and daily insights from a dense trailing week', async () => {
    installRichDailyFixture();
    const report = await buildSummary(USER_ID, anchor, 'daily', 0, now);

    assertResponseShape(report);
    expect(report.period).toBe('daily');
    expect(report.offset).toBe(0);
    expect(report.periodStart).toBe('2024-06-20');
    expect(report.seriesStart).toBe('2024-06-14'); // trailing 7 days ending today
    expect(report.calibrating).toBe(false);
    expect(report.daysLogged).toBeGreaterThan(0);
    expect(report.canGoForward).toBe(false);
    expect(report.canGoBack).toBe(true);

    const sleep = report.rings.find((r) => r.key === 'sleep')!;
    expect(sleep.reference.label).toBe('your usual');
    expect(sleep.pct).not.toBeNull();
    expect(sleep.delta).toMatch(/usual|Better|Below|Typical/i);
    expect(sleep.series).toHaveLength(7);

    expect(report.referenceNote).toMatch(/your usual/i);

    const avgSleep = report.stats.find((s) => s.key === 'avgSleep')!;
    expect(avgSleep.label).toBe('Sleep');
    expect(avgSleep.value).toMatch(/^\d+\.\d$/);
    expect(avgSleep.unit).toBe('hrs');

    const hot = report.stats.find((s) => s.key === 'hotFlashes')!;
    expect(hot.value).not.toBeNull();
    expect(hot.unit).toMatch(/episodes?/);

    const wellness = report.stats.find((s) => s.key === 'wellness')!;
    expect(wellness.value).not.toBeNull();
    expect(wellness.unit).toBe('/100');

    expect(report.insights.length).toBeGreaterThan(0);
    for (const insight of report.insights) {
      expect(['positive', 'attention', 'neutral']).toContain(insight.tone);
      expect(insight.title.length).toBeGreaterThan(0);
      expect(insight.body.length).toBeGreaterThan(0);
    }
    // sleep+focus both below → pair insight path
    expect(report.insights.some((i) => i.title === 'Moving together' || i.tone === 'attention')).toBe(
      true
    );
    expect(report.anuReflection).toMatch(/today|held up|strain|check-ins/i);
    expect(report.weekBreakdown).toEqual([]);
  });

  it('uses cohort reference note when the selected day has no personal baseline yet', async () => {
    // Only logs on the selected day — no trailing week history.
    installFixture([
      dayBundle(2024, 5, 20, {
        sleepCategory: 'I slept well',
        energyCategory: 'Fresh and active',
      }),
    ]);

    const report = await buildSummary(USER_ID, anchor, 'daily', 0, now);
    const withPct = report.rings.filter((r) => r.pct != null);
    expect(withPct.length).toBeGreaterThan(0);
    expect(withPct.every((r) => r.reference.label === 'typical')).toBe(true);
    expect(withPct.every((r) => r.delta === 'No baseline yet')).toBe(true);
    expect(report.referenceNote).toMatch(/typical level for/);
    expect(report.referenceNote).toMatch(/own baseline/);
  });

  it('offset 1 looks at yesterday and allows forward navigation', async () => {
    installRichDailyFixture();
    const report = await buildSummary(USER_ID, anchor, 'daily', 1, now);

    expect(report.offset).toBe(1);
    expect(report.periodStart).toBe('2024-06-19');
    expect(report.canGoForward).toBe(true);
    expect(report.daysLogged).toBeGreaterThan(0);
  });
});

describe('buildSummary — weekly', () => {
  const now = localDay(2024, 5, 20, 12);
  const anchor = localDay(2024, 4, 1);

  function installWeeklyTrendFixture() {
    const parts: ReturnType<typeof dayBundle>[] = [];

    // Previous week Jun 10–16: low scores → current week looks improved.
    eachDay(localDay(2024, 5, 10), localDay(2024, 5, 16), (y, m0, d) => {
      parts.push(
        dayBundle(y, m0, d, {
          sleepCategory: 'I barely slept',
          energyCategory: 'Very tired',
          stressCategory: 'I feel overwhelmed',
          moodCategory: 'Sad',
          focusCategory: 'Unable to concentrate',
          hotFlashCategory: 'More than 5',
          hotFlashCount: 6,
          sleepHours: 'lt5',
        })
      );
    });

    // Current week Mon 17 – Thu 20: high scores.
    eachDay(localDay(2024, 5, 17), localDay(2024, 5, 20), (y, m0, d) => {
      parts.push(
        dayBundle(y, m0, d, {
          sleepCategory: 'I slept well',
          energyCategory: 'Fresh and active',
          stressCategory: 'Low stress',
          moodCategory: 'Calm',
          focusCategory: 'Clear and focused',
          hotFlashCategory: 'None',
          hotFlashCount: 0,
          sleepHours: 'gt8',
        })
      );
    });

    installFixture(parts);
  }

  it('scores the current week against the prior week with cohort references', async () => {
    installWeeklyTrendFixture();
    const report = await buildSummary(USER_ID, anchor, 'weekly', 0, now);

    assertResponseShape(report);
    expect(report.period).toBe('weekly');
    expect(report.periodStart).toBe('2024-06-17');
    expect(report.periodEnd).toBe('2024-06-23');
    expect(report.coverageEnd).toBe('2024-06-20');
    expect(report.seriesStart).toBe('2024-06-17');
    expect(report.daysElapsed).toBe(4);
    expect(report.calibrating).toBe(false);
    expect(report.weekBreakdown).toEqual([]);

    for (const ring of report.rings) {
      expect(ring.reference.label).toBe('typical');
      expect(ring.pct).not.toBeNull();
      expect(ring.daysLogged).toBeGreaterThan(0);
      expect(ring.series).toHaveLength(7); // full Mon–Sun width
      // Future Fri–Sun columns stay null
      expect(ring.series.slice(4).every((v) => v === null)).toBe(true);
    }

    // Improving path should surface a positive insight.
    expect(report.insights.some((i) => i.tone === 'positive')).toBe(true);
    expect(report.stats.find((s) => s.key === 'avgSleep')!.label).toBe('Avg sleep');
    expect(report.anuReflection).toMatch(/this week|care path|holding up/i);
    expect(report.referenceNote).toMatch(/typical level for/);
    expect(report.referenceNote).not.toMatch(/own baseline/);
  });

  it('offset 1 returns the previous full week with forward navigation', async () => {
    installWeeklyTrendFixture();
    const report = await buildSummary(USER_ID, anchor, 'weekly', 1, now);

    expect(report.offset).toBe(1);
    expect(report.periodStart).toBe('2024-06-10');
    expect(report.periodEnd).toBe('2024-06-16');
    expect(report.coverageEnd).toBe('2024-06-16');
    expect(report.daysElapsed).toBe(7);
    expect(report.canGoForward).toBe(true);
    expect(report.daysLogged).toBe(7);
  });

  it('surfaces worsening deltas when the prior week was stronger', async () => {
    const parts: ReturnType<typeof dayBundle>[] = [];
    eachDay(localDay(2024, 5, 10), localDay(2024, 5, 16), (y, m0, d) => {
      parts.push(dayBundle(y, m0, d)); // high defaults
    });
    eachDay(localDay(2024, 5, 17), localDay(2024, 5, 20), (y, m0, d) => {
      parts.push(
        dayBundle(y, m0, d, {
          sleepCategory: 'I barely slept',
          energyCategory: 'Very tired',
          stressCategory: 'Very stressful',
          moodCategory: 'Anxious',
          focusCategory: 'Brain fog',
          hotFlashCategory: 'More than 5',
          hotFlashCount: 8,
        })
      );
    });
    installFixture(parts);

    const report = await buildSummary(USER_ID, anchor, 'weekly', 0, now);
    expect(report.insights.some((i) => i.tone === 'attention')).toBe(true);
    expect(report.rings.some((r) => r.delta.includes('pts') || r.delta === 'Steady')).toBe(true);
  });
});

describe('buildSummary — monthly', () => {
  const now = localDay(2024, 5, 20, 12);
  const anchor = localDay(2024, 2, 15); // 15 Mar — several months of history

  function installMonthlyFixture(mode: 'building' | 'drifting') {
    const parts: ReturnType<typeof dayBundle>[] = [];

    // May (previous month) — moderate baseline for period deltas.
    eachDay(localDay(2024, 4, 1), localDay(2024, 4, 31), (y, m0, d) => {
      parts.push(
        dayBundle(y, m0, d, {
          sleepCategory: 'I woke up 1–2 times',
          energyCategory: 'Slightly low',
          stressCategory: 'Manageable',
          moodCategory: "I don't know",
          focusCategory: 'Slightly distracted',
          hotFlashCategory: '1–2',
          hotFlashCount: 2,
          sleepHours: '6to7',
        })
      );
    });

    // June 1–20: front half vs back half differ for trajectory.
    eachDay(localDay(2024, 5, 1), localDay(2024, 5, 20), (y, m0, d) => {
      const early = d <= 10;
      const good = mode === 'building' ? !early : early;
      parts.push(
        good
          ? dayBundle(y, m0, d, {
              sleepCategory: 'I slept well',
              energyCategory: 'Fresh and active',
              stressCategory: 'Low stress',
              moodCategory: 'Calm',
              focusCategory: 'Clear and focused',
              hotFlashCategory: 'None',
              hotFlashCount: 0,
              sleepHours: '7to8',
            })
          : dayBundle(y, m0, d, {
              sleepCategory: 'I barely slept',
              energyCategory: 'Very tired',
              stressCategory: 'I feel overwhelmed',
              moodCategory: 'Emotionally numb',
              focusCategory: 'Unable to concentrate',
              hotFlashCategory: 'More than 5',
              hotFlashCount: 6,
              sleepHours: 'lt5',
            })
      );
    });

    installFixture(parts);
  }

  it('fills weekBreakdown and can emit a monthly trajectory insight', async () => {
    installMonthlyFixture('building');
    const report = await buildSummary(USER_ID, anchor, 'monthly', 0, now);

    assertResponseShape(report);
    expect(report.period).toBe('monthly');
    expect(report.periodStart).toBe('2024-06-01');
    expect(report.periodEnd).toBe('2024-06-30');
    expect(report.coverageStart).toBe('2024-06-01');
    expect(report.coverageEnd).toBe('2024-06-20');
    expect(report.daysElapsed).toBe(20);
    expect(report.weekBreakdown.length).toBeGreaterThanOrEqual(3);

    for (const week of report.weekBreakdown) {
      expect(week.startDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(week.endDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(week.daysLogged).toBeGreaterThanOrEqual(0);
      expect(week.wellness === null || typeof week.wellness === 'number').toBe(true);
    }

    // Building trajectory (back half better than front).
    expect(
      report.insights.some((i) => i.title.includes('Building') || i.tone === 'positive')
    ).toBe(true);
    expect(report.anuReflection).toMatch(/month|care path/i);
  });

  it('emits a drifting trajectory when the back half of the month worsens', async () => {
    installMonthlyFixture('drifting');
    const report = await buildSummary(USER_ID, anchor, 'monthly', 0, now);

    expect(report.insights.some((i) => i.title.includes('Drifting') || i.tone === 'attention')).toBe(
      true
    );
  });

  it('offset 1 returns the prior full month', async () => {
    installMonthlyFixture('building');
    const report = await buildSummary(USER_ID, anchor, 'monthly', 1, now);

    expect(report.offset).toBe(1);
    expect(report.periodStart).toBe('2024-05-01');
    expect(report.periodEnd).toBe('2024-05-31');
    expect(report.daysElapsed).toBe(31);
    expect(report.canGoForward).toBe(true);
    expect(report.weekBreakdown.length).toBeGreaterThan(0);
  });
});

describe('buildSummary — period matrix smoke', () => {
  const now = localDay(2024, 5, 20, 12);
  const anchor = localDay(2024, 4, 10);

  const periods: SummaryPeriod[] = ['daily', 'weekly', 'monthly'];

  it.each(periods)('%s offset 0 with sparse single-day logs stays well-formed', async (period) => {
    installFixture([
      dayBundle(2024, 5, 20, {
        sleepCategory: null,
        sleepQuality: 3,
        sleepHours: '5to6',
        moodFeeling: null,
        moodCategory: null,
        moodShift: 'Mild mood changes',
        hotFlashCategory: '3–5',
        hotFlashCount: null,
      }),
    ]);

    const report = await buildSummary(USER_ID, anchor, period, 0, now);
    assertResponseShape(report);
    expect(report.period).toBe(period);
    expect(report.offset).toBe(0);
    expect(report.daysLogged).toBeGreaterThanOrEqual(1);
  });
});

describe('buildSummary — steady / New delta paths', () => {
  const now = localDay(2024, 5, 20, 12);
  const anchor = localDay(2024, 4, 1);

  it('labels weekly rings Steady when period-over-period move is tiny', async () => {
    const parts: ReturnType<typeof dayBundle>[] = [];
    eachDay(localDay(2024, 5, 10), localDay(2024, 5, 20), (y, m0, d) => {
      parts.push(
        dayBundle(y, m0, d, {
          sleepCategory: 'I woke up 1–2 times',
          energyCategory: 'Slightly low',
          stressCategory: 'Manageable',
          moodCategory: 'Calm',
          focusCategory: 'Slightly distracted',
          hotFlashCategory: '1–2',
          hotFlashCount: 1,
        })
      );
    });
    installFixture(parts);

    const report = await buildSummary(USER_ID, anchor, 'weekly', 0, now);
    expect(report.rings.some((r) => r.delta === 'Steady')).toBe(true);
  });

  it('labels weekly rings New when there is no prior-period data', async () => {
    // Only current week has logs; prev week empty → "New".
    const parts: ReturnType<typeof dayBundle>[] = [];
    eachDay(localDay(2024, 5, 17), localDay(2024, 5, 20), (y, m0, d) => {
      parts.push(dayBundle(y, m0, d));
    });
    installFixture(parts);

    const report = await buildSummary(USER_ID, anchor, 'weekly', 0, now);
    expect(report.rings.filter((r) => r.pct != null).every((r) => r.delta === 'New')).toBe(true);
    // No prior delta → attention insight may still fire via below-cohort fallback.
    expect(Array.isArray(report.insights)).toBe(true);
  });
});

describe('buildSummary — remaining copy branches', () => {
  const now = localDay(2024, 5, 20, 16);
  const anchor = localDay(2024, 4, 1);

  /** Steady baseline Jun 6–19 at fixed categories. */
  function baselineParts(overrides: FixtureOpts = {}) {
    const parts: ReturnType<typeof dayBundle>[] = [];
    eachDay(localDay(2024, 5, 6), localDay(2024, 5, 19), (y, m0, d) => {
      parts.push(
        dayBundle(y, m0, d, {
          sleepCategory: 'I woke up 1–2 times', // 70
          energyCategory: 'Slightly low', // 60
          stressCategory: 'Manageable', // 75
          moodCategory: 'Calm', // 100
          focusCategory: 'Slightly distracted', // 70
          hotFlashCategory: '1–2', // 70
          ...overrides,
        })
      );
    });
    return parts;
  }

  it('emits a steady-day insight when every scored ring is typical', async () => {
    const parts = baselineParts();
    parts.push(
      dayBundle(2024, 5, 20, {
        sleepCategory: 'I woke up 1–2 times',
        energyCategory: 'Slightly low',
        stressCategory: 'Manageable',
        moodCategory: 'Calm',
        focusCategory: 'Slightly distracted',
        hotFlashCategory: '1–2',
        hotFlashCount: 1,
      })
    );
    installFixture(parts);

    const report = await buildSummary(USER_ID, anchor, 'daily', 0, now);
    expect(report.insights.some((i) => i.tone === 'neutral' && i.title === 'A steady day')).toBe(
      true
    );
  });

  it('uses single-metric Below-your-usual copy when no pair matches', async () => {
    const parts = baselineParts();
    parts.push(
      dayBundle(2024, 5, 20, {
        sleepCategory: 'I barely slept', // 10
        energyCategory: 'Slightly low',
        stressCategory: 'Manageable',
        moodCategory: 'Calm',
        focusCategory: 'Slightly distracted',
        hotFlashCategory: '1–2',
        hotFlashCount: 1,
      })
    );
    installFixture(parts);

    const report = await buildSummary(USER_ID, anchor, 'daily', 0, now);
    expect(report.insights.some((i) => i.title === 'Below your usual')).toBe(true);
    expect(report.insights.every((i) => i.title !== 'Moving together')).toBe(true);
  });

  it('reflects a single logged metric on daily and weekly', async () => {
    sleepFindMany.mockResolvedValue([
      {
        loggedAt: localDay(2024, 5, 20, 8),
        quality: null,
        category: 'I slept well',
        hours: '7to8',
      },
      {
        loggedAt: localDay(2024, 5, 18, 8),
        quality: null,
        category: 'I woke up 1–2 times',
        hours: '6to7',
      },
    ]);
    energyFindMany.mockResolvedValue([]);
    stressFindMany.mockResolvedValue([]);
    moodFindMany.mockResolvedValue([]);
    brainFogFindMany.mockResolvedValue([]);
    hotFlashFindMany.mockResolvedValue([]);

    const daily = await buildSummary(USER_ID, anchor, 'daily', 0, now);
    expect(daily.anuReflection).toMatch(/only thing I have for today/i);

    const weekly = await buildSummary(USER_ID, anchor, 'weekly', 0, now);
    expect(weekly.anuReflection).toMatch(/clearest signal I have this week/i);
  });

  it('sorts multiple above-baseline rings when ranking the strongest', async () => {
    const parts = baselineParts();
    parts.push(
      dayBundle(2024, 5, 20, {
        sleepCategory: 'I slept well', // 100 vs ~70
        energyCategory: 'Fresh and active', // 100 vs ~60
        stressCategory: 'Manageable',
        moodCategory: 'Calm',
        focusCategory: 'Slightly distracted',
        hotFlashCategory: '1–2',
        hotFlashCount: 1,
      })
    );
    installFixture(parts);

    const report = await buildSummary(USER_ID, anchor, 'daily', 0, now);
    expect(report.insights.some((i) => i.title === 'Above your usual')).toBe(true);
  });
});
