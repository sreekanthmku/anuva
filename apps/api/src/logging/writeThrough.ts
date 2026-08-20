import { prisma } from '@anuva/database';
import type { QuickSymptom } from '@anuva/shared';
import { hotFlashCategoryForCount } from '../report/scoring.js';
import { dayKey, localDayStart } from '../dayKey.js';

/**
 * Single owner of "the user logged something — which domain logs move?".
 *
 * Every logging surface routes through here rather than writing its own tables,
 * because the alternative has already bitten us once: the dashboard's Quick log
 * grid wrote `QuickSymptomLog` and nothing else, so a user could complete that
 * grid 6/6 and watch four of the six summary gauges stay empty. The nudge path
 * (see nudge/engine.ts `persistAnswer`) writes the tables the summary reads;
 * this module gives the tap surfaces the same reach.
 *
 * `QuickSymptomLog` stays as the event-level record — the timestamps matter for
 * pattern work — but it is now a *source* that projects into the scored daily
 * logs, not a dead end.
 */

/**
 * What each tap projects into.
 *
 * `hotFlash` writes a daily row, because heat episodes are counted and the ring
 * reads a bucketed count. `distress` taps write nothing extra: they carry no
 * count of their own, and the summary folds them into the mood and heat rings
 * as a knock-down (see `applyEventPenalty`). Keeping them out of the daily
 * tables means a tap can never *invent* a categorical answer the user did not
 * give.
 */
const PROJECTION: Record<QuickSymptom, 'hotFlash' | 'distress'> = {
  hot_flash: 'hotFlash',
  anxiety: 'distress',
  chills: 'distress',
  irritability: 'distress',
};

/**
 * Roll a day's hot-flash taps into `HotFlashDailyLog`.
 *
 * The split matters: taps own the **count**, which is a fact about the day, and
 * they only set the **category** on rows they created themselves. A category the
 * user actually chose is never rewritten — `hotFlashDayScore` reconciles the two
 * at read time by taking the worse, so the taps reach the ring without the row
 * losing what the user said.
 *
 * Idempotent: it recomputes from the day's taps rather than incrementing, so it
 * is safe to re-run over history.
 */
export async function projectHotFlashDay(userId: string, day: Date) {
  const dayStart = localDayStart(day);
  const nextDay = new Date(dayStart);
  nextDay.setDate(nextDay.getDate() + 1);

  const dayTaps = await prisma.quickSymptomLog.findMany({
    where: { userId, symptom: 'hot_flash', loggedAt: { gte: dayStart, lt: nextDay } },
    select: { loggedAt: true },
    orderBy: { loggedAt: 'desc' },
  });
  const taps = dayTaps.length;
  // The row's `loggedAt` must land inside the day it describes — a repair pass
  // recovers a row's true calendar day from it (see repairDayKeys.ts), so
  // leaving it at `now` would strand a backfilled row on today.
  const lastTapAt = dayTaps[0]?.loggedAt ?? day;

  const date = dayKey(dayStart);
  const existing = await prisma.hotFlashDailyLog.findUnique({
    where: { userId_date: { userId, date } },
  });

  const tapCategory = hotFlashCategoryForCount(taps);

  if (!existing) {
    await prisma.hotFlashDailyLog.create({
      data: {
        userId,
        date,
        category: tapCategory,
        count: taps,
        source: 'quick_log',
        loggedAt: lastTapAt,
      },
    });
    return;
  }

  // The row already carries an answer the user chose. Take the count, leave the
  // words alone, and mark the day as carrying both so a later reader knows the
  // category and the count came from different surfaces.
  const answered = existing.source !== 'quick_log';

  await prisma.hotFlashDailyLog.update({
    where: { userId_date: { userId, date } },
    data: {
      ...(answered ? {} : { category: tapCategory, loggedAt: lastTapAt }),
      count: Math.max(existing.count ?? 0, taps),
      source: answered ? 'mixed' : 'quick_log',
    },
  });
}

/**
 * Record one quick-log tap and fan it out to whatever the summary reads.
 * Returns nothing — callers read state back through the same queries the
 * summary uses, so there is one source of truth for what today looks like.
 */
export async function recordQuickSymptom(
  userId: string,
  symptom: QuickSymptom,
  loggedAt?: Date
): Promise<void> {
  const at = loggedAt ?? new Date();

  await prisma.quickSymptomLog.create({
    data: { userId, symptom, ...(loggedAt ? { loggedAt: at } : {}) },
  });

  if (PROJECTION[symptom] === 'hotFlash') {
    await projectHotFlashDay(userId, at);
  }
}
