// ANU v3 orchestration.
//
//   1. Classify  ┐     safety classification (classifier.ts), in parallel with
//      Context   ┘     the runtime context reads (context.ts), the free
//                      appointment times (booking.ts), the trackers she can
//                      log (trackers.ts) and whether she has medication reminders
//   2. Reply           the v2.0 production prompt + runtime context + thread,
//                      returning a structured decision object
//   3. Check           checks.ts verifies the hard rules (one question, Anuva
//                      pathways, no template openers, no medicine, crisis
//                      helplines, no times beside slot buttons, no "I booked"),
//                      with medicineJudge.ts reading any draft that mentions a
//                      medicine; a broken rule gets ONE model rewrite
//   4. Enforce         code checks the action, the slot and log buttons, and the
//                      risk floor — but never writes reply text itself
//
// Every word she reads is written by the model. Unlike classic, there is no
// deterministic red-flag gate and no clinician text served verbatim; safety is
// the classifier plus the prompt's crisis mode. Nothing here touches the Q&A
// bank, the follow-up chips, the probe ladder or the semantic cache. v3 turns
// are written to AnuChatTurn with mode "v3", which keeps them out of the
// classic/probe threads (both filter on mode) and theirs out of this one.
//
// Booking, logging and reminders: the model only chooses which buttons to show.
// She books through /consultations/book, logs through the tracker endpoints and
// sets up a medication reminder in its editor herself;
// after a booking the app calls confirmBooking() so ANU can write the
// confirmation, with the booking read back from the database.

import { prisma } from '@anuva/database';
import { z } from 'zod';
import type { AnuChatV3Response, AnuV3LogOption, AnuV3Slot } from '@anuva/shared';
import { logger } from '../../logger.js';
import { THREAD_IDLE_MS } from '../engine.js';
import { sanitizeName } from '../prompt.js';
import { actionHref } from './actions.js';
import { formatSlotLong, loadSlotCatalog, type SlotCatalog } from './booking.js';
import { findViolations, rewriteDirective } from './checks.js';
import { classify, riskRank, RISK_LEVELS, type SafetyClassification } from './classifier.js';
import { buildRuntimeContext, renderRuntimeContext, type RuntimeContext } from './context.js';
import { chatJson, v3Env, type ChatMessage } from './llm.js';
import { judgeMedicine, mentionsMedicine } from './medicineJudge.js';
import { SYSTEM_PROMPT, V3_PROMPT_VERSION } from './prompt.js';
import { loadTrackerCatalog, type TrackerCatalog } from './trackers.js';

export const V3_MODE = 'v3';

/// Turns replayed to the reply model. More than classic's two: v3 holds a
/// conversation across clarifying questions ("is pregnancy possible?" → "no"),
/// and the answer is meaningless without the question two turns up.
const THREAD_TURNS = 6;

const MAX_SLOT_BUTTONS = 3;
const MAX_LOG_BUTTONS = 2;

// As in the classic engine: messages and replies are never logged, only the
// routing decision.
const log = logger.child({ module: 'anu', engine: V3_MODE });

const CRISIS_HELPLINES_IN = [
  { name: 'Emergency', number: '112' },
  { name: 'Tele-MANAS (24x7, free)', number: '14416' },
];

const decisionSchema = z.object({
  message: z.string().trim().min(1),
  risk_level: z.enum(RISK_LEVELS),
  intent: z.string(),
  next_action: z.string().nullable(),
  professional_pathway: z.string().nullable(),
  needs_clarification: z.boolean(),
  clarification_type: z.string().nullable(),
  safety_flag: z.boolean(),
  quick_replies: z.array(z.string()),
  offer_slots: z.array(z.string()),
  log_options: z.array(z.string()),
  offer_reminder: z.boolean(),
});

type Decision = z.infer<typeof decisionSchema>;

/// `next_action` and `professional_pathway` are constrained to this turn's
/// lists in the schema itself, so an invented action cannot come back at all.
function nullableEnum(values: string[]) {
  return values.length > 0
    ? { anyOf: [{ type: 'string', enum: values }, { type: 'null' }] }
    : { type: 'null' };
}

/// Same for slot refs and tracker ids: only this turn's.
function enumArray(values: string[]) {
  return values.length > 0
    ? { type: 'array', items: { type: 'string', enum: values } }
    : { type: 'array', items: { type: 'string' }, maxItems: 0 };
}

export function replySchema(
  actions: string[],
  professionalTypes: string[],
  slotRefs: string[] = [],
  trackerIds: string[] = [],
) {
  return {
    type: 'object',
    additionalProperties: false,
    required: [
      'message',
      'risk_level',
      'intent',
      'next_action',
      'professional_pathway',
      'needs_clarification',
      'clarification_type',
      'safety_flag',
      'quick_replies',
      'offer_slots',
      'log_options',
      'offer_reminder',
    ],
    properties: {
      message: { type: 'string' },
      risk_level: { type: 'string', enum: [...RISK_LEVELS] },
      intent: { type: 'string' },
      next_action: nullableEnum(actions),
      professional_pathway: nullableEnum(professionalTypes),
      needs_clarification: { type: 'boolean' },
      clarification_type: { type: ['string', 'null'] },
      safety_flag: { type: 'boolean' },
      quick_replies: { type: 'array', items: { type: 'string' } },
      offer_slots: enumArray(slotRefs),
      log_options: enumArray(trackerIds),
      offer_reminder: { type: 'boolean' },
    },
  };
}

/// What a recorded turn's `decision` may hold that the thread and history read
/// back. Written by this file only.
type StoredDecision = {
  escalated?: unknown;
  action?: unknown;
  offered_slots?: unknown;
  log_options?: unknown;
  reminder_offer?: unknown;
  booked?: unknown;
  event?: unknown;
};

function storedSlots(decision: StoredDecision): (AnuV3Slot & { label?: string })[] {
  return Array.isArray(decision.offered_slots) ? (decision.offered_slots as (AnuV3Slot & { label?: string })[]) : [];
}

function storedLogOptions(decision: StoredDecision): { option: AnuV3LogOption; name: string }[] {
  return Array.isArray(decision.log_options)
    ? (decision.log_options as { option: AnuV3LogOption; name: string }[])
    : [];
}

async function loadThread(userId: string): Promise<ChatMessage[]> {
  const rows = await prisma.anuChatTurn.findMany({
    where: {
      userId,
      mode: V3_MODE,
      createdAt: { gte: new Date(Date.now() - THREAD_IDLE_MS) },
    },
    orderBy: { createdAt: 'desc' },
    take: THREAD_TURNS,
    select: { userMessage: true, reply: true, decision: true },
  });
  // Crisis turns stay in: the classifier has to read "yes" after a crisis
  // reply as the answer to it. The buttons a reply showed are replayed as app
  // notes, so "the Friday one" or "I logged it" has something to refer to.
  return rows.reverse().flatMap((row) => {
    const decision = (row.decision ?? {}) as StoredDecision;
    const messages: ChatMessage[] = [];
    const event = decision.event as { type?: string; with?: string; date_time?: string } | undefined;
    if (event?.type === 'booking_confirmed') {
      messages.push({
        role: 'system',
        content: `App event: she booked an appointment with ${event.with} for ${event.date_time}, and the booking system confirmed it.`,
      });
    } else {
      messages.push({ role: 'user', content: row.userMessage });
    }
    messages.push({ role: 'assistant', content: row.reply });

    const notes: string[] = [];
    const slots = storedSlots(decision);
    if (slots.length > 0) {
      notes.push(
        `the app showed appointment buttons for: ${slots
          .map((slot) => slot.label ?? `${formatSlotLong(new Date(slot.startsAt))} with ${slot.specialistName}`)
          .join('; ')}${decision.booked ? ' — she booked one of them' : ''}`,
      );
    }
    const logs = storedLogOptions(decision);
    if (logs.length > 0) {
      notes.push(`the app showed log buttons for: ${logs.map((entry) => entry.name).join(', ')}`);
    }
    if (decision.reminder_offer === true) {
      notes.push('the app showed a "Set a reminder" button for her medication or supplement reminders');
    }
    if (notes.length > 0) {
      messages.push({ role: 'system', content: `App note on the reply above: ${notes.join('. ')}.` });
    }
    return messages;
  });
}

async function recordTurn(turn: {
  userId: string;
  userMessage: string;
  reply: string;
  suggestions: string[];
  decision: Record<string, unknown>;
}): Promise<string | null> {
  try {
    const row = await prisma.anuChatTurn.create({
      data: {
        userId: turn.userId,
        userMessage: turn.userMessage,
        reply: turn.reply,
        suggestions: turn.suggestions,
        source: 'model',
        promptVersion: V3_PROMPT_VERSION,
        mode: V3_MODE,
        decision: turn.decision as object,
      },
      select: { id: true },
    });
    return row.id;
  } catch (e) {
    // The audit write must never cost her the reply.
    log.error({ err: e, userId: turn.userId }, 'Failed to record v3 chat turn');
    return null;
  }
}

function cleanQuickReplies(replies: string[], userMessage: string): string[] {
  const seen = new Set<string>([userMessage.trim().toLowerCase()]);
  const out: string[] = [];
  for (const reply of replies) {
    const text = reply.trim();
    const key = text.toLowerCase();
    if (!text || text.length > 60 || seen.has(key)) continue;
    seen.add(key);
    out.push(text);
    if (out.length === 3) break;
  }
  return out;
}

const EMPTY_SLOTS: SlotCatalog = { context: [], byRef: new Map() };
const EMPTY_TRACKERS: TrackerCatalog = { context: [], byId: new Map() };

/// Generate, check, and rewrite once if a hard rule is broken. Shared by a
/// normal turn and the booking confirmation.
async function generateChecked(options: {
  userId: string;
  userMessage: string | null;
  messages: ChatMessage[];
  schema: Record<string, unknown>;
  check: (decision: Decision, medicineSuggested: boolean | null) => string[];
}): Promise<{ decision: Decision; firstViolations: string[]; remainingViolations: string[] }> {
  const { userId } = options;
  const generate = async (directive: string | null): Promise<Decision> =>
    decisionSchema.parse(
      await chatJson({
        model: v3Env.replyModel(),
        effort: v3Env.replyEffort(),
        temperature: 0.6,
        schemaName: 'anu_reply',
        schema: options.schema,
        messages: directive
          ? // The directive goes just before her message, or last when there is none.
            options.userMessage !== null
            ? [
                ...options.messages.slice(0, -1),
                { role: 'system', content: directive },
                options.messages.at(-1)!,
              ]
            : [...options.messages, { role: 'system', content: directive }]
          : options.messages,
      }),
    );

  const violationsOf = async (d: Decision) => {
    const medicineSuggested = mentionsMedicine(d.message)
      ? await judgeMedicine(options.userMessage ?? '(app event — no message from her)', d.message).catch(
          (e: unknown) => {
            log.warn({ err: e, userId }, 'v3: medicine judge failed — using patterns');
            return null;
          },
        )
      : false;
    return options.check(d, medicineSuggested);
  };

  // One rewrite, by the model, with the broken rules spelled out — never a code
  // edit. A second miss is served (a reply beats a failed turn) and logged so
  // the rule can be tuned.
  let decision = await generate(null);
  const firstViolations = await violationsOf(decision);
  let remainingViolations: string[] = [];
  if (firstViolations.length > 0) {
    const rewrite = await generate(rewriteDirective(firstViolations));
    remainingViolations = await violationsOf(rewrite);
    // Keep whichever draft breaks fewer rules.
    if (remainingViolations.length <= firstViolations.length) decision = rewrite;
    else remainingViolations = firstViolations;
    if (remainingViolations.length > 0) {
      log.warn({ userId, remaining: remainingViolations.length }, 'v3: reply still breaks a hard check after rewrite');
    }
  }
  return { decision, firstViolations, remainingViolations };
}

/// The audit row already holds the text she read as `reply`.
function decisionFields(decision: Decision) {
  return Object.fromEntries(Object.entries(decision).filter(([key]) => key !== 'message'));
}

export async function answer(
  userId: string,
  userMessage: string,
  userName?: string | null,
): Promise<AnuChatV3Response> {
  const startedAt = Date.now();
  const name = sanitizeName(userName);

  const thread = await loadThread(userId);

  // 1. Classification and context are independent; run them together. A failed
  // classification is not a failed turn — the reply prompt carries its own
  // crisis rules and is told the risk level is UNKNOWN. Nor is a failed slot or
  // tracker read: the reply just has no buttons to offer.
  const [safety, context, slotCatalog, trackerCatalog, reminderCount] = await Promise.all([
    classify(userMessage, thread).catch((e: unknown): SafetyClassification | null => {
      log.error({ err: e, userId }, 'v3: safety classification failed — continuing as UNKNOWN');
      return null;
    }),
    buildRuntimeContext(userId, name),
    loadSlotCatalog().catch((e: unknown) => {
      log.error({ err: e, userId }, 'v3: slot read failed — no appointment buttons this turn');
      return EMPTY_SLOTS;
    }),
    loadTrackerCatalog(userId).catch((e: unknown) => {
      log.error({ err: e, userId }, 'v3: tracker read failed — no log buttons this turn');
      return EMPTY_TRACKERS;
    }),
    prisma.medicationReminder.count({ where: { userId, deletedAt: null } }).catch((e: unknown) => {
      log.error({ err: e, userId }, 'v3: reminder read failed — no reminder button this turn');
      return null;
    }),
  ]);
  context.risk_level = safety?.risk_level ?? 'UNKNOWN';
  if (safety) {
    // Trusted context for the reply model. The pathway is a hint, not a promise
    // that the professional is bookable — available_professional_types decides that.
    context.safety_classification = {
      risk_level: safety.risk_level,
      flags: safety.flags,
      requires_emergency_escalation: safety.requires_emergency_escalation,
      recommended_pathway: safety.recommended_pathway,
    };
  }
  if (slotCatalog.context.length > 0) context.available_slots = slotCatalog.context;
  if (trackerCatalog.context.length > 0) context.loggable_trackers = trackerCatalog.context;
  if (reminderCount !== null) context.medication_reminders = { set_up: reminderCount };

  const actions = context.available_actions as string[];
  const professionalTypes = context.available_professional_types as string[];
  const crisis = safety?.crisis === true;
  const inIndia = context.user_country === 'IN';

  // 2–3. Reply and check.
  const { decision, firstViolations, remainingViolations } = await generateChecked({
    userId,
    userMessage,
    schema: replySchema(actions, professionalTypes, [...slotCatalog.byRef.keys()], [...trackerCatalog.byId.keys()]),
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'system', content: renderRuntimeContext(context) },
      ...thread,
      { role: 'user', content: userMessage },
    ],
    check: (d, medicineSuggested) =>
      findViolations({
        message: d.message,
        riskLevel:
          safety && riskRank(safety.risk_level) > riskRank(d.risk_level) ? safety.risk_level : d.risk_level,
        crisis,
        inIndia,
        professionalTypes,
        medicineSuggested,
        offeredSlots: d.offer_slots.filter((ref) => slotCatalog.byRef.has(ref)).length,
      }),
  });

  // 4. Enforce. The schema already limits these, but the lists are re-checked
  // here so a provider that ignores `strict` cannot slip one through.
  // Never below what the classifier saw: the reply model may not talk a risk down.
  const finalRisk =
    safety && riskRank(safety.risk_level) > riskRank(decision.risk_level)
      ? safety.risk_level
      : decision.risk_level;
  const reply = decision.message;

  // No appointment buttons in an emergency — emergency care comes first — and
  // no log buttons on any safety turn.
  const slots =
    finalRisk === 'L4'
      ? []
      : [...new Set(decision.offer_slots)]
          .flatMap((ref) => slotCatalog.byRef.get(ref) ?? [])
          .slice(0, MAX_SLOT_BUTTONS);
  const logIds =
    riskRank(finalRisk) >= riskRank('L3')
      ? []
      : [...new Set(decision.log_options)].filter((id) => trackerCatalog.byId.has(id)).slice(0, MAX_LOG_BUTTONS);
  const logOptions = logIds.map((id) => trackerCatalog.byId.get(id)!);
  // A routine-keeping button has no place in a safety reply.
  const reminderOffer = decision.offer_reminder && reminderCount !== null && riskRank(finalRisk) < riskRank('L3');

  // The slot and log buttons already do what these navigation buttons would.
  let actionType =
    decision.next_action && actions.includes(decision.next_action) ? decision.next_action : null;
  if (logOptions.length > 0 && actionType === 'LOG_SYMPTOM') actionType = null;
  if (slots.length > 0 && (actionType === 'VIEW_AVAILABLE_APPOINTMENTS' || actionType === 'VIEW_GYNECOLOGISTS')) {
    actionType = null;
  }
  const href = actionType ? actionHref(actionType) : null;
  const action = actionType && href ? { type: actionType, href } : null;

  const escalated = riskRank(finalRisk) >= riskRank('L3');
  const escalation = escalated
    ? {
        area: safety?.flags[0] ?? decision.intent,
        urgency: finalRisk === 'L4' ? 'Urgent' : 'Prompt medical review',
        recommendedSpecialist:
          decision.professional_pathway ?? safety?.recommended_pathway ?? 'Medical review',
        helplines: crisis && inIndia ? CRISIS_HELPLINES_IN : [],
      }
    : null;

  // No casual tap-replies under an emergency — same rule as classic's safety turns.
  const suggestions = finalRisk === 'L4' ? [] : cleanQuickReplies(decision.quick_replies, userMessage);

  const trackerNames = new Map(trackerCatalog.context.map((entry) => [entry.id, entry.name]));
  const turnId = await recordTurn({
    userId,
    userMessage,
    reply,
    suggestions,
    decision: {
      classifier: safety,
      reply: decisionFields(decision),
      final_risk_level: finalRisk,
      action,
      escalated,
      offered_slots: slots.map((slot) => ({
        ...slot,
        label: `${formatSlotLong(new Date(slot.startsAt))} with ${slot.specialistName}`,
      })),
      log_options: logIds.map((id) => ({ option: trackerCatalog.byId.get(id), name: trackerNames.get(id) ?? id })),
      reminder_offer: reminderOffer,
      checks: { first: firstViolations, remaining: remainingViolations },
      models: { reply: v3Env.replyModel(), classifier: v3Env.classifierModel() },
    },
  });

  log.info(
    {
      userId,
      source: 'model',
      classifierRisk: safety?.risk_level ?? 'UNKNOWN',
      replyRisk: decision.risk_level,
      finalRisk,
      intent: decision.intent,
      action: actionType,
      pathway: decision.professional_pathway,
      clarifying: decision.needs_clarification,
      slotButtons: slots.length,
      logButtons: logOptions.length,
      reminderButton: reminderOffer,
      threadTurns: thread.filter((m) => m.role === 'assistant').length,
      ms: Date.now() - startedAt,
    },
    'ANU v3 turn served',
  );

  return { turnId, reply, suggestions, source: 'model', escalation, action, slots, logOptions, reminderOffer };
}

/// After she confirmed a slot and /consultations/book succeeded, ANU writes the
/// confirmation. The booking is read back from the database — the client only
/// names it — so the reply can only ever confirm a booking that exists.
/// Returns null when there is no such booking of hers.
export async function confirmBooking(
  userId: string,
  consultationId: string,
  originTurnId: string | undefined,
  userName?: string | null,
): Promise<AnuChatV3Response | null> {
  const consultation = await prisma.consultation.findFirst({
    where: { id: consultationId, userId, status: { in: ['pending', 'confirmed'] } },
    select: { id: true, scheduledAt: true, specialist: { select: { name: true, tag: true } } },
  });
  if (!consultation) return null;

  const name = sanitizeName(userName);
  const [thread, context] = await Promise.all([loadThread(userId), buildRuntimeContext(userId, name)]);
  const event = {
    type: 'booking_confirmed',
    consultation_id: consultation.id,
    with: consultation.specialist.name,
    date_time: `${formatSlotLong(consultation.scheduledAt)} (India time)`,
  };
  const runtime: RuntimeContext = {
    ...context,
    risk_level: 'L0',
    booking_event: {
      status: 'confirmed',
      with: event.with,
      specialty: consultation.specialist.tag,
      date_time: event.date_time,
    },
  };
  const professionalTypes = context.available_professional_types as string[];

  const { decision, firstViolations, remainingViolations } = await generateChecked({
    userId,
    userMessage: null,
    schema: replySchema(context.available_actions as string[], professionalTypes),
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'system', content: renderRuntimeContext(runtime) },
      ...thread,
      {
        role: 'system',
        content:
          'APP EVENT: she has just confirmed an appointment in the app and the booking system returned success (see booking_event in the runtime context). Write the confirmation now.',
      },
    ],
    check: (d, medicineSuggested) =>
      findViolations({
        message: d.message,
        riskLevel: 'L0',
        crisis: false,
        inIndia: context.user_country === 'IN',
        professionalTypes,
        medicineSuggested,
        bookingConfirmed: true,
      }),
  });

  const turnId = await recordTurn({
    userId,
    userMessage: '',
    reply: decision.message,
    suggestions: [],
    decision: {
      event,
      reply: decisionFields(decision),
      final_risk_level: 'L0',
      action: null,
      escalated: false,
      checks: { first: firstViolations, remaining: remainingViolations },
      models: { reply: v3Env.replyModel() },
    },
  });

  // Mark the turn she booked from, so its buttons show as booked on reload.
  if (originTurnId) {
    const origin = await prisma.anuChatTurn.findFirst({
      where: { id: originTurnId, userId, mode: V3_MODE },
      select: { id: true, decision: true },
    });
    if (origin) {
      await prisma.anuChatTurn
        .update({
          where: { id: origin.id },
          data: {
            decision: { ...((origin.decision ?? {}) as object), booked: { consultation_id: consultation.id } },
          },
        })
        .catch((e: unknown) => log.error({ err: e, userId }, 'v3: could not mark the turn as booked'));
    }
  }

  log.info({ userId, source: 'model', event: 'booking_confirmed' }, 'ANU v3 booking confirmation served');

  return {
    turnId,
    reply: decision.message,
    suggestions: [],
    source: 'model',
    escalation: null,
    action: null,
    slots: [],
    logOptions: [],
    reminderOffer: false,
  };
}

/// Her v3 thread, oldest first, for the chat screen to restore.
export async function history(userId: string) {
  const rows = await prisma.anuChatTurn.findMany({
    where: { userId, mode: V3_MODE },
    orderBy: { createdAt: 'desc' },
    take: 50,
    select: {
      id: true,
      userMessage: true,
      reply: true,
      suggestions: true,
      decision: true,
      createdAt: true,
    },
  });
  return rows.reverse().map((row) => {
    const decision = (row.decision ?? {}) as StoredDecision;
    const action =
      decision.action &&
      typeof decision.action === 'object' &&
      typeof (decision.action as { type?: unknown }).type === 'string'
        ? (decision.action as { type: string; href: string })
        : null;
    return {
      id: row.id,
      userMessage: row.userMessage,
      reply: row.reply,
      suggestions: row.suggestions,
      source: 'model' as const,
      escalated: decision.escalated === true,
      action,
      slots: storedSlots(decision).map(({ slotId, specialistKey, specialistName, startsAt, endsAt }) => ({
        slotId,
        specialistKey,
        specialistName,
        startsAt,
        endsAt,
      })),
      logOptions: storedLogOptions(decision).map((entry) => entry.option),
      reminderOffer: decision.reminder_offer === true,
      booked: Boolean(decision.booked),
      createdAt: row.createdAt.toISOString(),
    };
  });
}
