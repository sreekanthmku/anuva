// ANU home card — everything the rules read, gathered in one pass.
//
// Deliberately narrow: eight days of logs and the cycle math, not the full
// report build. The card sits on the first paint of the home screen, so this
// runs on every dashboard mount and must stay a handful of indexed reads.

import { prisma } from '@anuva/database';
import type { QuickSymptom } from '@anuva/shared';
import { dayKey } from '../dayKey.js';
import { buildCycleStateResponse, type CycleSettingsInput } from '../cycleCalc.js';
import {
  HOT_FLASH_COUNTS,
  MOOD_MORNING_SCORES,
  SLEEP_SCORES,
  lookupScore,
  mean,
  scoreFromFivePoint,
} from '../report/scoring.js';

/// Days of history pulled for the baselines. Seven prior days plus today.
const WINDOW_DAYS = 8;

const QUICK_SYMPTOMS: QuickSymptom[] = ['hot_flash', 'anxiety', 'chills', 'irritability'];

/// One metric, today against her own recent average.
export type MetricSnapshot = {
  today: number | null;
  baseline: number | null;
  /// True only when there is a real baseline to be below — see BASELINE_MIN_DAYS
  /// and BASELINE_DELTA in signals.ts.
  below: boolean;
  loggedAt: Date | null;
};

export type HomeCardContext = {
  firstName: string | null;
  /// Scopes the phrasing pick to one user-day, like the nudge engine's seed.
  variantSeed: string;
  localHour: number;
  quickCountsToday: Partial<Record<QuickSymptom, number>>;
  lastQuickAt: Partial<Record<QuickSymptom, Date>>;
  hotFlashCountToday: number | null;
  hotFlashLoggedAt: Date | null;
  sleep: MetricSnapshot;
  mood: MetricSnapshot;
  cycle: { daysLate: number | null; daysUntilNextPeriod: number | null };
  loggingStreakDays: number;
  loggedAnythingToday: boolean;
};

/// Local midnight — the convention every timestamp column in this codebase is
/// read with. `@db.Date` columns take `dayKey` instead; see ../dayKey.ts.
function startOfLocalDay(d: Date): Date {
  const s = new Date(d);
  s.setHours(0, 0, 0, 0);
  return s;
}

function localDayString(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

/// Scores one night. Manual sheet entries carry a 1-5 `quality`; nudge answers
/// carry a categorical `category`. Both map onto the same 0-100 scale as the
/// weekly report, so a baseline can mix them.
function sleepScore(row: { quality: number | null; category: string | null }): number | null {
  return scoreFromFivePoint(row.quality) ?? lookupScore(SLEEP_SCORES, row.category);
}

function moodScore(row: { feeling: number | null; category: string | null }): number | null {
  return scoreFromFivePoint(row.feeling) ?? lookupScore(MOOD_MORNING_SCORES, row.category);
}

/// Today's value against the mean of the days before it. `minDays` and `delta`
/// come from the caller so the thresholds stay in the registry with the copy
/// they justify.
function snapshot(
  rows: { score: number | null; loggedAt: Date }[],
  todayStart: Date,
  minDays: number,
  delta: number,
): MetricSnapshot {
  const scored = rows.filter((r) => r.score != null);
  const todayRows = scored.filter((r) => r.loggedAt >= todayStart);
  const priorRows = scored.filter((r) => r.loggedAt < todayStart);

  // Newest entry wins for today: she can re-log, and the later answer is the
  // one she means.
  const today = todayRows[0]?.score ?? null;
  const loggedAt = todayRows[0]?.loggedAt ?? null;

  // One value per prior day, so three entries on one evening cannot pass for
  // three days of history.
  const byDay = new Map<string, number>();
  for (const row of priorRows) {
    const key = localDayString(row.loggedAt);
    if (!byDay.has(key)) byDay.set(key, row.score!);
  }

  const baseline = byDay.size >= minDays ? mean([...byDay.values()]) : null;

  return {
    today,
    baseline,
    below: today != null && baseline != null && today <= baseline - delta,
    loggedAt,
  };
}

export type ContextThresholds = { baselineMinDays: number; baselineDelta: number };

export async function loadHomeCardContext(
  user: { id: string; name: string | null },
  now: Date,
  thresholds: ContextThresholds,
): Promise<HomeCardContext> {
  const todayStart = startOfLocalDay(now);
  const windowStart = new Date(todayStart.getTime() - (WINDOW_DAYS - 1) * 86_400_000);

  const [quickLogs, hotFlashToday, sleepLogs, moodLogs, settings, periods] = await Promise.all([
    prisma.quickSymptomLog.findMany({
      where: { userId: user.id, loggedAt: { gte: windowStart } },
      orderBy: { loggedAt: 'desc' },
    }),
    prisma.hotFlashDailyLog.findUnique({
      where: { userId_date: { userId: user.id, date: dayKey(now) } },
    }),
    prisma.sleepLog.findMany({
      where: { userId: user.id, loggedAt: { gte: windowStart } },
      orderBy: { loggedAt: 'desc' },
    }),
    prisma.moodLog.findMany({
      where: { userId: user.id, loggedAt: { gte: windowStart } },
      orderBy: { loggedAt: 'desc' },
    }),
    prisma.cycleSettings.findUnique({ where: { userId: user.id } }),
    prisma.periodLog.findMany({
      where: { userId: user.id },
      orderBy: { startDate: 'desc' },
      take: 24,
    }),
  ]);

  const quickCountsToday: Partial<Record<QuickSymptom, number>> = {};
  const lastQuickAt: Partial<Record<QuickSymptom, Date>> = {};
  for (const row of quickLogs) {
    const symptom = row.symptom as QuickSymptom;
    if (!QUICK_SYMPTOMS.includes(symptom)) continue;
    // `quickLogs` is newest first, so the first row per symptom is the latest.
    lastQuickAt[symptom] ??= row.loggedAt;
    if (row.loggedAt >= todayStart) {
      quickCountsToday[symptom] = (quickCountsToday[symptom] ?? 0) + 1;
    }
  }

  const cycle = buildCycleStateResponse(
    periods.map((p) => ({
      id: p.id,
      startDate: p.startDate.toISOString().split('T')[0]!,
      endDate: p.endDate ? p.endDate.toISOString().split('T')[0]! : null,
    })),
    settings as CycleSettingsInput | null,
    now,
  );

  // Any log of any kind counts as a day she showed up — the streak is about the
  // habit, not about one tracker.
  const loggedDays = new Set(
    [
      ...quickLogs.map((r) => r.loggedAt),
      ...sleepLogs.map((r) => r.loggedAt),
      ...moodLogs.map((r) => r.loggedAt),
    ].map(localDayString),
  );

  let streak = 0;
  for (let i = 0; i < WINDOW_DAYS; i += 1) {
    const day = new Date(todayStart.getTime() - i * 86_400_000);
    if (!loggedDays.has(localDayString(day))) break;
    streak += 1;
  }

  return {
    firstName: user.name?.trim().split(/\s+/)[0] ?? null,
    variantSeed: `${user.id}:${localDayString(now)}`,
    localHour: now.getHours(),
    quickCountsToday,
    lastQuickAt,
    hotFlashCountToday:
      hotFlashToday?.count ?? lookupScore(HOT_FLASH_COUNTS, hotFlashToday?.category) ?? null,
    hotFlashLoggedAt: hotFlashToday?.loggedAt ?? null,
    sleep: snapshot(
      sleepLogs.map((r) => ({ score: sleepScore(r), loggedAt: r.loggedAt })),
      todayStart,
      thresholds.baselineMinDays,
      thresholds.baselineDelta,
    ),
    mood: snapshot(
      moodLogs.map((r) => ({ score: moodScore(r), loggedAt: r.loggedAt })),
      todayStart,
      thresholds.baselineMinDays,
      thresholds.baselineDelta,
    ),
    cycle: { daysLate: cycle.daysLate, daysUntilNextPeriod: cycle.daysUntilNextPeriod },
    loggingStreakDays: streak,
    loggedAnythingToday: loggedDays.has(localDayString(now)),
  };
}
