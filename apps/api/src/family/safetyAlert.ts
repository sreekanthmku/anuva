import { prisma } from '@anuva/database';
import { copy, fill } from '../i18n/index.js';
import { logger } from '../logger.js';
import { hasReachableDevice } from '../push/dispatch.js';
import { sendToFamilyMember } from './push.js';

/**
 * Telling her people she may need them, when a chat turn shows a crisis or a medical emergency.
 *
 * Only the people she chose (`FamilyMember.emergencyAlerts`, off by default), and only ever that she
 * may need them now — never what she wrote, never which rule matched, never the word "crisis". The
 * kind is kept on our side for the audit row; the family app is told nothing that would let it tell
 * a self-harm alert from a chest-pain one.
 *
 * This never stands in the way of her reply. The decision is a couple of reads; the sends run after
 * the reply has gone, and every failure is logged and swallowed. A crisis turn that fails because a
 * push service was slow would be the worst possible trade.
 */

const log = logger.child({ module: 'family-safety-alert' });

/** `crisis`: self-harm or suicidal thoughts. `medical`: an urgent physical emergency. */
export type SafetyAlertKind = 'crisis' | 'medical';
/** `redFlag`: the deterministic gate. `classifier`: the v3 safety classifier. */
export type SafetyAlertSource = 'redFlag' | 'classifier';

/**
 * One alert per stretch of conversation, not one per message. Someone in crisis often writes several
 * alarming messages in a row; a family member who has just been told should be on their way, not
 * receiving the same notification four times.
 */
const COOLDOWN_MS = Number(process.env.FAMILY_SAFETY_ALERT_COOLDOWN_MINUTES || 360) * 60 * 1000;

const ALERT_TEXT = copy('family.safetyAlert', {
  pushTitle: '{{name}} may need you right now',
  pushBody: 'Please call her or go to her as soon as you can.',
});

function firstNameOf(name: string | null | undefined): string {
  return name?.trim().split(/\s+/)[0] || 'She';
}

/**
 * The people she chose to alert who can actually receive it. A device counts for every live
 * membership on its phone (see `familyDeviceOwners` in push/dispatch.ts), so a member with no device
 * of their own is still reachable when another of their memberships registered one.
 */
async function alertableMembers(userId: string): Promise<{ id: string }[]> {
  const chosen = await prisma.familyMember.findMany({
    where: { userId, status: 'active', emergencyAlerts: true },
    select: { id: true, phone: true },
  });
  if (chosen.length === 0) return [];

  const reachable = await prisma.familyMember.findMany({
    where: { phone: { in: chosen.map((member) => member.phone) }, status: 'active', ...hasReachableDevice() },
    select: { phone: true },
    distinct: ['phone'],
  });
  const phones = new Set(reachable.map((row) => row.phone));
  return chosen.filter((member) => phones.has(member.phone)).map(({ id }) => ({ id }));
}

/**
 * Decides whether this turn alerts her family and, if so, starts the sends without waiting for them.
 * Returns whether her people are being (or were just) told, which is what the reply says to her.
 *
 * Never throws.
 */
export async function alertFamilyIfChosen(input: {
  userId: string;
  kind: SafetyAlertKind;
  source: SafetyAlertSource;
}): Promise<boolean> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: input.userId },
      select: { name: true, erasedAt: true, familyFeatureOptOut: true },
    });
    if (!user || user.erasedAt || user.familyFeatureOptOut) return false;

    const members = await alertableMembers(input.userId);
    if (members.length === 0) return false;

    // Inside the cooldown, the earlier alert is the answer: they already know, and the reply can say
    // so, but nobody's phone goes off again.
    const recent = await prisma.familySafetyAlert.findFirst({
      where: { userId: input.userId, createdAt: { gte: new Date(Date.now() - COOLDOWN_MS) } },
      orderBy: { createdAt: 'desc' },
      select: { id: true, notified: true },
    });
    if (recent) {
      log.info({ userId: input.userId, alertId: recent.id, kind: input.kind }, 'family safety alert: inside cooldown');
      return recent.notified > 0;
    }

    const alert = await prisma.familySafetyAlert.create({
      data: { userId: input.userId, kind: input.kind, source: input.source },
      select: { id: true },
    });

    void send(alert.id, input.userId, firstNameOf(user.name), members);
    return true;
  } catch (error) {
    log.error({ err: error, userId: input.userId, kind: input.kind }, 'family safety alert: could not start');
    return false;
  }
}

async function send(alertId: string, userId: string, name: string, members: { id: string }[]): Promise<void> {
  // Built per recipient, in each family member's own language — `sendToFamilyMember` evaluates this
  // inside that member's stored language, not hers.
  const notification = () => ({
    title: fill(ALERT_TEXT.pushTitle, { name }),
    body: ALERT_TEXT.pushBody,
  });

  // Opens the alert card in the family app. In the fragment, like the thank-you, so it never reaches
  // a server's access log — and it carries her first name and the lock-screen words only.
  const data = (content: { title: string; body: string }) => {
    const fragment = new URLSearchParams({
      familyAlert: '1',
      familyAlertFrom: name,
      familyAlertTitle: content.title,
      familyAlertBody: content.body,
    });
    return { url: `/#${fragment.toString()}`, familyAlert: '1', familyAlertFrom: name };
  };

  const results = await Promise.allSettled(members.map((member) => sendToFamilyMember(member.id, notification, data, { requires: 'emergency' })));
  const notified = results.filter((result) => result.status === 'fulfilled' && result.value > 0).length;
  const failed = results.filter((result) => result.status === 'rejected').length;

  if (notified === 0) {
    log.error({ userId, alertId, members: members.length, failed }, 'family safety alert: reached nobody');
  } else {
    log.warn({ userId, alertId, members: members.length, notified, failed }, 'family safety alert sent');
  }

  await prisma.familySafetyAlert
    .update({ where: { id: alertId }, data: { notified } })
    .catch((error: unknown) => log.error({ err: error, alertId }, 'family safety alert: could not record result'));
}
