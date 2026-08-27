import cron from 'node-cron';
import { prisma } from '@anuva/database';
import { logger } from '../logger.js';
import { buildFamilyLearn } from './digest.js';
import { sendToFamilyMember } from './push.js';

const log = logger.child({ module: 'family-jobs' });

const TZ = process.env.NUDGE_TIMEZONE?.trim() || 'Asia/Kolkata';

/**
 * The two things the family app has to do on its own.
 *
 * Both are deliberately quiet. A family member is not the daily user of this product, and a
 * companion app that nags is one that gets its notifications switched off — after which the whole
 * feature is dead. Two learning nudges a week and one reminder they asked for is the whole budget.
 */

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

    const her = member.user.name?.trim().split(/\s+/)[0] || 'her';
    sent += await sendToFamilyMember(
      member.id,
      { title: 'A small thing today?', body: `You wanted a nudge to check in on ${her}.` },
      { url: '/' },
    );
  }

  if (due.length > 0) {
    log.info({ due: due.length, sent }, 'family support reminders processed');
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

  const learn = buildFamilyLearn(now);
  let sent = 0;

  for (const member of members) {
    sent += await sendToFamilyMember(
      member.id,
      { title: learn.nudge.headline, body: learn.nudge.body },
      { url: '/learn' },
    );
  }

  if (members.length > 0) {
    log.info({ members: members.length, sent }, 'family learn nudge sent');
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

  // Tuesday and Friday mid-morning. Two a week, as the Learn tab promises — and mid-morning rather
  // than evening, because this is reading material, not a prompt to act tonight.
  cron.schedule('0 10 * * 2,5', () => void sendWeeklyLearnNudge(), { timezone: TZ });

  log.info({ timezone: TZ }, 'Family jobs scheduled');
}
