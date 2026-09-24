/**
 * One way to notify somebody, whichever transport this deployment is set to.
 *
 * Call sites say who to notify, not how. `PUSH_PROVIDER` decides the rest, so switching transports
 * is a configuration change rather than an edit to every feature that sends a notification.
 *
 * On `both`, a device that has registered for each transport is notified once, not twice —
 * `deviceId` is what identifies it across the two tables. A device that appears in only one table
 * is notified through that one, which is what makes a gradual migration safe: nobody goes quiet
 * while they are moving from one transport to the other.
 */
import { prisma } from '@anuva/database';
import { sendPushToAllTokens, type PushSendResult } from '../fcm.js';
import { logger } from '../logger.js';
import { pushProvider, usesFcm, usesWebPush } from './config.js';
import { sendWebPush, type StoredSubscription } from './webPush.js';

const log = logger.child({ module: 'push-dispatch' });

export type Notification = { title: string; body: string };

/** Who to notify. One of these, never more. */
export type Audience =
  | { kind: 'user'; userId: string }
  | { kind: 'familyMember'; familyMemberId: string }
  | { kind: 'specialist'; specialistId: string };

type TokenRow = { token: string; deviceId: string | null };
type SubscriptionRow = StoredSubscription & { deviceId: string | null };

/** The FCM tokens and Web Push subscriptions belonging to one audience, active only. */
async function activeDevices(
  audience: Audience,
): Promise<{ tokens: TokenRow[]; subscriptions: SubscriptionRow[] }> {
  const select = { token: true, deviceId: true } as const;
  const subSelect = { id: true, endpoint: true, p256dh: true, auth: true, deviceId: true } as const;

  switch (audience.kind) {
    case 'user': {
      const where = { userId: audience.userId, status: 'ACTIVE' } as const;
      const [tokens, subscriptions] = await Promise.all([
        usesFcm() ? prisma.fcmToken.findMany({ where, select }) : [],
        usesWebPush() ? prisma.webPushSubscription.findMany({ where, select: subSelect }) : [],
      ]);
      return { tokens, subscriptions };
    }
    case 'familyMember': {
      const where = { familyMemberId: audience.familyMemberId, status: 'ACTIVE' } as const;
      const [tokens, subscriptions] = await Promise.all([
        usesFcm() ? prisma.familyFcmToken.findMany({ where, select }) : [],
        usesWebPush() ? prisma.familyWebPushSubscription.findMany({ where, select: subSelect }) : [],
      ]);
      return { tokens, subscriptions };
    }
    case 'specialist': {
      const where = { specialistId: audience.specialistId, status: 'ACTIVE' } as const;
      const [tokens, subscriptions] = await Promise.all([
        usesFcm() ? prisma.specialistFcmToken.findMany({ where, select }) : [],
        usesWebPush()
          ? prisma.specialistWebPushSubscription.findMany({ where, select: subSelect })
          : [],
      ]);
      return { tokens, subscriptions };
    }
  }
}

/**
 * Drops FCM tokens for devices that are also subscribed the newer way.
 *
 * Only meaningful on `both`. A device with a null `deviceId` cannot be matched up, so it keeps its
 * token — a duplicate notification is a far smaller failure than a silent one.
 */
export function withoutDuplicateDevices(
  tokens: TokenRow[],
  subscriptions: SubscriptionRow[],
): TokenRow[] {
  const subscribed = new Set(
    subscriptions.map((subscription) => subscription.deviceId).filter((id): id is string => Boolean(id)),
  );
  if (subscribed.size === 0) return tokens;
  return tokens.filter((token) => !token.deviceId || !subscribed.has(token.deviceId));
}

/** Deletes the subscriptions a push service has told us are gone. */
async function dropGone(audience: Audience, endpoints: string[]): Promise<void> {
  if (endpoints.length === 0) return;
  const where = { endpoint: { in: endpoints } };
  try {
    if (audience.kind === 'user') await prisma.webPushSubscription.deleteMany({ where });
    else if (audience.kind === 'familyMember') {
      await prisma.familyWebPushSubscription.deleteMany({ where });
    } else await prisma.specialistWebPushSubscription.deleteMany({ where });
  } catch (error) {
    // Housekeeping: a failure here costs one wasted send next time, not a missed notification.
    log.warn({ err: error }, 'Could not drop expired subscriptions');
  }
}

/**
 * How many devices this audience could be reached on, across both transports.
 *
 * Callers use it to tell "nobody has this app on a phone" apart from "sending failed", which are
 * different things to say to someone who has just sent a note.
 */
export async function countDevices(audience: Audience): Promise<number> {
  try {
    const { tokens, subscriptions } = await activeDevices(audience);
    const devices = new Set<string>();
    for (const token of withoutDuplicateDevices(tokens, subscriptions)) devices.add(`t:${token.token}`);
    for (const subscription of subscriptions) devices.add(`s:${subscription.endpoint}`);
    return devices.size;
  } catch (error) {
    log.error({ err: error, audience: audience.kind }, 'Could not count devices');
    return 0;
  }
}

/**
 * Sends to every device the audience has. Never throws: a notification that cannot be delivered
 * must not fail the action that triggered it.
 */
export async function sendToAudience(
  audience: Audience,
  notification: Notification,
  data?: Record<string, string>,
): Promise<PushSendResult> {
  try {
    const { tokens, subscriptions } = await activeDevices(audience);
    const fcmTokens = withoutDuplicateDevices(tokens, subscriptions);

    const [fcmResult, webResult] = await Promise.all([
      fcmTokens.length > 0
        ? sendPushToAllTokens([...new Set(fcmTokens.map((row) => row.token))], notification, data)
        : Promise.resolve({ successCount: 0, failureCount: 0 }),
      subscriptions.length > 0
        ? sendWebPush(subscriptions, notification, data)
        : Promise.resolve({ successCount: 0, failureCount: 0, goneEndpoints: [] }),
    ]);

    await dropGone(audience, webResult.goneEndpoints);

    return {
      successCount: fcmResult.successCount + webResult.successCount,
      failureCount: fcmResult.failureCount + webResult.failureCount,
    };
  } catch (error) {
    log.error({ err: error, provider: pushProvider(), audience: audience.kind }, 'Push dispatch failed');
    return { successCount: 0, failureCount: 0 };
  }
}
