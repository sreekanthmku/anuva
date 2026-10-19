// Loads everything a visit summary is built from, for one window, and hands the rows to the pure
// summarisers in ./data.ts.
//
// The window runs from her last completed consultation to now. With none behind her it looks back
// VISIT_SUMMARY_FALLBACK_WINDOW_DAYS. Only her own rows are read; what Anu contributes is the safety
// rating of a turn, never the words of the conversation.

import { prisma } from '@anuva/database';
import { VISIT_SUMMARY_FALLBACK_WINDOW_DAYS } from '@anuva/shared';
import { dayKey, isoDay, localDayStart } from '../dayKey.js';
import {
  VISIT_SUMMARY_DATA_VERSION,
  ageOn,
  summarizeBody,
  summarizeConcerns,
  summarizeCycle,
  summarizeMedication,
  summarizeWellbeing,
  type VisitSummaryData,
} from './data.js';

const DAY_MS = 24 * 60 * 60 * 1000;

export type BuiltVisitSummary = {
  sinceConsultationId: string | null;
  windowStart: Date;
  windowEnd: Date;
  dataVersion: number;
  data: VisitSummaryData;
};

/** The completed consultation the window starts from: her most recent one before now. */
async function previousVisit(userId: string, consultationId: string, now: Date) {
  return prisma.consultation.findFirst({
    where: { userId, status: 'completed', id: { not: consultationId }, scheduledAt: { lt: now } },
    orderBy: { scheduledAt: 'desc' },
    select: {
      id: true,
      scheduledAt: true,
      specialist: { select: { name: true } },
      documents: { where: { deletedAt: null }, select: { kind: true, title: true }, orderBy: { createdAt: 'asc' } },
    },
  });
}

export async function buildVisitSummary(
  userId: string,
  consultationId: string,
  now: Date = new Date(),
): Promise<BuiltVisitSummary> {
  const previous = await previousVisit(userId, consultationId, now);
  const windowStart = previous?.scheduledAt ?? new Date(now.getTime() - VISIT_SUMMARY_FALLBACK_WINDOW_DAYS * DAY_MS);
  const windowEnd = now;

  // `@db.Date` columns by calendar day, timestamp columns by instant — see dayKey.ts.
  const dateRange = { gte: dayKey(windowStart), lte: dayKey(windowEnd) };
  const stampRange = { gte: localDayStart(windowStart), lte: windowEnd };
  const byDate = { userId, date: dateRange };
  const byStamp = { userId, loggedAt: stampRange };
  const categoryByDate = { where: byDate, select: { date: true, category: true } } as const;

  const [
    profile,
    assessment,
    cycleSettings,
    periods,
    flows,
    sleep,
    energy,
    stress,
    mood,
    focus,
    hotFlashes,
    quick,
    joints,
    pain,
    bloating,
    activeReminders,
    doses,
    turns,
  ] = await Promise.all([
    prisma.healthProfile.findUnique({ where: { userId }, select: { dateOfBirth: true, menopauseStage: true } }),
    prisma.assessment.findFirst({
      where: { userId },
      orderBy: { completedAt: 'desc' },
      select: { score: true, threshold: true, status: true, completedAt: true },
    }),
    prisma.cycleSettings.findUnique({ where: { userId }, select: { cycleLength: true } }),
    prisma.periodLog.findMany({
      where: { userId, deletedAt: null, startDate: dateRange },
      select: { startDate: true, endDate: true, endDateSource: true },
    }),
    prisma.periodFlowLog.findMany({ where: byDate, select: { date: true, flow: true } }),
    prisma.sleepLog.findMany({
      where: byStamp,
      select: { loggedAt: true, quality: true, category: true, nightSweatFlag: true },
    }),
    prisma.energyLog.findMany(categoryByDate),
    prisma.stressLog.findMany(categoryByDate),
    prisma.moodLog.findMany({
      where: byStamp,
      select: { loggedAt: true, feeling: true, category: true, moodShift: true },
    }),
    prisma.brainFogLog.findMany(categoryByDate),
    prisma.hotFlashDailyLog.findMany({ where: byDate, select: { date: true, category: true, count: true } }),
    prisma.quickSymptomLog.findMany({ where: byStamp, select: { loggedAt: true, symptom: true } }),
    prisma.jointLog.findMany({ where: byDate, select: { date: true, severity: true, areas: true, score: true } }),
    prisma.painLog.findMany(categoryByDate),
    prisma.bloatingLog.findMany(categoryByDate),
    prisma.medicationReminder.count({ where: { userId, active: true, deletedAt: null } }),
    prisma.medicationDose.findMany({
      where: { userId, scheduledFor: { gte: windowStart, lte: windowEnd } },
      select: { status: true, date: true },
    }),
    // Only the turns that matter, filtered in the database: a busy chat runs to thousands.
    prisma.anuChatTurn.findMany({
      where: {
        userId,
        createdAt: { gte: windowStart, lte: windowEnd },
        OR: [
          { redFlagArea: { not: null } },
          ...['L2', 'L3', 'L4'].map((level) => ({ decision: { path: ['final_risk_level'], equals: level } })),
        ],
      },
      select: { createdAt: true, decision: true, redFlagArea: true },
      orderBy: { createdAt: 'desc' },
      take: 200,
    }),
  ]);

  const window = { start: isoDay(windowStart), end: isoDay(windowEnd) };

  const data: VisitSummaryData = {
    profile: {
      age: ageOn(profile?.dateOfBirth ?? null, now),
      stage: profile?.menopauseStage ?? null,
      assessment: assessment
        ? {
            score: assessment.score,
            threshold: assessment.threshold,
            status: assessment.status,
            completedAt: assessment.completedAt.toISOString(),
          }
        : null,
    },
    cycle: summarizeCycle(periods, flows, cycleSettings?.cycleLength ?? null),
    wellbeing: summarizeWellbeing({ sleep, energy, stress, mood, focus, hotFlashes, quick }, window),
    body: summarizeBody({ joints, pain, bloating, quick }),
    medication: summarizeMedication(activeReminders, doses, isoDay(now)),
    concerns: summarizeConcerns(turns),
    lastVisit: previous
      ? {
          specialistName: previous.specialist.name,
          date: previous.scheduledAt.toISOString(),
          documents: previous.documents,
        }
      : null,
  };

  return {
    sinceConsultationId: previous?.id ?? null,
    windowStart,
    windowEnd,
    dataVersion: VISIT_SUMMARY_DATA_VERSION,
    data,
  };
}
