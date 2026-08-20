// ANU Nudge Engine — MVP dispatch & persistence.
// Builds the fixed MVP slot bundles, persists answers to their per-domain model,
// and tracks daily sends/engagement state.

import { prisma } from '@anuva/database';
import type { NudgeCard, NudgeSlot } from '@anuva/shared';
import {
  DAY_TRACKERS,
  DAY_TRACKER_ORDER,
  getNudge,
  selectToneTemplate,
  type DayTier,
  type NudgeDef,
} from './registry.js';
import { runGovernor } from './governor.js';
import { firstNameOf, nudgeQuestion, type QuestionContext } from './questionVariants.js';
import { selectL2Nudge } from './selectL2Nudge.js';
import { OVERWHELMED } from './signals.js';
import { dayKey } from '../dayKey.js';

/**
 * Local midnight. Correct for timestamp columns; **never** for a `@db.Date`
 * column — those take `dayKey`, see ../dayKey.ts for why.
 */
export function startOfDay(d: Date): Date {
  const s = new Date(d);
  s.setHours(0, 0, 0, 0);
  return s;
}

// Map clock time to the slot we should surface for GET /nudge/today.
export function currentSlot(now: Date): NudgeSlot {
  const h = now.getHours();
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
}

const SLOT_TITLES: Record<NudgeSlot, string> = {
  morning: 'Morning',
  afternoon: 'Afternoon',
  evening: 'Evening/Night',
};

// Primary mandatory nudge whose governor result gates the whole slot bundle.
const SLOT_PRIMARY: Record<NudgeSlot, string> = {
  morning: 'L1-001',
  afternoon: 'L1-004',
  evening: 'L1-005',
};

function mustNudge(id: string): NudgeDef {
  const def = getNudge(id);
  if (!def) throw new Error(`Unknown nudge ${id}`);
  return def;
}

export function toCard(def: NudgeDef, ctx?: QuestionContext): NudgeCard {
  return {
    nudgeId: def.id,
    layer: def.layer,
    slot: def.slot,
    question: ctx ? nudgeQuestion(def.id, def.question, ctx) : def.question,
    options: def.options,
    required: def.required,
  };
}

/**
 * Everything the phrasing picker needs for one user on one day. The date is part of the seed, so
 * the wording moves on each morning while staying put across a day's requests.
 */
async function questionContext(userId: string, dayStart: Date): Promise<QuestionContext> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } });
  return {
    seed: `${userId}:${dayStart.toISOString().split('T')[0]}`,
    firstName: firstNameOf(user?.name),
  };
}

export interface Dispatch {
  slot: NudgeSlot;
  bundleTitle: string;
  cards: NudgeCard[];
  primaryNudgeId: string | null; // what gets recorded as the slot's send
  suppressedNudgeId?: string;
  suppressedReason?: string;
  setDistress: boolean;
}

export interface BuildDispatchOptions {
  purpose?: 'send' | 'render';
}

async function ensureDailyState(userId: string, dayStart: Date) {
  const date = dayKey(dayStart);
  return prisma.nudgeDailyState.upsert({
    where: { userId_date: { userId, date } },
    create: { userId, date },
    update: {},
  });
}

// Mark nudge engagement when mood/sleep are logged via the manual /mood,/sleep path.
export async function markTrackerEngagement(userId: string, now: Date): Promise<void> {
  const date = dayKey(now);
  await prisma.nudgeDailyState.upsert({
    where: { userId_date: { userId, date } },
    create: { userId, date, lastEngagedAt: now, morningAnchorResponded: true },
    update: { lastEngagedAt: now, morningAnchorResponded: true },
  });
}

// Build what should fire for `slot`.
export async function buildDispatch(
  userId: string,
  slot: NudgeSlot,
  now: Date,
  options: BuildDispatchOptions = {},
): Promise<Dispatch> {
  const dayStart = startOfDay(now);
  await ensureDailyState(userId, dayStart);
  const title = SLOT_TITLES[slot];
  const isRender = options.purpose === 'render';

  // Routine bundle — gated by the slot's primary mandatory nudge.
  const primary = mustNudge(SLOT_PRIMARY[slot]);
  const gate = isRender ? { allowed: true } : await runGovernor(userId, primary, slot, now);
  if (!gate.allowed) {
    return {
      slot,
      bundleTitle: title,
      cards: [],
      primaryNudgeId: null,
      suppressedNudgeId: primary.id,
      suppressedReason: gate.suppressedBy,
      setDistress: false,
    };
  }

  const ids: string[] = [];
  let setDistress = false;

  if (slot === 'morning') {
    ids.push('L1-001', 'L1-002', 'L1-003');
  } else if (slot === 'afternoon') {
    ids.push('L1-004');
    const l2 = await selectL2Nudge(userId, now, { preferSentToday: isRender });
    if (l2.nudgeId) ids.push(l2.nudgeId);
    setDistress = l2.setDistress;
  } else {
    ids.push('L1-005', 'L2-001', 'L1-007', 'L1-008');
  }

  // SR-05: drop individual cards whose tracker was already self-logged today.
  const ctx = await questionContext(userId, dayStart);
  const cards: NudgeCard[] = [];
  for (const id of ids) {
    const def = getNudge(id);
    if (!def) continue;
    const g = await runGovernor(userId, def, slot, now, { ignoreDailyCap: isRender });
    if (g.allowed) cards.push(toCard(def, ctx));
  }

  return {
    slot,
    bundleTitle: title,
    cards,
    primaryNudgeId: cards.length ? SLOT_PRIMARY[slot] : null,
    suppressedNudgeId: cards.length ? undefined : SLOT_PRIMARY[slot],
    suppressedReason: cards.length ? undefined : 'SR-05',
    setDistress,
  };
}

// Record that a slot's nudge was sent: one NudgeSendLog row + bump the daily count.
export async function recordSend(
  userId: string,
  nudgeId: string,
  slot: NudgeSlot,
  now: Date,
  setDistress = false,
  cardNudgeIds: string[] = [nudgeId],
) {
  const sendIds = Array.from(new Set(cardNudgeIds.length ? cardNudgeIds : [nudgeId]));
  const dayStart = startOfDay(now);
  await prisma.$transaction([
    ...sendIds.map((id) => {
      const def = getNudge(id);
      return prisma.nudgeSendLog.create({
        data: { userId, nudgeId: id, layer: def?.layer ?? 1, slot, sentAt: now },
      });
    }),
    prisma.nudgeDailyState.upsert({
      where: { userId_date: { userId, date: dayKey(dayStart) } },
      create: { userId, date: dayKey(dayStart), nudgeCount: 1, distressFlag: setDistress },
      update: { nudgeCount: { increment: 1 }, ...(setDistress ? { distressFlag: true } : {}) },
    }),
  ]);
}

// Record a candidate that was intentionally skipped by the Governor.
export async function recordSuppression(
  userId: string,
  nudgeId: string,
  slot: NudgeSlot,
  reason: string,
  now: Date,
) {
  const def = getNudge(nudgeId);
  await prisma.nudgeSendLog.create({
    data: {
      userId,
      nudgeId,
      layer: def?.layer ?? 1,
      slot,
      sentAt: now,
      suppressedReason: reason,
    },
  });
}

// Persist a single tracker answer to its per-domain model.
async function persistAnswer(userId: string, def: NudgeDef, answer: string, loggedAt: Date) {
  const dayStart = startOfDay(loggedAt);
  const s = def.storage;
  switch (s.model) {
    case 'sleepLog':
      await prisma.sleepLog.create({
        data: {
          userId,
          category: answer,
          nightSweatFlag: answer === 'I woke up sweaty or uncomfortable',
          disruptions: [],
          loggedAt,
        },
      });
      return;
    case 'moodLog':
      await prisma.moodLog.create({
        data: {
          userId,
          emotions: [],
          slot: s.slot,
          ...(s.slot === 'evening' ? { moodShift: answer } : { category: answer }),
          loggedAt,
        },
      });
      return;
    default: {
      // All remaining per-domain daily logs share the upsert-by-day shape.
      const model = s.model;
      const extra = model === 'stressLog' ? { overwhelmed: answer === OVERWHELMED } : {};
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (prisma as any)[model].upsert({
        where: { userId_date: { userId, date: dayKey(dayStart) } },
        create: { userId, date: dayKey(dayStart), category: answer, ...extra },
        update: { category: answer, ...extra },
      });
    }
  }
}

export interface StoreResult {
  toneTemplateId: string;
  message: string;
  distressFlag: boolean;
}

// Handle POST /nudge/respond: persist answer, update engagement/distress, reply.
export async function storeResponse(
  userId: string,
  nudgeId: string,
  answer: string,
  loggedAt: Date,
  now: Date,
): Promise<StoreResult> {
  const def = getNudge(nudgeId);
  if (!def) throw new Error(`Unknown nudge ${nudgeId}`);

  await persistAnswer(userId, def, answer, loggedAt);

  const dayStart = startOfDay(now);
  const setDistress = false;

  const engagementPatch: Record<string, unknown> = { lastEngagedAt: now };
  if (def.slot === 'morning' && def.layer === 1) engagementPatch.morningAnchorResponded = true;
  if (def.slot === 'afternoon' && def.layer === 1) engagementPatch.afternoonResponded = true;
  if (setDistress) engagementPatch.distressFlag = true;

  // Mark the prompt engaged on its most recent send log.
  const lastSend = await prisma.nudgeSendLog.findFirst({
    where: { userId, nudgeId, engagedAt: null },
    orderBy: { sentAt: 'desc' },
  });

  await prisma.$transaction([
    prisma.nudgeDailyState.upsert({
      where: { userId_date: { userId, date: dayKey(dayStart) } },
      create: { userId, date: dayKey(dayStart), ...engagementPatch },
      update: engagementPatch,
    }),
    ...(lastSend
      ? [prisma.nudgeSendLog.update({ where: { id: lastSend.id }, data: { engagedAt: now } })]
      : []),
  ]);

  const tone = selectToneTemplate(nudgeId, answer);
  return { toneTemplateId: tone.id, message: tone.message, distressFlag: setDistress };
}

// ─────────────────────────────────────────────
// Unified day sheet — what /track renders. Reads today's answer (from a nudge
// OR a manual entry — same per-domain rows) for every relevant tracker.
// ─────────────────────────────────────────────

// Mood (L1-003) and sleep (L1-001) capture the numeric 1-5 emoji scale; map to a
// display label for the day sheet's collapsed/answered row.
const FEELING_LABELS: Record<number, string> = {
  5: 'Feeling great',
  4: 'Feeling good',
  3: 'Feeling okay',
  2: 'Feeling low',
  1: 'Feeling awful',
};
const QUALITY_LABELS: Record<number, string> = {
  5: 'Slept great',
  4: 'Slept good',
  3: 'Slept okay',
  2: 'Slept poorly',
  1: 'Slept awful',
};

// Read today's stored answer for a tracker, or null if not yet logged.
async function readAnswer(userId: string, def: NudgeDef, dayStart: Date): Promise<string | null> {
  const s = def.storage;
  switch (s.model) {
    case 'sleepLog': {
      const r = await prisma.sleepLog.findFirst({
        where: { userId, loggedAt: { gte: dayStart }, quality: { not: null } },
        orderBy: { loggedAt: 'desc' },
      });
      return r?.quality != null ? (QUALITY_LABELS[r.quality] ?? `Sleep ${r.quality}/5`) : null;
    }
    case 'moodLog': {
      // L1-008 (evening) is the categorical mood-shift; L1-003 (morning) is the
      // numeric emoji scale captured via the manual /mood path (slot null).
      if (s.slot === 'evening') {
        const r = await prisma.moodLog.findFirst({
          where: { userId, loggedAt: { gte: dayStart }, slot: 'evening' },
          orderBy: { loggedAt: 'desc' },
        });
        return r?.moodShift ?? null;
      }
      const r = await prisma.moodLog.findFirst({
        where: { userId, loggedAt: { gte: dayStart }, feeling: { not: null } },
        orderBy: { loggedAt: 'desc' },
      });
      return r?.feeling != null ? (FEELING_LABELS[r.feeling] ?? `Mood ${r.feeling}/5`) : null;
    }
    default: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const r = await (prisma as any)[s.model].findUnique({
        where: { userId_date: { userId, date: dayKey(dayStart) } },
      });
      return r?.category ?? null;
    }
  }
}

export interface DayTrackerView {
  nudgeId: string;
  tier: DayTier;
  label: string;
  question: string;
  options: string[];
  required: boolean;
  answered: boolean;
  answer: string | null;
}

export interface DaySheet {
  date: string;
  total: number;
  answeredCount: number;
  trackers: DayTrackerView[];
}

export async function getDaySheet(userId: string, now: Date): Promise<DaySheet> {
  const dayStart = startOfDay(now);
  // Same phrasing the day's push and cards used, so the sheet does not re-ask in other words.
  const ctx = await questionContext(userId, dayStart);

  const trackers: DayTrackerView[] = [];
  for (const id of DAY_TRACKER_ORDER) {
    const meta = DAY_TRACKERS[id]!;
    const def = getNudge(id);
    if (!def) continue;

    const answer = await readAnswer(userId, def, dayStart);
    trackers.push({
      nudgeId: id,
      tier: meta.tier,
      label: meta.label,
      question: nudgeQuestion(id, def.question, ctx),
      options: def.options,
      required: def.required,
      answered: answer !== null,
      answer,
    });
  }

  return {
    date: dayStart.toISOString().split('T')[0]!,
    total: trackers.length,
    answeredCount: trackers.filter((t) => t.answered).length,
    trackers,
  };
}
