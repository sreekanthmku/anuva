// Medication reminders — the sender.
//
// A minute tick, separate from the nudge scheduler: nudges go out in three fixed daily slots, but a
// reminder has to arrive at the minute she chose. It also never passes through the nudge governor —
// the daily cap and "already logged" rules exist to keep suggestions quiet, and a reminder she asked
// for is not a suggestion.
//
// Every send is claimed in the database before the push goes out: the first send by creating the
// dose row (unique per reminder and time), the follow-up and the snooze by a conditional update. A
// restart, an overlapping tick or a second instance therefore cannot send one twice, and a failed
// push is a missed notification rather than a loop.

import cron from 'node-cron';
import { prisma } from '@anuva/database';
import { MEDICATION_FOLLOW_UP_MINUTES } from '@anuva/shared';
import { withLanguage } from '../i18n/index.js';
import { logger } from '../logger.js';
import { sendToAudience } from '../push/dispatch.js';
import { MEDICATION_PUSH, kindKey } from './copy.js';
import { dueOccurrences, nextOccurrence, type ReminderSchedule } from './schedule.js';

const log = logger.child({ module: 'medication' });

const MINUTE_MS = 60 * 1000;

/// How late a reminder may still go out — after downtime, say. Later than this it is skipped.
export const SEND_GRACE_MS = 15 * MINUTE_MS;
const FOLLOW_UP_MS = MEDICATION_FOLLOW_UP_MINUTES * MINUTE_MS;

type ReminderRow = ReminderSchedule & { id: string; userId: string; kind: string | null };

const LIVE_REMINDER = { active: true, deletedAt: null } as const;

function isUniqueViolation(error: unknown): boolean {
  return (error as { code?: string } | null)?.code === 'P2002';
}

async function push(
  userId: string,
  language: string | null,
  doseId: string,
  kind: string | null,
  followUp: boolean,
): Promise<void> {
  const notification = withLanguage(language, () => ({
    title: followUp ? MEDICATION_PUSH.followUpTitle[kindKey(kind)] : MEDICATION_PUSH.title[kindKey(kind)],
    body: followUp ? MEDICATION_PUSH.followUpBody : MEDICATION_PUSH.body,
  }));
  // The tag makes a follow-up or a snooze replace the earlier notification instead of stacking.
  await sendToAudience({ kind: 'user', userId }, notification, {
    url: `/home?dose=${doseId}`,
    tag: `medication-dose-${doseId}`,
  });
}

async function sendDue(now: Date): Promise<number> {
  const reminders = await prisma.medicationReminder.findMany({
    where: LIVE_REMINDER,
    select: {
      id: true,
      userId: true,
      kind: true,
      times: true,
      days: true,
      weekdays: true,
      timeZone: true,
      startDate: true,
      scheduleChangedAt: true,
      user: { select: { preferredLanguage: true } },
    },
  });

  let sent = 0;
  for (const reminder of reminders) {
    for (const occurrence of dueOccurrences(reminder as ReminderRow, now, SEND_GRACE_MS)) {
      try {
        const dose = await prisma.medicationDose.create({
          data: {
            reminderId: reminder.id,
            userId: reminder.userId,
            scheduledFor: occurrence.scheduledFor,
            date: occurrence.date,
            time: occurrence.time,
            sentAt: now,
          },
          select: { id: true },
        });
        await push(reminder.userId, reminder.user.preferredLanguage, dose.id, reminder.kind, false);
        sent += 1;
      } catch (e) {
        // Already sent — by an earlier tick or another instance.
        if (isUniqueViolation(e)) continue;
        log.error({ err: e, reminderId: reminder.id }, 'Medication reminder send failed');
      }
    }
  }
  return sent;
}

/// One follow-up, 30 minutes after a reminder she has not answered — unless she snoozed it, or the
/// same reminder's next time is due within that half hour anyway.
async function sendFollowUps(now: Date): Promise<number> {
  const doses = await prisma.medicationDose.findMany({
    where: {
      status: 'pending',
      followUpSentAt: null,
      snoozedUntil: null,
      sentAt: { lte: new Date(now.getTime() - FOLLOW_UP_MS), gt: new Date(now.getTime() - FOLLOW_UP_MS - SEND_GRACE_MS) },
      reminder: LIVE_REMINDER,
    },
    select: {
      id: true,
      userId: true,
      scheduledFor: true,
      reminder: {
        select: {
          kind: true,
          times: true,
          days: true,
          weekdays: true,
          timeZone: true,
          startDate: true,
          scheduleChangedAt: true,
        },
      },
      user: { select: { preferredLanguage: true } },
    },
  });

  let sent = 0;
  for (const dose of doses) {
    try {
      // Claimed even when it is then skipped, so it is decided once.
      const claimed = await prisma.medicationDose.updateMany({
        where: { id: dose.id, followUpSentAt: null },
        data: { followUpSentAt: now },
      });
      if (claimed.count === 0) continue;
      const next = nextOccurrence(dose.reminder, dose.scheduledFor);
      if (next && next.getTime() - now.getTime() <= FOLLOW_UP_MS) continue;
      await push(dose.userId, dose.user.preferredLanguage, dose.id, dose.reminder.kind, true);
      sent += 1;
    } catch (e) {
      log.error({ err: e, doseId: dose.id }, 'Medication follow-up failed');
    }
  }
  return sent;
}

/// "Snooze 15 min": the reminder again at the snooze time, and no follow-up after it.
async function sendSnoozed(now: Date): Promise<number> {
  const doses = await prisma.medicationDose.findMany({
    where: {
      status: 'pending',
      snoozeSentAt: null,
      snoozedUntil: { lte: now, gt: new Date(now.getTime() - SEND_GRACE_MS) },
      reminder: LIVE_REMINDER,
    },
    select: {
      id: true,
      userId: true,
      reminder: { select: { kind: true } },
      user: { select: { preferredLanguage: true } },
    },
  });

  let sent = 0;
  for (const dose of doses) {
    try {
      const claimed = await prisma.medicationDose.updateMany({
        where: { id: dose.id, snoozeSentAt: null },
        data: { snoozeSentAt: now },
      });
      if (claimed.count === 0) continue;
      await push(dose.userId, dose.user.preferredLanguage, dose.id, dose.reminder.kind, false);
      sent += 1;
    } catch (e) {
      log.error({ err: e, doseId: dose.id }, 'Medication snooze send failed');
    }
  }
  return sent;
}

export async function runMedicationReminders(now = new Date()) {
  const due = await sendDue(now);
  const followUps = await sendFollowUps(now);
  const snoozed = await sendSnoozed(now);
  if (due + followUps + snoozed > 0) {
    log.info({ due, followUps, snoozed }, 'Medication reminders sent');
  }
  return { due, followUps, snoozed };
}

export function startMedicationReminderJob(): void {
  if (process.env.MEDICATION_REMINDERS_DISABLED === 'true') {
    log.warn('Medication reminders disabled via MEDICATION_REMINDERS_DISABLED');
    return;
  }
  // A slow tick must not overlap the next one; the claims make an overlap harmless, but there is
  // no reason to pay for it.
  let running = false;
  cron.schedule('* * * * *', () => {
    if (running) return;
    running = true;
    runMedicationReminders()
      .catch((e: unknown) => log.error({ err: e }, 'Medication reminder tick failed'))
      .finally(() => {
        running = false;
      });
  });
  log.info('Medication reminder job started');
}
