// "You missed yesterday" — one push the next afternoon, while she can still fill yesterday in.
//
// Yesterday counts as tracked when its `NudgeDailyState.lastEngagedAt` is set. Every tracker write
// credits the day the entry is *for* (see `markTrackerEngagement`), so filling yesterday in before
// this runs is enough to stop it. Only for someone who has been tracking — a tracked day in the week
// before — so a woman who never tracks is not told off for it daily.
//
// Its own job, outside the nudge governor: the three nudge slots already fill the daily cap, and this
// is not a fourth suggestion but a note about the one day she can still change. Claimed on yesterday's
// row before the push goes out, so a restart or a second instance cannot send it twice.

import cron from 'node-cron';
import { prisma } from '@anuva/database';
import { dayKey } from './dayKey.js';
import { copy, withLanguage } from './i18n/index.js';
import { logger } from './logger.js';
import { hasReachableDevice, sendToAudience } from './push/dispatch.js';

const log = logger.child({ module: 'missed-tracking' });

const TZ = process.env.NUDGE_TIMEZONE?.trim() || 'Asia/Kolkata';

/// How far back a tracked day makes her "someone who tracks".
const ACTIVE_WITHIN_DAYS = 7;

export const MISSED_TRACKING_PUSH = copy('push.missedTracking', {
  title: 'You missed yesterday’s check-in',
  body: 'Want to add how yesterday went? You can fill it in until midnight tonight.',
});

function daysBefore(day: Date, days: number): Date {
  const d = new Date(day);
  d.setDate(d.getDate() - days);
  return d;
}

export async function runMissedTrackingReminders(now = new Date()): Promise<number> {
  const yesterday = daysBefore(now, 1);
  const yesterdayKey = dayKey(yesterday);

  // Tracked at least once in the week before yesterday…
  const active = await prisma.nudgeDailyState.findMany({
    where: {
      lastEngagedAt: { not: null },
      date: { gte: dayKey(daysBefore(yesterday, ACTIVE_WITHIN_DAYS)), lt: yesterdayKey },
    },
    select: { userId: true },
    distinct: ['userId'],
  });
  if (active.length === 0) return 0;

  // …but not yesterday, and not already reminded about it.
  const handled = await prisma.nudgeDailyState.findMany({
    where: {
      userId: { in: active.map((row) => row.userId) },
      date: yesterdayKey,
      OR: [{ lastEngagedAt: { not: null } }, { missedReminderSentAt: { not: null } }],
    },
    select: { userId: true },
  });
  const skip = new Set(handled.map((row) => row.userId));

  const users = await prisma.user.findMany({
    where: {
      id: { in: active.map((row) => row.userId).filter((id) => !skip.has(id)) },
      erasedAt: null,
      ...hasReachableDevice(),
    },
    select: { id: true, preferredLanguage: true },
  });

  let sent = 0;
  for (const user of users) {
    try {
      // Claimed on yesterday's row, and only while yesterday is still untracked: if she filled it in
      // a moment ago, or another tick got here first, nothing matches and nothing is sent.
      await prisma.nudgeDailyState.upsert({
        where: { userId_date: { userId: user.id, date: yesterdayKey } },
        create: { userId: user.id, date: yesterdayKey },
        update: {},
      });
      const claimed = await prisma.nudgeDailyState.updateMany({
        where: { userId: user.id, date: yesterdayKey, lastEngagedAt: null, missedReminderSentAt: null },
        data: { missedReminderSentAt: now },
      });
      if (claimed.count === 0) continue;

      const notification = withLanguage(user.preferredLanguage, () => ({
        title: MISSED_TRACKING_PUSH.title,
        body: MISSED_TRACKING_PUSH.body,
      }));
      await sendToAudience({ kind: 'user', userId: user.id }, notification, {
        url: '/track?day=yesterday',
        tag: 'missed-tracking',
      });
      sent += 1;
    } catch (e) {
      log.error({ err: e, userId: user.id }, 'Missed-tracking reminder failed');
    }
  }

  if (sent > 0) log.info({ sent }, 'Missed-tracking reminders sent');
  return sent;
}

export function startMissedTrackingJob(): void {
  if (process.env.MISSED_TRACKING_REMINDERS_DISABLED === 'true') {
    log.warn('Missed-tracking reminders disabled via MISSED_TRACKING_REMINDERS_DISABLED');
    return;
  }
  // 3 pm: well after the 12:30 nudge, with the evening still ahead to fill yesterday in.
  cron.schedule('0 15 * * *', () => void runMissedTrackingReminders().catch((e: unknown) => {
    log.error({ err: e }, 'Missed-tracking tick failed');
  }), { timezone: TZ });
  log.info('Missed-tracking reminder job started');
}
