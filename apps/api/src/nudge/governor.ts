// ANU Nudge Engine — MVP Governor gate.
// The MVP keeps suppression deliberately small: daily cap + already-logged
// tracker. Slot composition lives in engine.ts.

import { prisma } from '@anuva/database';
import type { NudgeSlot } from '@anuva/shared';
import type { NudgeDef } from './registry.js';

const DAILY_CAP = 3;

export interface GovernorState {
  nudgeCountToday: number;
  selfLoggedTrackerToday: boolean; // SR-05 — candidate tracker self-logged
}

export interface GovernorResult {
  allowed: boolean;
  suppressedBy?: string; // e.g. "SR-01"
}

// Pure evaluator — easy to unit test with mock state.
export function evaluateGovernor(
  nudge: NudgeDef,
  _slot: NudgeSlot,
  _now: Date,
  state: GovernorState,
): GovernorResult {
  void nudge;

  if (state.nudgeCountToday >= DAILY_CAP) {
    return { allowed: false, suppressedBy: 'SR-01' };
  }

  if (state.selfLoggedTrackerToday) {
    return { allowed: false, suppressedBy: 'SR-05' };
  }

  return { allowed: true };
}

function startOfDay(d: Date): Date {
  const s = new Date(d);
  s.setHours(0, 0, 0, 0);
  return s;
}

// SR-05 — whether this tracker already has an answer today (via nudge OR manual
// /track entry; same per-domain rows). If answered, don't nudge it again.
async function selfLoggedToday(userId: string, nudge: NudgeDef, dayStart: Date): Promise<boolean> {
  const s = nudge.storage;
  switch (s.model) {
    case 'sleepLog':
      return Boolean(
        await prisma.sleepLog.findFirst({
          where: { userId, loggedAt: { gte: dayStart }, quality: { not: null } },
        }),
      );
    case 'moodLog':
      return Boolean(
        await prisma.moodLog.findFirst({
          where: {
            userId,
            loggedAt: { gte: dayStart },
            ...(s.slot === 'evening' ? { slot: 'evening' } : { feeling: { not: null } }),
          },
        }),
      );
    case 'hotFlashDailyLog': {
      // A daily answer OR a quick-log grid hot_flash entry today both count.
      const [daily, grid] = await Promise.all([
        prisma.hotFlashDailyLog.findUnique({ where: { userId_date: { userId, date: dayStart } } }),
        prisma.quickSymptomLog.findFirst({
          where: { userId, symptom: 'hot_flash', loggedAt: { gte: dayStart } },
        }),
      ]);
      return Boolean(daily || grid);
    }
    default: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const row = await (prisma as any)[s.model].findUnique({
        where: { userId_date: { userId, date: dayStart } },
      });
      return Boolean(row);
    }
  }
}

// Load all governor inputs for a candidate nudge from the DB.
export async function loadGovernorState(
  userId: string,
  nudge: NudgeDef,
  now: Date,
): Promise<GovernorState> {
  const dayStart = startOfDay(now);

  const [todayState, selfLogged] = await Promise.all([
    prisma.nudgeDailyState.findUnique({ where: { userId_date: { userId, date: dayStart } } }),
    selfLoggedToday(userId, nudge, dayStart),
  ]);

  return {
    nudgeCountToday: todayState?.nudgeCount ?? 0,
    selfLoggedTrackerToday: selfLogged,
  };
}

// Convenience: load state + evaluate in one call.
export async function runGovernor(
  userId: string,
  nudge: NudgeDef,
  slot: NudgeSlot,
  now: Date,
): Promise<GovernorResult> {
  const state = await loadGovernorState(userId, nudge, now);
  return evaluateGovernor(nudge, slot, now, state);
}
