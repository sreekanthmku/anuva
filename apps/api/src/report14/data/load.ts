/**
 * Reads everything the classifier needs. Strictly read-only: this module owns no
 * tables and writes nothing, so a report is recomputed from source data on every
 * request rather than snapshotted.
 *
 * The tradeoff is deliberate and worth stating: recomputation means we have no
 * immutable record of what a given user was actually issued, and a copy revision
 * silently changes what an old link renders. Acceptable while the classifier is
 * a pure function of stored answers — every report remains exactly reproducible —
 * but it is the first thing to revisit when reports start being shared with
 * doctors. Adding persistence needs a schema change, which this module avoids by
 * design.
 */

import { prisma } from '@anuva/database';
import { localDayStart } from '../../dayKey.js';

export interface PeriodRow {
  startDate: Date;
  endDate: Date | null;
}

/** One day of log signal, already reduced to what the classifier consumes. */
export interface LogDay {
  /** Local calendar day, YYYY-MM-DD. */
  day: string;
  hotFlashCategory: string | null;
  hotFlashCount: number | null;
  hotFlashTaps: number;
  nightSweat: boolean;
  sleepCategory: string | null;
  moodMorning: string | null;
  moodShift: string | null;
  stressCategory: string | null;
  brainFogCategory: string | null;
  anxietyTaps: number;
  irritabilityTaps: number;
}

export interface Report14Source {
  userName: string | null;
  assessmentCompletedAt: Date | null;
  /** questionKey -> answer value. */
  answers: Map<string, string>;
  periods: PeriodRow[];
  periodLengthDays: number | null;
  firstLogAt: Date | null;
}

function isoLocalDay(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** `@db.Date` columns come back as UTC midnight; read them as a local calendar day. */
function isoDbDate(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Assessment answers, cycle history and the earliest log timestamp — everything
 * needed to resolve the window and run the assessment side of the classifier.
 */
export async function loadSource(userId: string): Promise<Report14Source> {
  const [user, assessment, periods, cycleSettings] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { name: true } }),
    prisma.detailedAssessment.findUnique({
      where: { userId },
      select: {
        status: true,
        completedAt: true,
        answers: { select: { questionKey: true, value: true } },
      },
    }),
    prisma.periodLog.findMany({
      where: { userId },
      orderBy: { startDate: 'desc' },
      take: 24,
      select: { startDate: true, endDate: true },
    }),
    prisma.cycleSettings.findUnique({
      where: { userId },
      select: { periodLength: true },
    }),
  ]);

  const answers = new Map<string, string>();
  for (const a of assessment?.answers ?? []) {
    answers.set(a.questionKey, a.value);
  }

  return {
    userName: user?.name ?? null,
    assessmentCompletedAt: assessment?.status === 'completed' ? assessment.completedAt : null,
    answers,
    periods,
    periodLengthDays: cycleSettings?.periodLength ?? null,
    firstLogAt: await findFirstLogAt(userId),
  };
}

/**
 * Earliest timestamp across every log surface, used as the fallback window
 * anchor. Each query is indexed on `(userId, date)` or `(userId, loggedAt)`, so
 * this is a set of cheap index scans rather than a table sweep.
 */
async function findFirstLogAt(userId: string): Promise<Date | null> {
  const where = { userId };
  const byDate = { orderBy: { date: 'asc' }, select: { date: true }, where } as const;
  const byLoggedAt = { orderBy: { loggedAt: 'asc' }, select: { loggedAt: true }, where } as const;

  const [sleep, mood, energy, stress, hotFlash, brainFog, quick] = await Promise.all([
    prisma.sleepLog.findFirst(byLoggedAt),
    prisma.moodLog.findFirst(byLoggedAt),
    prisma.energyLog.findFirst(byDate),
    prisma.stressLog.findFirst(byDate),
    prisma.hotFlashDailyLog.findFirst(byDate),
    prisma.brainFogLog.findFirst(byDate),
    prisma.quickSymptomLog.findFirst(byLoggedAt),
  ]);

  const candidates: Date[] = [];
  if (sleep) candidates.push(sleep.loggedAt);
  if (mood) candidates.push(mood.loggedAt);
  if (energy) candidates.push(new Date(isoDbDate(energy.date) + 'T00:00:00'));
  if (stress) candidates.push(new Date(isoDbDate(stress.date) + 'T00:00:00'));
  if (hotFlash) candidates.push(new Date(isoDbDate(hotFlash.date) + 'T00:00:00'));
  if (brainFog) candidates.push(new Date(isoDbDate(brainFog.date) + 'T00:00:00'));
  if (quick) candidates.push(quick.loggedAt);

  if (!candidates.length) return null;
  return candidates.reduce((a, b) => (a <= b ? a : b));
}

/**
 * Every log signal inside `[start, end]`, collapsed to one row per calendar day.
 *
 * Date-keyed and timestamp-keyed models are queried differently on purpose —
 * see ../dayKey.ts. Mixing the two is the bug that module exists to prevent.
 */
export async function loadLogWindow(
  userId: string,
  start: Date,
  end: Date,
): Promise<LogDay[]> {
  const dateFrom = new Date(Date.UTC(start.getFullYear(), start.getMonth(), start.getDate()));
  const dateTo = new Date(Date.UTC(end.getFullYear(), end.getMonth(), end.getDate()));
  const tsFrom = localDayStart(start);
  const tsTo = new Date(localDayStart(end).getTime() + 24 * 60 * 60 * 1000 - 1);

  const dateWhere = { userId, date: { gte: dateFrom, lte: dateTo } };
  const tsWhere = { userId, loggedAt: { gte: tsFrom, lte: tsTo } };

  const [hotFlashes, sleeps, moods, stresses, brainFogs, taps] = await Promise.all([
    prisma.hotFlashDailyLog.findMany({
      where: dateWhere,
      select: { date: true, category: true, count: true },
    }),
    prisma.sleepLog.findMany({
      where: tsWhere,
      select: { loggedAt: true, category: true, nightSweatFlag: true },
    }),
    prisma.moodLog.findMany({
      where: tsWhere,
      select: { loggedAt: true, category: true, moodShift: true },
    }),
    prisma.stressLog.findMany({ where: dateWhere, select: { date: true, category: true } }),
    prisma.brainFogLog.findMany({ where: dateWhere, select: { date: true, category: true } }),
    prisma.quickSymptomLog.findMany({
      where: tsWhere,
      select: { loggedAt: true, symptom: true },
    }),
  ]);

  const days = new Map<string, LogDay>();
  const row = (day: string): LogDay => {
    const existing = days.get(day);
    if (existing) return existing;
    const fresh: LogDay = {
      day,
      hotFlashCategory: null,
      hotFlashCount: null,
      hotFlashTaps: 0,
      nightSweat: false,
      sleepCategory: null,
      moodMorning: null,
      moodShift: null,
      stressCategory: null,
      brainFogCategory: null,
      anxietyTaps: 0,
      irritabilityTaps: 0,
    };
    days.set(day, fresh);
    return fresh;
  };

  for (const h of hotFlashes) {
    const r = row(isoDbDate(h.date));
    r.hotFlashCategory = h.category;
    r.hotFlashCount = h.count;
  }
  for (const s of sleeps) {
    const r = row(isoLocalDay(s.loggedAt));
    r.sleepCategory = s.category;
    if (s.nightSweatFlag) r.nightSweat = true;
  }
  for (const m of moods) {
    const r = row(isoLocalDay(m.loggedAt));
    // A day can hold both a morning category and an evening shift; keep the
    // first of each rather than letting the later row blank the earlier one.
    if (m.category && !r.moodMorning) r.moodMorning = m.category;
    if (m.moodShift && !r.moodShift) r.moodShift = m.moodShift;
  }
  for (const s of stresses) row(isoDbDate(s.date)).stressCategory = s.category;
  for (const b of brainFogs) row(isoDbDate(b.date)).brainFogCategory = b.category;
  for (const t of taps) {
    const r = row(isoLocalDay(t.loggedAt));
    if (t.symptom === 'hot_flash') r.hotFlashTaps += 1;
    if (t.symptom === 'anxiety') r.anxietyTaps += 1;
    if (t.symptom === 'irritability') r.irritabilityTaps += 1;
  }

  return [...days.values()].sort((a, b) => a.day.localeCompare(b.day));
}

/** Any bleeding recorded in the lookback window — the stage-3 veto. */
export async function hasRecentBleed(
  userId: string,
  since: Date,
): Promise<boolean> {
  const [period, daily] = await Promise.all([
    prisma.periodLog.findFirst({
      where: { userId, startDate: { gte: new Date(Date.UTC(
        since.getFullYear(), since.getMonth(), since.getDate())) } },
      select: { id: true },
    }),
    prisma.periodDailyStatus.findFirst({
      where: {
        userId,
        date: { gte: new Date(Date.UTC(since.getFullYear(), since.getMonth(), since.getDate())) },
      },
      select: { category: true },
    }),
  ]);

  if (period) return true;
  // L1-006 has no registered nudge today, so this table is normally empty. Read
  // it anyway: if the nudge is ever registered, the veto starts working with no
  // further change here.
  if (daily && /bleed|period|spot|flow|yes/i.test(daily.category)) return true;
  return false;
}
