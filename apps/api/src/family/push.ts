import { prisma } from '@anuva/database';
import type { FcmPlatform } from '@anuva/shared';
import { sendPushToAllTokens } from '../fcm.js';

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

export async function sendToFamilyMember(
  familyMemberId: string,
  notification: { title: string; body: string },
  data: Record<string, string>,
): Promise<number> {
  const rows = await prisma.familyFcmToken.findMany({
    where: { familyMemberId, status: 'ACTIVE' },
    select: { token: true },
  });

  const tokens = [...new Set(rows.map((row) => row.token))];
  if (tokens.length === 0) {
    return 0;
  }

  const { successCount } = await sendPushToAllTokens(tokens, notification, data);
  return successCount;
}
