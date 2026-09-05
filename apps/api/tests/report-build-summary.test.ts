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
const quickSymptomFindMany = vi.fn();
const jointFindMany = vi.fn();

vi.mock('@anuva/database', () => ({
  prisma: {
    sleepLog: { findMany: (...args: unknown[]) => sleepFindMany(...args) },
    energyLog: { findMany: (...args: unknown[]) => energyFindMany(...args) },
    stressLog: { findMany: (...args: unknown[]) => stressFindMany(...args) },
    moodLog: { findMany: (...args: unknown[]) => moodFindMany(...args) },
    brainFogLog: { findMany: (...args: unknown[]) => brainFogFindMany(...args) },
    hotFlashDailyLog: { findMany: (...args: unknown[]) => hotFlashFindMany(...args) },
    quickSymptomLog: { findMany: (...args: unknown[]) => quickSymptomFindMany(...args) },
    // Joints & Stiffness is fetched with the rest but is not a ring; see src/report/joints.ts.
    jointLog: { findMany: (...args: unknown[]) => jointFindMany(...args) },
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
  quickSymptomFindMany.mockResolvedValue([]);
  jointFindMany.mockResolvedValue([]);
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
  quickSymptomFindMany.mockResolvedValue([]);
  jointFindMany.mockResolvedValue([]);
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
      })
    );
    expect(ring.pct === null || typeof ring.pct === 'number').toBe(true);
    // A score never travels without the word that says which way it points.
    expect(ring.band === null || typeof ring.band === 'string').toBe(true);
    expect((ring.pct == null) === (ring.band == null)).toBe(true);
    expect(ring.detail === null || typeof ring.detail === 'string').toBe(true);
    expect(['positive', 'attention', 'neutral', 'none']).toContain(ring.deltaTone);
    // A ranking field must never let "no comparison" read as "no movement".
    expect(ring.deltaValue === null || typeof ring.deltaValue === 'number').toBe(true);
    if (ring.deltaTone === 'none') expect(ring.deltaValue).toBeNull();
    // A symptom day is a logged day, so it can never outnumber them.
    expect(Number.isInteger(ring.symptomDays)).toBe(true);
    expect(ring.symptomDays).toBeLessThanOrEqual(ring.daysLogged);
    // Null reference = no comparable history = no dot drawn.
    if (ring.reference !== null) {
      expect(ring.reference).toEqual(
        expect.objectContaining({ value: expect.any(Number), label: expect.any(String) })
      );
    }
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
  expect(typeof report.periodLength).toBe('number');
  expect(typeof report.daysElapsedInPeriod).toBe('number');
  expect(report.daysElapsedInPeriod).toBeLessThanOrEqual(report.periodLength);
  // The completeness denominator must never collapse to the coverage window,
  // which is what produced "1 of 1 days logged" for a user who joined today.
  expect(report.daysElapsedInPeriod).toBeGreaterThanOrEqual(report.daysElapsed);
  expect(typeof report.trackingLabel).toBe('string');
  expect(report.trackingNote === null || typeof report.trackingNote === 'string').toBe(true);
  expect(['empty', 'insufficient', 'ready']).toContain(report.dataState);
  expect(typeof report.referenceNote).toBe('string');
  // No population claim may reach the client.
  expect(report.referenceNote).not.toMatch(/typical|population|Indian women/i);
  expect(report.rings.every((r) => r.reference?.label !== 'typical')).toBe(true);
  // Headline — the composite never travels without its word, and never
  // carries a word without a score behind it.
  expect((report.headline.score == null) === (report.headline.band == null)).toBe(true);
  expect(report.headline.headline.length).toBeGreaterThan(0);
  expect(report.headline.body.length).toBeGreaterThan(0);
  if (report.headline.score != null) {
    expect(report.headline.score).toBeGreaterThanOrEqual(0);
    expect(report.headline.score).toBeLessThanOrEqual(100);
    // Same number as the wellness stat card — two composites on one page that
    // disagree is the bug this assertion exists to catch.
    expect(String(report.headline.score)).toBe(
      report.stats.find((stat) => stat.key === 'wellness')!.value
    );
  }

  // Day balance — four buckets that account for every covered day, and nothing
  // at all on daily, which is a single day with a headline instead.
  const balance = report.dayBalance;
  for (const count of [balance.good, balance.okay, balance.hard, balance.untracked]) {
    expect(Number.isInteger(count)).toBe(true);
    expect(count).toBeGreaterThanOrEqual(0);
  }
  const balanceTotal = balance.good + balance.okay + balance.hard + balance.untracked;
  expect(balanceTotal).toBe(report.period === 'daily' ? 0 : report.daysElapsed);

  // Glance tiles are a monthly device; the other periods must not carry them.
  expect(Array.isArray(report.glance)).toBe(true);
  if (report.period !== 'monthly') expect(report.glance).toHaveLength(0);
  for (const tile of report.glance) {
    expect(tile.label.length).toBeGreaterThan(0);
    expect(tile.value === null || typeof tile.value === 'string').toBe(true);
    expect(['positive', 'attention', 'improving', 'info', 'neutral']).toContain(tile.tone);
    if (tile.ringKey !== null) expect(RING_KEYS).toContain(tile.ringKey);
  }

  // A suggestion is advice about today; a week has nothing to act on tonight.
  if (report.period !== 'daily') expect(report.suggestion).toBeNull();
  if (report.suggestion) expect(report.suggestion.body.length).toBeGreaterThan(0);

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
    expect(report.dataState).toBe('empty');
    expect(report.calibrating).toBe(false);
    expect(report.insights).toEqual([]);
    expect(report.weekBreakdown).toEqual([]);
    expect(report.rings.every((r) => r.pct === null)).toBe(true);
    expect(report.rings.every((r) => r.reference === null)).toBe(true);
    expect(report.stats.every((s) => s.value === null)).toBe(true);
    expect(report.anuReflection).toMatch(/don't have enough|check-ins/i);
    expect(report.referenceNote).toMatch(/No comparison dots yet/i);
    expect(report.trackingLabel).toBe('0 of 4 days tracked so far'); // Mon 17 – Thu 20
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
    expect(report.periodLength).toBe(1);
    expect(report.trackingLabel).toBe('6 of 6 check-ins logged');
    expect(report.periodStart).toBe('2024-06-20');
    // daysLogged > 0 so reflection uses the calibrating branch (not the empty-day copy).
    expect(report.anuReflection).toMatch(/1 day in|still learning/i);
  });

  it('is still calibrating on day 10 and settled on day 14', async () => {
    // The window is two weeks, not one: a user ten days in used to fall out of
    // calibration on the home card while the numbers were still moving.
    installFixture([dayBundle(2024, 5, 20)]);

    const dayTen = await buildSummary(USER_ID, localDay(2024, 5, 11), 'daily', 0, now);
    expect(dayTen.calibrating).toBe(true);

    const dayFourteen = await buildSummary(USER_ID, localDay(2024, 5, 7), 'daily', 0, now);
    expect(dayFourteen.calibrating).toBe(false);
  });

  it('clamps oversized daily offset and still queries every log model', async () => {
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
    expect(jointFindMany).toHaveBeenCalledTimes(1);

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
    expect(sleep.reference?.label).toBe('your usual');
    expect(sleep.pct).not.toBeNull();
    expect(sleep.band).toBe('Barely slept'); // score 10 — direction is spelled out
    expect(sleep.delta).toMatch(/usual|Better|Below|Typical/i);
    expect(sleep.series).toHaveLength(7);

    const stress = report.rings.find((r) => r.key === 'stress')!;
    expect(stress.label).toBe('Stress');
    expect(stress.band).toBe('Manageable'); // 75 must never read as "75% stressed"

    const heat = report.rings.find((r) => r.key === 'hotFlashes')!;
    expect(heat.label).toBe('Heat episodes');
    expect(heat.band).toBe('High'); // score 0 — "More than 5"
    expect(heat.detail).toMatch(/episodes? today$/);

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

  it('draws no reference dot at all when the selected day has no personal baseline yet', async () => {
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
    // Previously fell back to the population line; that borrowed comparison is gone.
    expect(withPct.every((r) => r.reference === null)).toBe(true);
    expect(withPct.every((r) => r.delta === 'No baseline yet')).toBe(true);
    expect(withPct.every((r) => r.deltaTone === 'none')).toBe(true);
    expect(report.referenceNote).toMatch(/No comparison dots yet/i);
  });

  it('withholds a baseline until the trailing window has enough days behind it', async () => {
    // Two prior days only — under the 3-day floor, so no "your usual" claim.
    installFixture([
      dayBundle(2024, 5, 18),
      dayBundle(2024, 5, 19),
      dayBundle(2024, 5, 20, { sleepCategory: 'I barely slept' }),
    ]);

    const report = await buildSummary(USER_ID, anchor, 'daily', 0, now);
    expect(report.rings.every((r) => r.reference === null)).toBe(true);
    expect(report.rings.filter((r) => r.pct != null).every((r) => r.delta === 'No baseline yet')).toBe(
      true
    );
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
    expect(report.periodLength).toBe(7);
    expect(report.daysElapsedInPeriod).toBe(4);
    expect(report.trackingLabel).toBe('4 of 4 days tracked so far');
    expect(report.dataState).toBe('ready');
    expect(report.calibrating).toBe(false);
    expect(report.weekBreakdown).toEqual([]);

    for (const ring of report.rings) {
      // The dot is the user's own last week now — never a population line.
      expect(ring.reference?.label).toBe('last week');
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
    expect(report.referenceNote).toMatch(/last week/);

    // Every point delta names its own direction — "+30 pts" alone is unreadable.
    const moved = report.rings.filter((r) => r.delta.includes('pts'));
    expect(moved.length).toBeGreaterThan(0);
    for (const ring of moved) {
      expect(ring.delta).toMatch(/· (improving|worsened)$/);
      expect(ring.deltaTone).toBe(ring.delta.includes('improving') ? 'positive' : 'attention');
    }
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
    // A past period is complete, so the denominator is the whole period.
    expect(report.trackingLabel).toBe('7 of 7 days tracked');
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
    expect(report.rings.some((r) => r.delta.includes('pts · worsened'))).toBe(true);
    expect(report.rings.some((r) => r.deltaTone === 'attention')).toBe(true);
  });
});

describe('buildSummary — minimum data before a trend claim', () => {
  const now = localDay(2024, 5, 20, 12); // Thu
  const anchor = localDay(2024, 4, 1);

  it('refuses to claim a weekly trend from a single logged day', async () => {
    installFixture([dayBundle(2024, 5, 20)]);
    const report = await buildSummary(USER_ID, anchor, 'weekly', 0, now);

    expect(report.dataState).toBe('insufficient');
    expect(report.insights).toHaveLength(1);
    expect(report.insights[0]!.title).toBe('Keep tracking');
    expect(report.insights[0]!.tone).toBe('neutral');
    // No trend copy, no direction word, no borrowed comparison.
    expect(report.insights.some((i) => /Improving|Needs attention/.test(i.title))).toBe(false);
    expect(report.rings.every((r) => !r.delta.includes('pts'))).toBe(true);
    expect(report.rings.every((r) => r.reference === null)).toBe(true);
    expect(report.anuReflection).toMatch(/Keep tracking/i);
    // The numbers themselves still show — only the interpretation is withheld.
    expect(report.rings.some((r) => r.pct != null)).toBe(true);
    expect(report.trackingLabel).toBe('1 of 4 days tracked so far');
  });

  it('withholds the delta when the previous week is too thin, even with a full current week', async () => {
    const parts: ReturnType<typeof dayBundle>[] = [];
    parts.push(dayBundle(2024, 5, 16)); // one day of the prior week only
    eachDay(localDay(2024, 5, 17), localDay(2024, 5, 20), (y, m0, d) => {
      parts.push(dayBundle(y, m0, d, { sleepCategory: 'I barely slept' }));
    });
    installFixture(parts);

    const report = await buildSummary(USER_ID, anchor, 'weekly', 0, now);
    expect(report.dataState).toBe('ready');
    expect(report.rings.every((r) => r.delta === 'Not enough to compare yet')).toBe(true);
    expect(report.rings.every((r) => r.reference === null)).toBe(true);
  });

  it('needs 8 logged days before claiming a monthly trend', async () => {
    const parts: ReturnType<typeof dayBundle>[] = [];
    eachDay(localDay(2024, 5, 1), localDay(2024, 5, 5), (y, m0, d) => {
      parts.push(dayBundle(y, m0, d));
    });
    installFixture(parts);

    const report = await buildSummary(USER_ID, anchor, 'monthly', 0, now);
    expect(report.dataState).toBe('insufficient');
    expect(report.insights[0]!.title).toBe('Keep tracking');
    expect(report.insights[0]!.body).toMatch(/at least 8/);
  });
});

describe('buildSummary — tracking completeness', () => {
  const now = localDay(2024, 5, 20, 12); // Thu 20 Jun

  it('counts against the period, not the coverage window, for a mid-week signup', async () => {
    const anchor = localDay(2024, 5, 19); // joined yesterday, mid-week
    installFixture([dayBundle(2024, 5, 19), dayBundle(2024, 5, 20)]);

    const report = await buildSummary(USER_ID, anchor, 'weekly', 0, now);

    // Coverage is 2 days (Wed–Thu); the week has run 4 (Mon–Thu).
    expect(report.coverageStart).toBe(ymd(anchor));
    expect(report.daysElapsed).toBe(2);
    expect(report.daysElapsedInPeriod).toBe(4);
    expect(report.trackingLabel).toBe('2 of 4 days tracked so far');
    expect(report.trackingNote).toMatch(/joined on 19 Jun/);
  });

  it('leaves the note off when the user was there for the whole period', async () => {
    const anchor = localDay(2024, 4, 1);
    installFixture([dayBundle(2024, 5, 20)]);

    const report = await buildSummary(USER_ID, anchor, 'weekly', 0, now);
    expect(report.trackingNote).toBeNull();
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
    expect(report.periodLength).toBe(30);
    expect(report.trackingLabel).toBe('20 of 20 days tracked so far');
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
    expect(report.periodLength).toBe(31);
    expect(report.trackingLabel).toBe('31 of 31 days tracked');
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
    // "Steady" alone leaves the reader guessing what it is steady against.
    expect(report.rings.some((r) => r.delta === 'Steady vs last week')).toBe(true);
    expect(report.rings.some((r) => r.deltaTone === 'neutral')).toBe(true);
  });

  it('says this is the first week of data rather than the bare word New', async () => {
    // Only current week has logs; prev week empty.
    const parts: ReturnType<typeof dayBundle>[] = [];
    eachDay(localDay(2024, 5, 17), localDay(2024, 5, 20), (y, m0, d) => {
      parts.push(dayBundle(y, m0, d));
    });
    installFixture(parts);

    const report = await buildSummary(USER_ID, anchor, 'weekly', 0, now);
    expect(
      report.rings.filter((r) => r.pct != null).every((r) => r.delta === 'First week of data')
    ).toBe(true);
    // The below-cohort fallback is gone: high scores must not draw an attention
    // insight just because they sit under a population line we no longer serve.
    expect(report.insights.every((i) => i.title !== '↓ Needs attention')).toBe(true);
  });

  it('still flags a genuinely low score with no prior period to compare against', async () => {
    const parts: ReturnType<typeof dayBundle>[] = [];
    eachDay(localDay(2024, 5, 17), localDay(2024, 5, 20), (y, m0, d) => {
      parts.push(dayBundle(y, m0, d, { sleepCategory: 'I barely slept' })); // 10
    });
    installFixture(parts);

    const report = await buildSummary(USER_ID, anchor, 'weekly', 0, now);
    expect(report.insights.some((i) => i.title === '↓ Needs attention')).toBe(true);
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
    // Four days of sleep only — enough to clear the weekly floor, so the
    // reflection reaches its single-metric branch rather than "keep tracking".
    sleepFindMany.mockResolvedValue(
      [
        [localDay(2024, 5, 20, 8), 'I slept well', '7to8'],
        [localDay(2024, 5, 19, 8), 'I woke up 1–2 times', '6to7'],
        [localDay(2024, 5, 18, 8), 'I woke up 1–2 times', '6to7'],
        [localDay(2024, 5, 17, 8), 'I slept well', '7to8'],
      ].map(([loggedAt, category, hours]) => ({ loggedAt, quality: null, category, hours }))
    );
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

// ─────────────────────────────────────────────
// Quick-log taps reaching the rings
// ─────────────────────────────────────────────

describe('buildSummary — quick-log taps', () => {
  const now = localDay(2024, 5, 20, 21);
  const anchor = localDay(2024, 4, 1, 9);

  function tap(symptom: string, y: number, m0: number, d: number, hour = 14) {
    return { loggedAt: localDay(y, m0, d, hour), symptom };
  }

  function ringOf(report: Awaited<ReturnType<typeof buildSummary>>, key: string) {
    return report.rings.find((r) => r.key === key)!;
  }

  it('scores a day that carries only taps, so logging is never invisible', async () => {
    emptyStores();
    quickSymptomFindMany.mockResolvedValue([tap('anxiety', 2024, 5, 20)]);

    const report = await buildSummary(USER_ID, anchor, 'daily', 0, now);
    const mood = ringOf(report, 'mood');
    // 70 baseline - 8 for the single tap.
    expect(mood.pct).toBe(62);
    expect(mood.band).not.toBeNull();
  });

  it('knocks an answered day down rather than leaving the answer to stand alone', async () => {
    installFixture([dayBundle(2024, 5, 20, { moodCategory: 'Calm' })]);
    quickSymptomFindMany.mockResolvedValue([
      tap('irritability', 2024, 5, 20, 11),
      tap('irritability', 2024, 5, 20, 15),
      tap('anxiety', 2024, 5, 20, 18),
    ]);

    const report = await buildSummary(USER_ID, anchor, 'daily', 0, now);
    // 'Calm' scores 100; three taps take 24 off it.
    expect(ringOf(report, 'mood').pct).toBe(76);
  });

  it('caps the knock-down so one bad afternoon cannot bottom out a day', async () => {
    installFixture([dayBundle(2024, 5, 20, { moodCategory: 'Calm' })]);
    quickSymptomFindMany.mockResolvedValue(
      Array.from({ length: 9 }, (_, i) => tap('anxiety', 2024, 5, 20, 9 + i))
    );

    const report = await buildSummary(USER_ID, anchor, 'daily', 0, now);
    expect(ringOf(report, 'mood').pct).toBe(70);
  });

  it('never lets taps raise a score', async () => {
    installFixture([dayBundle(2024, 5, 20, { moodCategory: 'Sad' })]);
    const withoutTaps = await buildSummary(USER_ID, anchor, 'daily', 0, now);

    installFixture([dayBundle(2024, 5, 20, { moodCategory: 'Sad' })]);
    quickSymptomFindMany.mockResolvedValue([tap('anxiety', 2024, 5, 20)]);
    const withTaps = await buildSummary(USER_ID, anchor, 'daily', 0, now);

    expect(withTaps.rings.find((r) => r.key === 'mood')!.pct!).toBeLessThan(
      withoutTaps.rings.find((r) => r.key === 'mood')!.pct!
    );
  });

  it('folds chills into the heat ring and leaves hot-flash taps to the daily row', async () => {
    emptyStores();
    quickSymptomFindMany.mockResolvedValue([tap('chills', 2024, 5, 20)]);
    const chills = await buildSummary(USER_ID, anchor, 'daily', 0, now);
    expect(ringOf(chills, 'hotFlashes').pct).toBe(62);

    // Hot-flash taps are already counted in HotFlashDailyLog by the writer, so
    // charging them again here would double-count the same log.
    emptyStores();
    hotFlashFindMany.mockResolvedValue([
      { date: dateOnly(2024, 5, 20), category: '1–2', count: 2 },
    ]);
    quickSymptomFindMany.mockResolvedValue([
      tap('hot_flash', 2024, 5, 20, 12),
      tap('hot_flash', 2024, 5, 20, 16),
    ]);
    const taps = await buildSummary(USER_ID, anchor, 'daily', 0, now);
    expect(ringOf(taps, 'hotFlashes').pct).toBe(70);
  });

  it("scores the heat day on its tap count when that is worse than the answer", async () => {
    emptyStores();
    // Answered "None" in the morning, three taps logged after it.
    hotFlashFindMany.mockResolvedValue([
      { date: dateOnly(2024, 5, 20), category: 'None', count: 3 },
    ]);

    const report = await buildSummary(USER_ID, anchor, 'daily', 0, now);
    expect(ringOf(report, 'hotFlashes').pct).toBe(35);
    // The stat card counts the taps, not the bucket midpoint.
    expect(report.stats.find((st) => st.key === 'hotFlashes')!.value).toBe('3');
  });

  it('leaves metrics the taps say nothing about untouched', async () => {
    installFixture([dayBundle(2024, 5, 20)]);
    quickSymptomFindMany.mockResolvedValue([tap('anxiety', 2024, 5, 20)]);

    const report = await buildSummary(USER_ID, anchor, 'daily', 0, now);
    expect(ringOf(report, 'sleep').pct).toBe(100);
    expect(ringOf(report, 'energy').pct).toBe(100);
    expect(ringOf(report, 'focus').pct).toBe(100);
  });
});

describe('buildSummary — headline, balance, glance, suggestion', () => {
  const now = localDay(2024, 5, 20, 12); // Thu 20 June 2024
  const anchor = localDay(2024, 4, 1); // 1 May — past calibration

  /** All six metrics at their best. */
  const GREAT = {
    sleepCategory: 'I slept well',
    energyCategory: 'Fresh and active',
    stressCategory: 'Low stress',
    moodCategory: 'Calm',
    focusCategory: 'Clear and focused',
    hotFlashCategory: 'None',
    hotFlashCount: 0,
  } as const;

  /** All six at their worst — composite lands in the bottom band. */
  const AWFUL = {
    sleepCategory: 'I barely slept',
    energyCategory: 'Very tired',
    stressCategory: 'I feel overwhelmed',
    moodCategory: 'Emotionally numb',
    focusCategory: 'Unable to concentrate',
    hotFlashCategory: 'More than 5',
    hotFlashCount: 6,
  } as const;

  /** Scores 50 — deliberately mid-ladder, to prove the middle bucket exists. */
  const MIDDLING = {
    sleepCategory: 'I woke up 1–2 times',
    energyCategory: 'Mentally tired, even after sleeping',
    stressCategory: 'Stressful',
    moodCategory: 'Irritated',
    focusCategory: 'Forgetful',
    hotFlashCategory: '1–2',
    hotFlashCount: 2,
  } as const;

  it('bands the day, names what carried it, and offers one thing to try', async () => {
    // Everything strong except sleep, which sits in its bottom two bands.
    installFixture([
      dayBundle(2024, 5, 20, { ...GREAT, sleepCategory: 'I had disturbed sleep' }),
    ]);

    const report = await buildSummary(USER_ID, anchor, 'daily', 0, now);

    assertResponseShape(report);
    // (40 + 100 * 5) / 6 = 90 — the top band.
    expect(report.headline.score).toBe(90);
    expect(report.headline.band).toBe('Great');
    expect(report.headline.headline).toBe('Doing really well');
    // Praises the two strongest and flags the weak one exactly once.
    expect(report.headline.body).toBe(
      'Energy is strong and stress is low. Sleep needs a little extra care.'
    );
    expect(report.suggestion?.title).toBe("Today's nudge");
    expect(report.suggestion?.body).toMatch(/wind(ing)? down/i);
    // One day has no balance to show.
    expect(report.dayBalance).toEqual({ good: 0, okay: 0, hard: 0, untracked: 0 });
    expect(report.glance).toEqual([]);
  });

  it('offers no fix on a day with nothing weak enough to fix', async () => {
    installFixture([dayBundle(2024, 5, 20, GREAT)]);

    const report = await buildSummary(USER_ID, anchor, 'daily', 0, now);

    expect(report.headline.band).toBe('Great');
    expect(report.suggestion?.body).toMatch(/nothing needs fixing/i);
    // Nothing is in a bottom band, so no metric is singled out for care.
    expect(report.headline.body).not.toMatch(/extra care/i);
  });

  it('says nothing is logged rather than scoring an empty day zero', async () => {
    const report = await buildSummary(USER_ID, anchor, 'daily', 0, now);

    expect(report.headline.score).toBeNull();
    expect(report.headline.band).toBeNull();
    expect(report.headline.headline).toBe('Nothing logged yet');
    expect(report.headline.body.length).toBeGreaterThan(0);
    // No day, no advice — a suggestion here would be advice about nothing.
    expect(report.suggestion).toBeNull();
  });

  it('splits the week across the ladder and counts the untracked day', async () => {
    // Week is Mon 17 – Sun 23; coverage runs to Thu 20, so four days count.
    installFixture([
      dayBundle(2024, 5, 17, GREAT), // 100  -> good
      dayBundle(2024, 5, 18, AWFUL), //   8  -> hard
      dayBundle(2024, 5, 19, MIDDLING), // 50 -> okay
      // Thu 20 deliberately unlogged.
    ]);

    const report = await buildSummary(USER_ID, anchor, 'weekly', 0, now);

    assertResponseShape(report);
    expect(report.dayBalance).toEqual({ good: 1, okay: 1, hard: 1, untracked: 1 });
    // (100 + 7.5 + 50) / 3 = 52.5
    expect(report.headline.score).toBe(53);
    expect(report.headline.band).toBe('Okay');
    expect(report.headline.headline).toBe('A mixed week');
    expect(report.glance).toEqual([]);
    expect(report.suggestion).toBeNull();
  });

  it('counts symptom days off the daily scores, not off the window mean', async () => {
    installFixture([
      dayBundle(2024, 5, 17, { ...GREAT, sleepCategory: 'I had disturbed sleep' }),
      dayBundle(2024, 5, 18, { ...GREAT, sleepCategory: 'I had disturbed sleep' }),
      dayBundle(2024, 5, 19, { ...GREAT, sleepCategory: 'I had disturbed sleep' }),
      dayBundle(2024, 5, 20, GREAT),
    ]);

    const report = await buildSummary(USER_ID, anchor, 'weekly', 0, now);
    const sleep = report.rings.find((r) => r.key === 'sleep')!;

    // Mean sleep is (40*3 + 100)/4 = 55, which is a single number that hides
    // the three bad nights the count reports.
    expect(sleep.pct).toBe(55);
    expect(sleep.symptomDays).toBe(3);
    expect(report.rings.find((r) => r.key === 'energy')!.symptomDays).toBe(0);
  });

  describe('monthly glance', () => {
    function installMonth(opts: { withPreviousMonth: boolean }) {
      const parts: ReturnType<typeof dayBundle>[] = [];

      if (opts.withPreviousMonth) {
        // May: mood merely okay, so June's Calm reads as a real improvement.
        eachDay(localDay(2024, 4, 1), localDay(2024, 4, 31), (y, m0, d) => {
          parts.push(
            dayBundle(y, m0, d, {
              sleepCategory: 'I had disturbed sleep',
              energyCategory: 'Fresh and active',
              stressCategory: 'Manageable',
              moodCategory: "I don't know",
              focusCategory: 'Clear and focused',
              hotFlashCategory: 'None',
              hotFlashCount: 0,
            })
          );
        });
      }

      // June 1–20: sleep always disturbed, everything else strong, and three
      // days that carried heat episodes.
      eachDay(localDay(2024, 5, 1), localDay(2024, 5, 20), (y, m0, d) => {
        const heat = d <= 3;
        parts.push(
          dayBundle(y, m0, d, {
            sleepCategory: 'I had disturbed sleep',
            energyCategory: 'Fresh and active',
            stressCategory: 'Manageable',
            moodCategory: 'Calm',
            focusCategory: 'Clear and focused',
            hotFlashCategory: heat ? '3–5' : 'None',
            hotFlashCount: heat ? 3 : 0,
          })
        );
      });

      installFixture(parts);
    }

    it('names the strongest and weakest areas, the common symptom and the count', async () => {
      installMonth({ withPreviousMonth: false });
      const report = await buildSummary(USER_ID, anchor, 'monthly', 0, now);

      assertResponseShape(report);
      const byKey = new Map(report.glance.map((t) => [t.key, t]));

      expect(byKey.get('strongest')).toMatchObject({
        eyebrow: 'Strongest area',
        ringKey: 'energy',
        value: 'Strong',
        note: 'Great job!',
        tone: 'positive',
      });
      expect(byKey.get('attention')).toMatchObject({
        eyebrow: 'Needs attention',
        label: 'Sleep quality',
        value: 'Disturbed',
        tone: 'attention',
      });
      // 20 disturbed nights beats 3 heat days.
      expect(byKey.get('symptom')).toMatchObject({
        ringKey: 'sleep',
        value: '20 days',
        note: 'this month',
      });
      // Days that carried an episode — not the episode total, and not days logged.
      expect(byKey.get('heat')).toMatchObject({ label: '3 days', ringKey: 'hotFlashes' });
      expect(byKey.get('tracked')).toMatchObject({ label: '20 of 20', ringKey: null });
      // No previous month to compare against, so no improvement claim.
      expect(byKey.has('improvement')).toBe(false);
    });

    it('praises the strongest area only when its own score earns it', async () => {
      // Nothing scores well; focus is merely the least bad of the six.
      eachDay(localDay(2024, 5, 1), localDay(2024, 5, 20), () => {});
      const parts: ReturnType<typeof dayBundle>[] = [];
      eachDay(localDay(2024, 5, 1), localDay(2024, 5, 20), (y, m0, d) => {
        parts.push(
          dayBundle(y, m0, d, {
            sleepCategory: 'I barely slept',
            energyCategory: 'Very tired',
            stressCategory: 'Very stressful',
            moodCategory: 'Sad',
            focusCategory: 'Forgetful', // 40 — the highest score here
            hotFlashCategory: 'More than 5',
            hotFlashCount: 6,
          })
        );
      });
      installFixture(parts);

      const report = await buildSummary(USER_ID, anchor, 'monthly', 0, now);
      const strongest = report.glance.find((t) => t.key === 'strongest')!;

      expect(strongest.ringKey).toBe('focus');
      // "Great job!" over the word "Foggy" is how a page loses its reader.
      expect(strongest.note).toBe('Your steadiest area');
    });

    it('claims an improvement only against a comparable previous month', async () => {
      installMonth({ withPreviousMonth: true });
      const report = await buildSummary(USER_ID, anchor, 'monthly', 0, now);

      const improvement = report.glance.find((t) => t.key === 'improvement');
      expect(improvement).toMatchObject({ ringKey: 'mood', note: 'vs last month' });
      // Points, and it says points — never a bare number next to a 0-100 score.
      expect(improvement!.value).toMatch(/^\+\d+ pts$/);
    });

    it('drops every tile whose claim it cannot make on an empty month', async () => {
      const report = await buildSummary(USER_ID, anchor, 'monthly', 0, now);

      // Only the tracked-days tile survives: it is the one honest figure.
      expect(report.glance.map((t) => t.key)).toEqual(['tracked']);
      expect(report.glance[0]!.label).toBe('0 of 20');
    });
  });
});
