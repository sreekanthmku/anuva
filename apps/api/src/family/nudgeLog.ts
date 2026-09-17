import { prisma } from '@anuva/database';
import type { FamilyArticleReader, FamilySupportActionKind } from '@anuva/shared';
import { dayKey } from '../dayKey.js';
import {
  type AuthoredNudge,
  type FamilyNudgeLayer,
  type FamilyNudgeSignalMoment,
  layerForDay,
  nudgeById,
  selectNudge,
} from './nudges.js';

/**
 * The nudge ledger: what was sent, whether it was seen, and whether anything came of it.
 *
 * One row per member per day, enforced in Postgres rather than in this file. That unique index is
 * what makes the two writers safe: the cron picks a nudge at nine in the morning, and the Today card
 * picks one the moment a member opens the app. Either can go first. Whoever loses the race reads the
 * winner's row instead of writing a second one, so a member who opens the app after a push sees the
 * nudge they were pushed rather than a different one — which is the bug that would make the
 * notification feel disconnected from the screen behind it.
 */

/** How long a nudge stays "recently sent" and is avoided. Three weeks across ~13 lines per role. */
export const NUDGE_DEDUP_DAYS = 21;

/** Minimum gap between two high-impact nudges. They are only heavy if they are rare. */
export const OCCASIONAL_COOLDOWN_DAYS = 14;

/**
 * How long after a nudge a support action still counts as a response to it.
 *
 * Two days rather than the same day: the weekend Act nudge lands Saturday morning and the call
 * happens Sunday afternoon, and counting only same-day actions would report that the Act layer does
 * not work. It over-attributes slightly — some of those actions would have happened anyway — which
 * is the right direction to be wrong in for a signal that is only ever read comparatively.
 */
export const ATTRIBUTION_WINDOW_HOURS = 48;

function daysAgo(now: Date, days: number): Date {
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
}

export async function recentNudgeIds(familyMemberId: string, now = new Date()): Promise<string[]> {
  const rows = await prisma.familyNudgeLog.findMany({
    where: { familyMemberId, sentAt: { gte: daysAgo(now, NUDGE_DEDUP_DAYS) } },
    select: { nudgeId: true },
  });
  return rows.map((row) => row.nudgeId);
}

export async function occasionalEligible(
  familyMemberId: string,
  now = new Date(),
): Promise<boolean> {
  const recent = await prisma.familyNudgeLog.findFirst({
    where: {
      familyMemberId,
      weight: 'occasional',
      sentAt: { gte: daysAgo(now, OCCASIONAL_COOLDOWN_DAYS) },
    },
    select: { id: true },
  });
  return recent === null;
}

export type ResolvedNudge = {
  logId: string;
  nudge: AuthoredNudge;
  /** True when this call created the row — the cron uses it to decide whether to push. */
  created: boolean;
};

/**
 * Today's nudge for this member, choosing one if the day has none yet.
 *
 * `channel` records who got there first, not who delivered it: a row written by the cron says `push`
 * even if the member reads it in the app ten minutes later. The distinction that matters for
 * measurement is whether a notification was the prompt, and that is the same question.
 */
export async function resolveTodayNudge(input: {
  familyMemberId: string;
  reader: FamilyArticleReader;
  signals: FamilyNudgeSignalMoment[];
  channel: 'push' | 'app';
  /** Overrides the day's default layer. The cadence crons pass the layer they are firing. */
  layer?: FamilyNudgeLayer;
  now?: Date;
  random?: () => number;
}): Promise<ResolvedNudge | null> {
  const now = input.now ?? new Date();
  const date = dayKey(now);

  const existing = await prisma.familyNudgeLog.findUnique({
    where: { familyMemberId_date: { familyMemberId: input.familyMemberId, date } },
    select: { id: true, nudgeId: true },
  });

  if (existing) {
    const nudge = nudgeById(existing.nudgeId);
    // A nudge retired from the corpus between being sent and being read. The row stays for
    // analytics; the card simply has nothing to show rather than rendering a dangling id.
    return nudge ? { logId: existing.id, nudge, created: false } : null;
  }

  const [recentIds, occasional] = await Promise.all([
    recentNudgeIds(input.familyMemberId, now),
    occasionalEligible(input.familyMemberId, now),
  ]);

  const chosen = selectNudge({
    reader: input.reader,
    layer: input.layer ?? layerForDay(now),
    signals: input.signals,
    recentIds,
    occasionalEligible: occasional,
    random: input.random,
  });

  if (!chosen) return null;

  // Same createMany/skipDuplicates shape as `recordSupportAction`, for the same reason: the unique
  // index is the arbiter, and losing the race is a normal outcome rather than an error.
  const { count } = await prisma.familyNudgeLog.createMany({
    data: [
      {
        familyMemberId: input.familyMemberId,
        nudgeId: chosen.id,
        layer: chosen.layer,
        moment: chosen.moment,
        weight: chosen.weight ?? 'standard',
        channel: input.channel,
        date,
      },
    ],
    skipDuplicates: true,
  });

  const row = await prisma.familyNudgeLog.findUnique({
    where: { familyMemberId_date: { familyMemberId: input.familyMemberId, date } },
    select: { id: true, nudgeId: true },
  });

  if (!row) return null;

  if (count === 0) {
    // Someone else wrote first. Theirs is the nudge of record.
    const winner = nudgeById(row.nudgeId);
    return winner ? { logId: row.id, nudge: winner, created: false } : null;
  }

  return { logId: row.id, nudge: chosen, created: true };
}

/** Stamped when the Today card renders it. Idempotent — the first view is the one recorded. */
export async function markNudgeSeen(logId: string, now = new Date()): Promise<void> {
  await prisma.familyNudgeLog.updateMany({
    where: { id: logId, seenAt: null },
    data: { seenAt: now },
  });
}

/**
 * Attribute a support action to the nudge that most likely prompted it.
 *
 * Only the most recent unattributed nudge inside the window, and only once — a family member who
 * messages her *and* sends flowers has responded to one nudge twice, not to two nudges. Recording it
 * twice would inflate exactly the number this exists to measure.
 */
export async function attributeSupportAction(input: {
  familyMemberId: string;
  kind: FamilySupportActionKind;
  now?: Date;
}): Promise<void> {
  const now = input.now ?? new Date();

  const candidate = await prisma.familyNudgeLog.findFirst({
    where: {
      familyMemberId: input.familyMemberId,
      actedAt: null,
      sentAt: { gte: new Date(now.getTime() - ATTRIBUTION_WINDOW_HOURS * 60 * 60 * 1000) },
    },
    orderBy: { sentAt: 'desc' },
    select: { id: true },
  });

  if (!candidate) return;

  await prisma.familyNudgeLog.updateMany({
    where: { id: candidate.id, actedAt: null },
    data: { actedAt: now, actedKind: input.kind },
  });
}
