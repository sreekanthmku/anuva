import { prisma } from '@anuva/database';
import type { SummaryCalendarResponse } from '@anuva/shared';
import { dayKey, isoDay, localDayStart } from '../dayKey.js';
import {
  ENERGY_SCORES,
  FOCUS_SCORES,
  MOOD_MORNING_SCORES,
  MOOD_SHIFT_SCORES,
  SLEEP_SCORES,
  STRESS_SCORES,
  applyEventPenalty,
  hotFlashDayScore,
  lookupScore,
  mean,
  scoreFromFivePoint,
} from './scoring.js';

/**
 * The month grid behind the summary's date picker.
 *
 * Deliberately not built on `buildSummary`: that computes one window's deltas,
 * bands and copy, and a month grid needs the opposite shape — a cheap per-day
 * roll-up of 28-31 days. What it does share is the *scoring*, imported above, so
 * a day's dot can never disagree with the gauges the day opens onto.
 */

/** The six metrics a fully logged day carries. */
export const METRIC_COUNT = 6;

/**
 * How far back the summary lets a user travel.
 *
 * The earlier of when they signed up and when their subscription started. A
 * subscription row created later than the account — a trial started after some
 * days of logging, or a re-subscribe — must not hide history the user logged
 * themselves, which is what taking `startedAt` alone did.
 */
export function summaryAnchor(user: { createdAt: Date; subscription?: { startedAt: Date } | null }) {
  const started = user.subscription?.startedAt;
  if (!started) return user.createdAt;
  return started < user.createdAt ? started : user.createdAt;
}

type DayRoll = { keys: Set<string>; scores: number[] };

function rollFor(map: Map<string, DayRoll>, day: string): DayRoll {
  const existing = map.get(day);
  if (existing) return existing;
  const fresh: DayRoll = { keys: new Set(), scores: [] };
  map.set(day, fresh);
  return fresh;
}

/**
 * Record one metric for one day. A metric counts toward the dot as soon as it
 * has *any* log, even one that scores null ('Not sure'), because the dot answers
 * "did I log this day", not "does it score well".
 */
function note(map: Map<string, DayRoll>, day: string, key: string, score: number | null) {
  const roll = rollFor(map, day);
  roll.keys.add(key);
  if (score != null) roll.scores.push(score);
}

export async function buildSummaryCalendar(
  userId: string,
  month: string,
  anchor: Date,
  now = new Date()
): Promise<SummaryCalendarResponse> {
  const [year, monthIndex] = month.split('-').map(Number) as [number, number];
  const first = new Date(year, monthIndex - 1, 1);
  const last = new Date(year, monthIndex, 0);
  const dayAfterLast = new Date(year, monthIndex, 1);

  const timestampRange = { gte: localDayStart(first), lt: localDayStart(dayAfterLast) };
  const dateRange = { gte: dayKey(first), lt: dayKey(dayAfterLast) };

  const [sleepRows, energyRows, stressRows, moodRows, focusRows, hotFlashRows, quickRows] =
    await Promise.all([
      prisma.sleepLog.findMany({
        where: { userId, loggedAt: timestampRange },
        select: { loggedAt: true, quality: true, category: true },
      }),
      prisma.energyLog.findMany({
        where: { userId, date: dateRange },
        select: { date: true, category: true },
      }),
      prisma.stressLog.findMany({
        where: { userId, date: dateRange },
        select: { date: true, category: true },
      }),
      prisma.moodLog.findMany({
        where: { userId, loggedAt: timestampRange },
        select: { loggedAt: true, feeling: true, category: true, moodShift: true },
      }),
      prisma.brainFogLog.findMany({
        where: { userId, date: dateRange },
        select: { date: true, category: true },
      }),
      prisma.hotFlashDailyLog.findMany({
        where: { userId, date: dateRange },
        select: { date: true, category: true, count: true },
      }),
      prisma.quickSymptomLog.findMany({
        where: { userId, loggedAt: timestampRange },
        select: { loggedAt: true, symptom: true },
      }),
    ]);

  const rolls = new Map<string, DayRoll>();

  for (const r of sleepRows) {
    note(
      rolls,
      isoDay(r.loggedAt),
      'sleep',
      lookupScore(SLEEP_SCORES, r.category) ?? scoreFromFivePoint(r.quality)
    );
  }
  for (const r of energyRows) {
    note(rolls, isoDay(new Date(r.date)), 'energy', lookupScore(ENERGY_SCORES, r.category));
  }
  for (const r of stressRows) {
    note(rolls, isoDay(new Date(r.date)), 'stress', lookupScore(STRESS_SCORES, r.category));
  }
  for (const r of moodRows) {
    note(
      rolls,
      isoDay(r.loggedAt),
      'mood',
      scoreFromFivePoint(r.feeling) ??
        lookupScore(MOOD_MORNING_SCORES, r.category) ??
        lookupScore(MOOD_SHIFT_SCORES, r.moodShift)
    );
  }
  for (const r of focusRows) {
    note(rolls, isoDay(new Date(r.date)), 'focus', lookupScore(FOCUS_SCORES, r.category));
  }
  for (const r of hotFlashRows) {
    note(rolls, isoDay(new Date(r.date)), 'hotFlashes', hotFlashDayScore(r.category, r.count));
  }
  // Dashboard taps are logs too — a day tapped and nothing else must not read as
  // an empty day, which is the whole reason the write-through exists.
  for (const r of quickRows) {
    const key = r.symptom === 'chills' || r.symptom === 'hot_flash' ? 'hotFlashes' : 'mood';
    note(rolls, isoDay(r.loggedAt), key, null);
  }

  const tapPenalties = new Map<string, number>();
  for (const r of quickRows) {
    if (r.symptom === 'hot_flash') continue; // already counted in the daily row
    const day = isoDay(r.loggedAt);
    tapPenalties.set(day, (tapPenalties.get(day) ?? 0) + 1);
  }

  const days: SummaryCalendarResponse['days'] = [];
  for (let d = 1; d <= last.getDate(); d += 1) {
    const date = isoDay(new Date(year, monthIndex - 1, d));
    const roll = rolls.get(date);
    const base = mean(roll?.scores ?? []);
    const wellness = applyEventPenalty(base, tapPenalties.get(date) ?? 0);
    days.push({
      date,
      metrics: roll?.keys.size ?? 0,
      wellness: wellness == null ? null : Math.round(wellness),
    });
  }

  return {
    month,
    metricCount: METRIC_COUNT,
    earliestDate: isoDay(anchor),
    latestDate: isoDay(now),
    days,
  };
}
