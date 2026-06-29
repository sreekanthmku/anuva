// ANU Nudge Engine — Governor gate.
// Runs the suppression rules SR-01..SR-09 in priority order before any nudge
// fires. Short-circuits on the first failing gate.
// Source: ANU_Nudge_Engine_Dev_Reference.docx v2.0 "Suppression Rules".

import { prisma } from '@anuva/database';
import type { NudgeSlot } from '@anuva/shared';
import type { NudgeDef } from './registry.js';

const DAILY_CAP = 3;
const WEEKEND_CAP = 2;
const RECENT_ENGAGE_MINUTES = 90;
const INACTIVITY_HOURS = 48;
const L3_REPEAT_DAYS = 3;

export interface GovernorState {
  nudgeCountToday: number;
  distressFlag: boolean;
  symptomSeverity: number; // 0 when unknown
  lastEngagedAt: Date | null;
  morningAnchorResponded: boolean;
  hoursSinceLastOpen: number;
  selfLoggedTrackerToday: boolean; // SR-05 — candidate tracker self-logged
  l3LastFiredAt: Date | null; // SR-09 — candidate L3 trigger last fired
  isWeekend: boolean;
  isStreakDay1: boolean;
}

export interface GovernorResult {
  allowed: boolean;
  suppressedBy?: string; // e.g. "SR-01"
  reEngagementOnly?: boolean; // SR-08 — send re-engagement nudge instead
}

// Pure evaluator — easy to unit test with mock state.
export function evaluateGovernor(
  nudge: NudgeDef,
  slot: NudgeSlot,
  now: Date,
  state: GovernorState,
): GovernorResult {
  const isSafety = nudge.id === 'L3-007';

  // ── CRITICAL ──────────────────────────────────────────────
  // SR-01 Daily Budget Cap
  if (state.nudgeCountToday >= DAILY_CAP) {
    return { allowed: false, suppressedBy: 'SR-01' };
  }
  // SR-03 Distress State — only L3-007 Safety is permitted.
  if (state.distressFlag || state.symptomSeverity >= 4) {
    if (!isSafety) return { allowed: false, suppressedBy: 'SR-03' };
  }

  // ── HIGH ──────────────────────────────────────────────────
  // SR-08 48hr inactivity — re-engagement only, no tracker content.
  if (state.hoursSinceLastOpen > INACTIVITY_HOURS) {
    return { allowed: false, suppressedBy: 'SR-08', reEngagementOnly: true };
  }
  // SR-02 Recent engagement — suppress next scheduled nudge (skip for safety).
  if (state.lastEngagedAt && !isSafety) {
    const mins = (now.getTime() - state.lastEngagedAt.getTime()) / 60000;
    if (mins < RECENT_ENGAGE_MINUTES) {
      return { allowed: false, suppressedBy: 'SR-02' };
    }
  }
  // SR-04 Morning no-response — suppress the Afternoon Pulse.
  if (
    slot === 'afternoon' &&
    !state.morningAnchorResponded &&
    now.getHours() >= 12 &&
    !isSafety
  ) {
    return { allowed: false, suppressedBy: 'SR-04' };
  }

  // ── MEDIUM ────────────────────────────────────────────────
  // SR-07 Weekend softening — max 2/day, drop the Afternoon Pulse.
  if (state.isWeekend && !isSafety) {
    if (slot === 'afternoon') return { allowed: false, suppressedBy: 'SR-07' };
    if (state.nudgeCountToday >= WEEKEND_CAP) {
      return { allowed: false, suppressedBy: 'SR-07' };
    }
  }
  // SR-05 Self-initiated logging — suppress that tracker for the day.
  if (state.selfLoggedTrackerToday && !isSafety) {
    return { allowed: false, suppressedBy: 'SR-05' };
  }
  // SR-09 L3 repeat frequency — max 1x / 3 days per trigger.
  if (nudge.layer === 3 && state.l3LastFiredAt) {
    const days = (now.getTime() - state.l3LastFiredAt.getTime()) / 86400000;
    if (days < L3_REPEAT_DAYS) {
      return { allowed: false, suppressedBy: 'SR-09' };
    }
  }

  // ── LOW ───────────────────────────────────────────────────
  // SR-06 Streak day 1 — suppress the Evening Close nudge.
  if (slot === 'evening' && state.isStreakDay1 && !isSafety) {
    return { allowed: false, suppressedBy: 'SR-06' };
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
    case 'none':
      return false; // L3 triggers are never "self-logged"
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

  const [todayState, latestEngagedState, priorStateCount, l3Last, selfLogged] = await Promise.all([
    prisma.nudgeDailyState.findUnique({ where: { userId_date: { userId, date: dayStart } } }),
    prisma.nudgeDailyState.findFirst({
      where: { userId, lastEngagedAt: { not: null } },
      orderBy: { lastEngagedAt: 'desc' },
    }),
    prisma.nudgeDailyState.count({ where: { userId, date: { lt: dayStart } } }),
    nudge.layer === 3
      ? prisma.l3TriggerLog.findFirst({
          where: { userId, triggerId: nudge.id },
          orderBy: { firedAt: 'desc' },
        })
      : Promise.resolve(null),
    selfLoggedToday(userId, nudge, dayStart),
  ]);

  const lastOpen = latestEngagedState?.lastEngagedAt ?? null;
  const hoursSinceLastOpen = lastOpen
    ? (now.getTime() - lastOpen.getTime()) / 3600000
    : 0; // never engaged (new user) => treat as active

  const dow = now.getDay();

  return {
    nudgeCountToday: todayState?.nudgeCount ?? 0,
    distressFlag: todayState?.distressFlag ?? false,
    symptomSeverity: 0,
    lastEngagedAt: todayState?.lastEngagedAt ?? null,
    morningAnchorResponded: todayState?.morningAnchorResponded ?? false,
    hoursSinceLastOpen,
    selfLoggedTrackerToday: selfLogged,
    l3LastFiredAt: l3Last?.firedAt ?? null,
    isWeekend: dow === 0 || dow === 6,
    isStreakDay1: priorStateCount === 0,
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
