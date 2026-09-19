import { copy, fill } from '../i18n/index.js';
import cron from 'node-cron';
import { prisma } from '@anuva/database';
import { logger } from '../logger.js';
import { buildSummaryForSignals, weeklyLearnNudge } from './digest.js';
import { readerFor } from './articles.js';
import { ACTION_PENDING_REMINDER } from './content.js';
import { resolveTodayNudge } from './nudgeLog.js';
import type { FamilyNudgeLayer } from './nudges.js';
import { sendToFamilyMember } from './push.js';

const log = logger.child({ module: 'family-jobs' });

const TZ = process.env.NUDGE_TIMEZONE?.trim() || 'Asia/Kolkata';

/**
 * What the family app does on its own.
 *
 * All of it is deliberately quiet. A family member is not the daily user of this product, and a
 * companion app that nags is one that gets its notifications switched off — after which the whole
 * feature is dead. The budget is three cadence nudges a week, one twice-weekly reading prompt, and
 * reminders they explicitly asked for. Nothing else belongs here without taking something out.
 */

/**
 * How long a selected-but-unconfirmed action waits before we ask about it. Long enough not to badger
 * someone who is mid-call, short enough to still land the same day.
 */
const PENDING_ACTION_HOURS = 4;

/**
 * "Remind me later" from the support sheet. They asked to be reminded, so this is the one push that
 * is unambiguously wanted.
 *
 * The reminder is cleared before the send, not after: a push failure must not leave the row armed to
 * fire again on the next tick, which would turn one missed notification into a loop.
 */
export async function sendDueSupportReminders(now = new Date()): Promise<number> {
  const due = await prisma.familyMember.findMany({
    where: { status: 'active', supportRemindAt: { lte: now } },
    select: { id: true, name: true, user: { select: { name: true, familyFeatureOptOut: true } } },
  });

  let sent = 0;

  for (const member of due) {
    await prisma.familyMember.update({
      where: { id: member.id },
      data: { supportRemindAt: null },
    });

    // She may have turned family sharing off between the reminder being set and it firing.
    if (member.user.familyFeatureOptOut) {
      continue;
    }

    const name = member.user.name?.trim().split(/\s+/)[0];
    // A builder, so the text is written in this member's own language (see sendToFamilyMember).
    sent += await sendToFamilyMember(
      member.id,
      () => ({
        title: JOB_TEXT.reminderTitle,
        body: fill(JOB_TEXT.reminderBody, { name: name || JOB_TEXT.herFallback }),
      }),
      { url: '/' },
    );
  }

  if (due.length > 0) {
    log.info({ due: due.length, sent }, 'family support reminders processed');
  }

  return sent;
}

/**
 * The workbook's "Still on your list?" reminder — an action they chose and never confirmed.
 *
 * Distinct from "remind me later", which is a request for a prompt. This one chases an intention
 * they already formed, so it fires once and then clears: someone who picked "call her" and did not
 * get to it does not need asking twice, and a second push would be the app grading them.
 */
export async function sendPendingActionReminders(now = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - PENDING_ACTION_HOURS * 60 * 60 * 1000);

  const pending = await prisma.familyMember.findMany({
    where: {
      status: 'active',
      pendingActionAt: { lte: cutoff },
      user: { familyFeatureOptOut: false, erasedAt: null },
    },
    select: { id: true },
  });

  let sent = 0;

  for (const member of pending) {
    // Cleared first, same reason as above: a failed push must not leave the row re-armed.
    await prisma.familyMember.update({
      where: { id: member.id },
      data: { pendingActionKind: null, pendingActionAt: null },
    });

    sent += await sendToFamilyMember(
      member.id,
      () => ({ title: ACTION_PENDING_REMINDER.title, body: ACTION_PENDING_REMINDER.body }),
      { url: '/' },
    );
  }

  if (pending.length > 0) {
    log.info({ pending: pending.length, sent }, 'family pending-action reminders processed');
  }

  return sent;
}

/**
 * The twice-weekly learning nudge. Content comes from the same rotation the Learn tab serves, so the
 * notification and the screen behind it agree — a push promising an insight that the tab does not
 * show is worse than no push.
 */
export async function sendWeeklyLearnNudge(now = new Date()): Promise<number> {
  const members = await prisma.familyMember.findMany({
    where: {
      status: 'active',
      user: { familyFeatureOptOut: false, erasedAt: null },
      fcmTokens: { some: { status: 'ACTIVE' } },
    },
    select: { id: true },
  });

  let sent = 0;

  for (const member of members) {
    sent += await sendToFamilyMember(
      member.id,
      () => {
        const nudge = weeklyLearnNudge(now);
        return { title: nudge.headline, body: nudge.body };
      },
      { url: '/learn' },
    );
  }

  if (members.length > 0) {
    log.info({ members: members.length, sent }, 'family learn nudge sent');
  }

  return sent;
}

/** What the lock screen says, per layer. Deliberately contentless — see below. */
const CADENCE_TITLES: Record<FamilyNudgeLayer, string> = copy('family.cadenceTitles', {
  understand: 'Something worth knowing today',
  connect: 'A moment with her',
  act: 'One small thing today',
});

const JOB_TEXT = copy('family.jobText', {
  reminderTitle: 'A small thing today?',
  reminderBody: 'You wanted a nudge to check in on {{name}}.',
  herFallback: 'her',
  cadenceBody: 'Open Anuva for today’s nudge.',
});

/**
 * One layer of the weekly cadence, for everyone with a device registered.
 *
 * The push does not carry the nudge's own text, and that is the important decision in this function.
 * The nudge is chosen from her week, so its wording leaks the choice — and a lock screen is read by
 * whoever picks the phone up. "Her day looks heavy, take one thing off her plate" on a handset left
 * on a kitchen counter discloses more than she agreed to when she shared four metrics in words.
 * "Something worth knowing today" discloses nothing and still gets the app opened.
 *
 * `resolveTodayNudge` writes the day's row here, so the card the member opens is the one this job
 * chose rather than a second roll of the dice.
 */
export async function sendCadenceNudge(
  layer: FamilyNudgeLayer,
  now = new Date(),
): Promise<number> {
  const members = await prisma.familyMember.findMany({
    where: {
      status: 'active',
      user: { familyFeatureOptOut: false, erasedAt: null },
      fcmTokens: { some: { status: 'ACTIVE' } },
    },
    select: { id: true, relationship: true, userId: true },
  });

  let sent = 0;
  let chosen = 0;

  for (const member of members) {
    // Per member rather than per patient: two members of one household can be different readers.
    // `buildSummaryForSignals` is cached per patient for five minutes, so a household still shares
    // one aggregate rather than recomputing it each time round this loop.
    let signals: Awaited<ReturnType<typeof buildSummaryForSignals>> = [];
    try {
      signals = await buildSummaryForSignals(member.userId);
    } catch (e) {
      // A patient mid-erasure, or a summary that will not build. Neither is a reason to skip the
      // nudge — evergreen copy is still the right thing to send, and is what an empty list selects.
      log.warn({ err: e, familyMemberId: member.id }, 'family: signals unavailable, using evergreen');
    }

    const resolved = await resolveTodayNudge({
      familyMemberId: member.id,
      reader: readerFor(member.relationship),
      signals,
      channel: 'push',
      layer,
      now,
    });

    if (!resolved) continue;
    chosen += 1;

    // They opened the app before the cron ran and have already seen today's nudge. Pushing now
    // would be a notification about something they have read.
    if (!resolved.created) continue;

    sent += await sendToFamilyMember(
      member.id,
      () => ({ title: CADENCE_TITLES[layer], body: JOB_TEXT.cadenceBody }),
      { url: '/', nudgeLayer: layer },
    );
  }

  if (members.length > 0) {
    log.info({ layer, members: members.length, chosen, sent }, 'family cadence nudge sent');
  }

  return sent;
}

export function startFamilyJobs(): void {
  if (process.env.FAMILY_JOBS_DISABLED === 'true') {
    log.warn('Family jobs disabled via FAMILY_JOBS_DISABLED');
    return;
  }

  // Every fifteen minutes: a reminder they set for "this evening" should not arrive at midnight.
  cron.schedule('*/15 * * * *', () => void sendDueSupportReminders(), { timezone: TZ });

  // Hourly is enough for a four-hour-old intention, and keeps this off the fifteen-minute tick.
  cron.schedule('5 * * * *', () => void sendPendingActionReminders(), { timezone: TZ });

  // The workbook's cadence. Understand on Monday morning, Connect on Wednesday evening — when
  // someone is actually home — and Act on Saturday morning, with the whole weekend to do it in.
  cron.schedule('0 9 * * 1', () => void sendCadenceNudge('understand'), { timezone: TZ });
  cron.schedule('0 18 * * 3', () => void sendCadenceNudge('connect'), { timezone: TZ });
  cron.schedule('0 10 * * 6', () => void sendCadenceNudge('act'), { timezone: TZ });

  // Tuesday and Friday mid-morning. Two a week, as the Learn tab promises — and mid-morning rather
  // than evening, because this is reading material, not a prompt to act tonight.
  cron.schedule('0 10 * * 2,5', () => void sendWeeklyLearnNudge(), { timezone: TZ });

  log.info({ timezone: TZ }, 'Family jobs scheduled');
}
