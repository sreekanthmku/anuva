/**
 * Coverage for buildSummaryCalendar — the month grid behind the date picker.
 * Its dots must agree with what the summary would show for the same day.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const sleepFindMany = vi.fn();
const energyFindMany = vi.fn();
const stressFindMany = vi.fn();
const moodFindMany = vi.fn();
const brainFogFindMany = vi.fn();
const hotFlashFindMany = vi.fn();
const quickFindMany = vi.fn();

vi.mock('@anuva/database', () => ({
  prisma: {
    sleepLog: { findMany: (...a: unknown[]) => sleepFindMany(...a) },
    energyLog: { findMany: (...a: unknown[]) => energyFindMany(...a) },
    stressLog: { findMany: (...a: unknown[]) => stressFindMany(...a) },
    moodLog: { findMany: (...a: unknown[]) => moodFindMany(...a) },
    brainFogLog: { findMany: (...a: unknown[]) => brainFogFindMany(...a) },
    hotFlashDailyLog: { findMany: (...a: unknown[]) => hotFlashFindMany(...a) },
    quickSymptomLog: { findMany: (...a: unknown[]) => quickFindMany(...a) },
  },
}));

const { buildSummaryCalendar, summaryAnchor } = await import('../src/report/calendar.js');

const USER = 'user-cal-1';
const ANCHOR = new Date(2026, 7, 1, 9);
const NOW = new Date(2026, 7, 20, 18);

function dateOnly(y: number, m0: number, d: number) {
  return new Date(Date.UTC(y, m0, d));
}

function dayOf(days: Awaited<ReturnType<typeof buildSummaryCalendar>>['days'], iso: string) {
  return days.find((d) => d.date === iso)!;
}

beforeEach(() => {
  vi.clearAllMocks();
  for (const fn of [
    sleepFindMany,
    energyFindMany,
    stressFindMany,
    moodFindMany,
    brainFogFindMany,
    hotFlashFindMany,
    quickFindMany,
  ]) {
    fn.mockResolvedValue([]);
  }
});

describe('buildSummaryCalendar', () => {
  it('returns every calendar day of the month, in order', async () => {
    const cal = await buildSummaryCalendar(USER, '2026-08', ANCHOR, NOW);
    expect(cal.days).toHaveLength(31);
    expect(cal.days[0]!.date).toBe('2026-08-01');
    expect(cal.days[30]!.date).toBe('2026-08-31');
    expect(cal.month).toBe('2026-08');
    expect(cal.metricCount).toBe(6);
  });

  it('reports the selectable bounds', async () => {
    const cal = await buildSummaryCalendar(USER, '2026-08', ANCHOR, NOW);
    expect(cal.earliestDate).toBe('2026-08-01');
    expect(cal.latestDate).toBe('2026-08-20');
  });

  it('handles a short month', async () => {
    const cal = await buildSummaryCalendar(USER, '2026-02', ANCHOR, NOW);
    expect(cal.days).toHaveLength(28);
  });

  it('counts a day with nothing logged as zero metrics and no score', async () => {
    const cal = await buildSummaryCalendar(USER, '2026-08', ANCHOR, NOW);
    expect(dayOf(cal.days, '2026-08-10')).toEqual({
      date: '2026-08-10',
      metrics: 0,
      wellness: null,
    });
  });

  it('counts each logged metric once, however many logs it holds', async () => {
    moodFindMany.mockResolvedValue([
      { loggedAt: new Date(2026, 7, 12, 9), feeling: 5, category: null, moodShift: null },
      { loggedAt: new Date(2026, 7, 12, 21), feeling: null, category: null, moodShift: 'No, mood was stable' },
    ]);
    const cal = await buildSummaryCalendar(USER, '2026-08', ANCHOR, NOW);
    expect(dayOf(cal.days, '2026-08-12').metrics).toBe(1);
    expect(dayOf(cal.days, '2026-08-12').wellness).toBe(100);
  });

  it('adds up to all six metrics on a fully logged day', async () => {
    sleepFindMany.mockResolvedValue([
      { loggedAt: new Date(2026, 7, 14, 8), quality: null, category: 'I slept well' },
    ]);
    energyFindMany.mockResolvedValue([
      { date: dateOnly(2026, 7, 14), category: 'Fresh and active' },
    ]);
    stressFindMany.mockResolvedValue([{ date: dateOnly(2026, 7, 14), category: 'Low stress' }]);
    moodFindMany.mockResolvedValue([
      { loggedAt: new Date(2026, 7, 14, 9), feeling: null, category: 'Calm', moodShift: null },
    ]);
    brainFogFindMany.mockResolvedValue([
      { date: dateOnly(2026, 7, 14), category: 'Clear and focused' },
    ]);
    hotFlashFindMany.mockResolvedValue([
      { date: dateOnly(2026, 7, 14), category: 'None', count: 0 },
    ]);

    const cal = await buildSummaryCalendar(USER, '2026-08', ANCHOR, NOW);
    expect(dayOf(cal.days, '2026-08-14')).toEqual({
      date: '2026-08-14',
      metrics: 6,
      wellness: 100,
    });
  });

  it('counts a metric that was logged but does not score', async () => {
    hotFlashFindMany.mockResolvedValue([
      { date: dateOnly(2026, 7, 15), category: 'Not sure', count: null },
    ]);
    const cal = await buildSummaryCalendar(USER, '2026-08', ANCHOR, NOW);
    // The dot answers "did I log this day", so it shows; the score cannot.
    expect(dayOf(cal.days, '2026-08-15')).toEqual({
      date: '2026-08-15',
      metrics: 1,
      wellness: null,
    });
  });

  it('treats dashboard taps as logs, so a tapped day is never blank', async () => {
    quickFindMany.mockResolvedValue([
      { loggedAt: new Date(2026, 7, 16, 14), symptom: 'anxiety' },
      { loggedAt: new Date(2026, 7, 16, 15), symptom: 'chills' },
    ]);
    const cal = await buildSummaryCalendar(USER, '2026-08', ANCHOR, NOW);
    const day = dayOf(cal.days, '2026-08-16');
    // anxiety -> mood, chills -> heat episodes.
    expect(day.metrics).toBe(2);
    expect(day.wellness).toBe(54);
  });

  it('scores the day the way the summary would, taps included', async () => {
    moodFindMany.mockResolvedValue([
      { loggedAt: new Date(2026, 7, 17, 9), feeling: null, category: 'Calm', moodShift: null },
    ]);
    quickFindMany.mockResolvedValue([
      { loggedAt: new Date(2026, 7, 17, 12), symptom: 'irritability' },
    ]);
    const cal = await buildSummaryCalendar(USER, '2026-08', ANCHOR, NOW);
    // 'Calm' scores 100; one tap knocks 8 off it, same as buildSummary.
    expect(dayOf(cal.days, '2026-08-17').wellness).toBe(92);
  });

  it('ignores hot-flash taps in the score, which the daily row already counts', async () => {
    hotFlashFindMany.mockResolvedValue([
      { date: dateOnly(2026, 7, 18), category: '1–2', count: 2 },
    ]);
    quickFindMany.mockResolvedValue([
      { loggedAt: new Date(2026, 7, 18, 11), symptom: 'hot_flash' },
      { loggedAt: new Date(2026, 7, 18, 16), symptom: 'hot_flash' },
    ]);
    const cal = await buildSummaryCalendar(USER, '2026-08', ANCHOR, NOW);
    expect(dayOf(cal.days, '2026-08-18')).toEqual({
      date: '2026-08-18',
      metrics: 1,
      wellness: 70,
    });
  });
});

describe('summaryAnchor', () => {
  const created = new Date(2026, 7, 3, 13);

  it('uses signup when there is no subscription', () => {
    expect(summaryAnchor({ createdAt: created, subscription: null })).toBe(created);
  });

  it('keeps history when the subscription started after signup', () => {
    // A trial begun after some days of logging must not hide those days.
    const started = new Date(2026, 7, 20, 12);
    expect(summaryAnchor({ createdAt: created, subscription: { startedAt: started } })).toBe(created);
  });

  it('honours a subscription that predates the account record', () => {
    const started = new Date(2026, 6, 1, 12);
    expect(summaryAnchor({ createdAt: created, subscription: { startedAt: started } })).toBe(started);
  });
});
