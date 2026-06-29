// ANU Nudge Engine — core dispatch & persistence.
// Builds the card(s) a slot should surface (routine L1 bundle + contextual L2,
// or an L3 trigger that takes priority), persists answers to their per-domain
// model, and tracks governor state (NudgeDailyState / NudgeSendLog / L3TriggerLog).

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
import { selectL2Nudge } from './selectL2Nudge.js';
import { detectTriggers } from './triggers.js';
import { HIGH_STRESS, HOTFLASH_PRESENT, OVERWHELMED } from './signals.js';

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
  morning: 'Morning Anchor',
  afternoon: 'Afternoon Pulse',
  evening: 'Evening Close',
};

// Primary mandatory nudge whose governor result gates the whole slot bundle.
const SLOT_PRIMARY: Record<NudgeSlot, string> = {
  morning: 'L1-001',
  afternoon: 'L1-004',
  evening: 'L1-005',
};

// L3 priority order — safety always wins.
const L3_PRIORITY = ['L3-007', 'L3-001', 'L3-002', 'L3-003', 'L3-005', 'L3-008'];

function mustNudge(id: string): NudgeDef {
  const def = getNudge(id);
  if (!def) throw new Error(`Unknown nudge ${id}`);
  return def;
}

export function toCard(def: NudgeDef): NudgeCard {
  return {
    nudgeId: def.id,
    layer: def.layer,
    slot: def.slot,
    question: def.question,
    options: def.options,
    required: def.required,
  };
}

export interface Dispatch {
  slot: NudgeSlot;
  bundleTitle: string;
  cards: NudgeCard[];
  primaryNudgeId: string | null; // what gets recorded as the slot's send
  suppressedReason?: string;
  setDistress: boolean;
}

async function ensureDailyState(userId: string, dayStart: Date) {
  return prisma.nudgeDailyState.upsert({
    where: { userId_date: { userId, date: dayStart } },
    create: { userId, date: dayStart },
    update: {},
  });
}

// Mark nudge engagement when mood/sleep are logged via the manual /mood,/sleep
// path (they are morning L1 trackers, so this satisfies SR-04's morning-anchor).
export async function markTrackerEngagement(userId: string, now: Date): Promise<void> {
  const dayStart = startOfDay(now);
  await prisma.nudgeDailyState.upsert({
    where: { userId_date: { userId, date: dayStart } },
    create: { userId, date: dayStart, lastEngagedAt: now, morningAnchorResponded: true },
    update: { lastEngagedAt: now, morningAnchorResponded: true },
  });
}

export async function carePlanAssigned(userId: string): Promise<boolean> {
  const cp = await prisma.userCarePath.findFirst({
    where: { userId, status: { in: ['selected', 'active'] } },
  });
  return Boolean(cp);
}

// Choose the single optional L2 to append to the Evening Close card.
async function eveningL2(userId: string, now: Date): Promise<string | null> {
  const dow = now.getDay();
  if (dow === 0) return 'L2-008'; // Sunday — family support (weekly)
  if (dow === 5 || dow === 6) return 'L2-010'; // Fri/Sat — weekly mood review

  const dayStart = startOfDay(now);
  const [stress, hotFlash] = await Promise.all([
    prisma.stressLog.findUnique({ where: { userId_date: { userId, date: dayStart } } }),
    prisma.hotFlashDailyLog.findUnique({ where: { userId_date: { userId, date: dayStart } } }),
  ]);
  if (stress && HIGH_STRESS.has(stress.category)) return 'L2-007'; // me-time
  if (hotFlash && HOTFLASH_PRESENT.has(hotFlash.category)) return 'L2-005'; // pain
  return 'L2-004'; // bloating default
}

// Build what should fire for `slot`. L3 triggers (governor-permitted) replace the
// routine bundle; under distress only L3-007 is allowed.
export async function buildDispatch(
  userId: string,
  slot: NudgeSlot,
  now: Date,
): Promise<Dispatch> {
  const dayStart = startOfDay(now);
  const state = await ensureDailyState(userId, dayStart);
  const title = SLOT_TITLES[slot];

  // Distress: only L3-007 Safety may fire.
  if (state.distressFlag) {
    const triggers = await detectTriggers(userId, now);
    if (triggers.includes('L3-007')) {
      const g = await runGovernor(userId, mustNudge('L3-007'), slot, now);
      if (g.allowed) {
        return {
          slot,
          bundleTitle: title,
          cards: [toCard(mustNudge('L3-007'))],
          primaryNudgeId: 'L3-007',
          setDistress: false,
        };
      }
    }
    return { slot, bundleTitle: title, cards: [], primaryNudgeId: null, suppressedReason: 'SR-03', setDistress: false };
  }

  // L3 triggers take priority over the routine bundle for this slot.
  const triggers = await detectTriggers(userId, now);
  for (const id of L3_PRIORITY) {
    if (!triggers.includes(id)) continue;
    const g = await runGovernor(userId, mustNudge(id), slot, now);
    if (g.allowed) {
      return { slot, bundleTitle: title, cards: [toCard(mustNudge(id))], primaryNudgeId: id, setDistress: false };
    }
  }

  // Routine bundle — gated by the slot's primary mandatory nudge.
  const primary = mustNudge(SLOT_PRIMARY[slot]);
  const gate = await runGovernor(userId, primary, slot, now);
  if (!gate.allowed) {
    return { slot, bundleTitle: title, cards: [], primaryNudgeId: null, suppressedReason: gate.suppressedBy, setDistress: false };
  }

  const ids: string[] = [];
  let setDistress = false;

  if (slot === 'morning') {
    ids.push('L1-001', 'L1-002', 'L1-003');
  } else if (slot === 'afternoon') {
    ids.push('L1-004');
    const l2 = await selectL2Nudge(userId, now);
    if (l2.nudgeId) ids.push(l2.nudgeId);
    setDistress = l2.setDistress;
  } else {
    ids.push('L1-005', 'L1-006');
    if (await carePlanAssigned(userId)) ids.push('L1-007');
    ids.push('L1-008');
    const l2 = await eveningL2(userId, now);
    if (l2) ids.push(l2);
  }

  // SR-05: drop individual cards whose tracker was already self-logged today.
  const cards: NudgeCard[] = [];
  for (const id of ids) {
    const def = getNudge(id);
    if (!def) continue;
    const g = await runGovernor(userId, def, slot, now);
    if (g.allowed) cards.push(toCard(def));
  }

  return {
    slot,
    bundleTitle: title,
    cards,
    primaryNudgeId: cards.length ? SLOT_PRIMARY[slot] : null,
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
) {
  const def = getNudge(nudgeId);
  const dayStart = startOfDay(now);
  await prisma.$transaction([
    prisma.nudgeSendLog.create({
      data: { userId, nudgeId, layer: def?.layer ?? 1, slot, sentAt: now },
    }),
    prisma.nudgeDailyState.upsert({
      where: { userId_date: { userId, date: dayStart } },
      create: { userId, date: dayStart, nudgeCount: 1, distressFlag: setDistress },
      update: { nudgeCount: { increment: 1 }, ...(setDistress ? { distressFlag: true } : {}) },
    }),
    ...(def?.layer === 3
      ? [prisma.l3TriggerLog.create({ data: { userId, triggerId: nudgeId, firedAt: now } })]
      : []),
  ]);
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
    case 'none':
      return; // L3 trigger prompt — engagement only
    default: {
      // All remaining per-domain daily logs share the upsert-by-day shape.
      const model = s.model;
      const extra = model === 'stressLog' ? { overwhelmed: answer === OVERWHELMED } : {};
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (prisma as any)[model].upsert({
        where: { userId_date: { userId, date: dayStart } },
        create: { userId, date: dayStart, category: answer, ...extra },
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
  const setDistress =
    (def.id === 'L1-004' && answer === OVERWHELMED) || def.id === 'L3-007' && answer !== 'None of these';

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
      where: { userId_date: { userId, date: dayStart } },
      create: { userId, date: dayStart, ...engagementPatch },
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
    case 'none':
      return null;
    default: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const r = await (prisma as any)[s.model].findUnique({
        where: { userId_date: { userId, date: dayStart } },
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
  const dow = now.getDay();

  const [user, hasCarePlan] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { dieticianPlanAssigned: true } }),
    carePlanAssigned(userId),
  ]);

  const trackers: DayTrackerView[] = [];
  for (const id of DAY_TRACKER_ORDER) {
    const meta = DAY_TRACKERS[id]!;
    const def = getNudge(id);
    if (!def) continue;
    // Contextual relevance — same gates as the nudge exceptions.
    if (meta.requires === 'carePlan' && !hasCarePlan) continue;
    if (meta.requires === 'dietician' && !user?.dieticianPlanAssigned) continue;
    if (meta.weeklyDays && !meta.weeklyDays.includes(dow)) continue;

    const answer = await readAnswer(userId, def, dayStart);
    trackers.push({
      nudgeId: id,
      tier: meta.tier,
      label: meta.label,
      question: def.question,
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
