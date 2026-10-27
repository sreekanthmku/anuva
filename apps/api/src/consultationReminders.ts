// Consultation reminders — a push to her shortly before a consultation starts.
//
// A minute tick, like medication reminders: the reminder has to land at a time set by the booking,
// not in one of the nudge scheduler's daily slots.
//
// `Consultation.reminderSentFor` holds the start time the reminder was sent for, not a yes/no flag.
// A reschedule moves `scheduledAt`, so the stored time stops matching and the reminder is due again
// for the new slot — nothing has to remember to reset it. Each send is claimed with a conditional
// update before the push goes out, so a restart, an overlapping tick or a second instance cannot
// send one twice, and a failed push is a missed notification rather than a loop.

import cron from 'node-cron';
import { prisma } from '@anuva/database';
import { copy, plural, withLanguage } from './i18n/index.js';
import { logger } from './logger.js';
import { sendToAudience } from './push/dispatch.js';

const log = logger.child({ module: 'consultation-reminders' });

const MINUTE_MS = 60 * 1000;

/// How long before the start the reminder goes out.
export const CONSULTATION_REMINDER_MINUTES = Number(process.env.CONSULTATION_REMINDER_MINUTES || 30);
const LEAD_MS = CONSULTATION_REMINDER_MINUTES * MINUTE_MS;

/**
 * What the reminder says. Like a medication reminder, it names nothing — not the doctor, not the
 * specialty — because a lock screen is not private, and "your gynecologist" is health data.
 */
const reminderTitle = plural('push.consultation.title', {
  one: 'Your consultation starts in {{count}} minute',
  other: 'Your consultation starts in {{count}} minutes',
});

export const CONSULTATION_PUSH = copy('push.consultation', {
  body: 'Tap to see your booking. You can join from there when it is time.',
});

/**
 * For a booking or a reschedule: the value `reminderSentFor` starts with. A slot that already
 * starts inside the reminder window gets its own start time, so no reminder follows — she has just
 * chosen it, and "starting soon" a minute later would only be noise. Any other slot gets null.
 */
export function initialReminderSentFor(startsAt: Date, now = new Date()): Date | null {
  return startsAt.getTime() - now.getTime() <= LEAD_MS ? startsAt : null;
}

export async function runConsultationReminders(now = new Date()): Promise<number> {
  // Starting within the window and not yet started. A tick missed through downtime still sends,
  // as long as the consultation has not begun: ten minutes' notice beats none.
  const due = await prisma.consultation.findMany({
    where: {
      status: { in: ['pending', 'confirmed'] },
      scheduledAt: { gt: now, lte: new Date(now.getTime() + LEAD_MS) },
    },
    select: {
      id: true,
      userId: true,
      scheduledAt: true,
      reminderSentFor: true,
      user: { select: { preferredLanguage: true, erasedAt: true } },
    },
  });

  let sent = 0;
  for (const consultation of due) {
    if (consultation.reminderSentFor?.getTime() === consultation.scheduledAt.getTime()) continue;
    if (consultation.user.erasedAt) continue;
    try {
      // Claimed against the exact row read: if another tick claimed it, or she rescheduled in
      // between, nothing matches and nothing is sent.
      const claimed = await prisma.consultation.updateMany({
        where: {
          id: consultation.id,
          scheduledAt: consultation.scheduledAt,
          reminderSentFor: consultation.reminderSentFor,
        },
        data: { reminderSentFor: consultation.scheduledAt },
      });
      if (claimed.count === 0) continue;

      const minutes = Math.max(1, Math.round((consultation.scheduledAt.getTime() - now.getTime()) / MINUTE_MS));
      const notification = withLanguage(consultation.user.preferredLanguage, () => ({
        title: reminderTitle({ count: minutes }),
        body: CONSULTATION_PUSH.body,
      }));
      // The tag makes a reminder for a rescheduled slot replace the earlier one instead of stacking.
      await sendToAudience({ kind: 'user', userId: consultation.userId }, notification, {
        url: '/my-bookings',
        tag: `consultation-${consultation.id}`,
      });
      sent += 1;
    } catch (e) {
      log.error({ err: e, consultationId: consultation.id }, 'Consultation reminder send failed');
    }
  }

  if (sent > 0) log.info({ sent }, 'Consultation reminders sent');
  return sent;
}

export function startConsultationReminderJob(): void {
  if (process.env.CONSULTATION_REMINDERS_DISABLED === 'true') {
    log.warn('Consultation reminders disabled via CONSULTATION_REMINDERS_DISABLED');
    return;
  }
  // A slow tick must not overlap the next one; the claim makes an overlap harmless, but there is
  // no reason to pay for it.
  let running = false;
  cron.schedule('* * * * *', () => {
    if (running) return;
    running = true;
    runConsultationReminders()
      .catch((e: unknown) => log.error({ err: e }, 'Consultation reminder tick failed'))
      .finally(() => {
        running = false;
      });
  });
  log.info({ minutesBefore: CONSULTATION_REMINDER_MINUTES }, 'Consultation reminder job started');
}
