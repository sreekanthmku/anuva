import { withLanguage } from '../i18n/index.js';
import { prisma } from '@anuva/database';
import type { FcmPlatform } from '@anuva/shared';
import { sendToAudience } from '../push/dispatch.js';
import { languageForFamilyMember } from '../i18n/recipients.js';

/**
 * Push to the family app. Same transport as her notifications, separate token table — a family
 * member's device is registered against the member, not against her account, so revoking them takes
 * their notifications with it by cascade.
 */

export async function registerFamilyToken(input: {
  familyMemberId: string;
  token: string;
  platform: FcmPlatform;
  deviceId?: string;
}): Promise<void> {
  // Upsert on the token, not on (member, device): the same browser re-registering must move the
  // token to whoever is signed in now, or a shared family tablet keeps notifying the wrong person.
  await prisma.familyFcmToken.upsert({
    where: { token: input.token },
    create: {
      familyMemberId: input.familyMemberId,
      token: input.token,
      platform: input.platform,
      deviceId: input.deviceId,
      status: 'ACTIVE',
    },
    update: {
      familyMemberId: input.familyMemberId,
      platform: input.platform,
      deviceId: input.deviceId,
      status: 'ACTIVE',
    },
  });
}

export async function unregisterFamilyToken(input: {
  familyMemberId: string;
  token?: string;
  deviceId?: string;
}): Promise<void> {
  if (!input.token && !input.deviceId) {
    return;
  }

  await prisma.familyFcmToken.deleteMany({
    where: {
      familyMemberId: input.familyMemberId,
      ...(input.token ? { token: input.token } : {}),
      ...(input.deviceId && !input.token ? { deviceId: input.deviceId } : {}),
    },
  });
}

/**
 * A browser push subscription for a family member.
 *
 * Keyed on the endpoint for the same reason tokens are keyed on the token: a shared family tablet
 * that re-subscribes must move to whoever is signed in now, not notify the previous member.
 */
export async function registerFamilyWebPush(input: {
  familyMemberId: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  platform: FcmPlatform;
  deviceId?: string;
}): Promise<void> {
  await prisma.familyWebPushSubscription.upsert({
    where: { endpoint: input.endpoint },
    create: {
      familyMemberId: input.familyMemberId,
      endpoint: input.endpoint,
      p256dh: input.p256dh,
      auth: input.auth,
      platform: input.platform,
      deviceId: input.deviceId,
      status: 'ACTIVE',
    },
    update: {
      familyMemberId: input.familyMemberId,
      p256dh: input.p256dh,
      auth: input.auth,
      platform: input.platform,
      deviceId: input.deviceId,
      status: 'ACTIVE',
    },
  });
}

/** Deleted, not deactivated: an unsubscribed endpoint can never deliver again. */
export async function unregisterFamilyWebPush(input: {
  familyMemberId: string;
  endpoint?: string;
  deviceId?: string;
}): Promise<void> {
  if (!input.endpoint && !input.deviceId) return;

  await prisma.familyWebPushSubscription.deleteMany({
    where: {
      familyMemberId: input.familyMemberId,
      ...(input.endpoint ? { endpoint: input.endpoint } : {}),
      ...(input.deviceId ? { deviceId: input.deviceId } : {}),
    },
  });
}

/**
 * `data` may be derived from the finished notification, for a deep link that must carry the same
 * words the lock screen shows — already in the recipient's language, with no second copy of the
 * text to drift from the first.
 */
export async function sendToFamilyMember(
  familyMemberId: string,
  notification: FamilyNotification | (() => FamilyNotification),
  data: Record<string, string> | ((content: FamilyNotification) => Record<string, string>),
): Promise<number> {
  const language = await languageForFamilyMember(familyMemberId);

  // Built in the *recipient's* language, not the request's. The request that triggers a push is
  // often someone else's — her thank-you reaching him — and a job has no request at all. A member
  // with no stored language gets English.
  const content = withLanguage(language, () =>
    typeof notification === 'function' ? notification() : notification,
  );

  const payload = typeof data === 'function' ? data(content) : data;
  // Which transport carries it is `PUSH_PROVIDER`'s business, not this module's.
  const { successCount } = await sendToAudience({ kind: 'familyMember', familyMemberId }, content, payload);
  return successCount;
}

type FamilyNotification = { title: string; body: string };
