import { prisma } from '@anuva/database';
import type { FamilyMessageResponse } from '@anuva/shared';
import { sendPushToAllTokens } from '../fcm.js';
import { dayKey } from '../dayKey.js';
import { FamilyError } from './errors.js';
import { rateLimit } from './rateLimit.js';

/**
 * A short note from a family member to her, delivered as a push notification.
 *
 * **The text is never stored.** Not in Postgres, and not in the logs — which is the part that is
 * easy to get wrong, since every other route here logs something useful about what happened. What
 * is recorded is that a message was sent (as a `FamilySupportAction` of kind `message`), never what
 * it said.
 *
 * That has a consequence worth stating plainly: if she has notifications off, or dismisses the
 * notification, or her device is offline past FCM's TTL, the message is gone. There is no inbox to
 * recover it from. That is inherent to not storing it, not an oversight.
 *
 * Delivery carries the text twice:
 *   - as the notification body, so she reads it on the lock screen;
 *   - in the `data` payload and in the deep link's *fragment*, so the app can show it as a card
 *     when she taps through. A fragment is used rather than a query string for the same reason the
 *     invite token uses one: fragments never reach a server, so the note stays out of access logs.
 */

/** Enough for a few notes a day, not enough to be used as a channel for pestering her. */
const MESSAGE_LIMIT = 6;
const MESSAGE_WINDOW_MS = 60 * 60 * 1000;

function firstNameOf(name: string): string {
  return name.trim().split(/\s+/)[0] || name;
}

export async function sendFamilyMessage(input: {
  familyMemberId: string;
  memberName: string;
  userId: string;
  text: string;
}): Promise<FamilyMessageResponse> {
  if (!rateLimit(`familyMessage:${input.familyMemberId}`, MESSAGE_LIMIT, MESSAGE_WINDOW_MS)) {
    throw new FamilyError(
      429,
      'message_rate_limited',
      'You have sent a few messages already. Give it an hour before the next one.',
    );
  }

  const rows = await prisma.fcmToken.findMany({
    where: { userId: input.userId, status: 'ACTIVE' },
    select: { token: true },
  });
  const tokens = [...new Set(rows.map((row) => row.token))];

  const first = firstNameOf(input.memberName);

  // Recorded before delivery is attempted: the gesture happened either way, and her "your family
  // checked in" card should not depend on whether her phone had notifications switched on.
  await prisma.familySupportAction.upsert({
    where: {
      familyMemberId_date_kind: {
        familyMemberId: input.familyMemberId,
        date: dayKey(new Date()),
        kind: 'message',
      },
    },
    create: {
      familyMemberId: input.familyMemberId,
      userId: input.userId,
      kind: 'message',
      date: dayKey(new Date()),
    },
    update: {},
  });

  if (tokens.length === 0) {
    return {
      delivered: false,
      toast: 'Saved as a check-in. She has no device set up for notifications, so she will not see the note itself.',
    };
  }

  // encodeURIComponent, then into the fragment. The app decodes it and strips the hash on read.
  const deepLink = `/home#familyMessage=${encodeURIComponent(input.text)}&familyFrom=${encodeURIComponent(first)}`;

  const { successCount } = await sendPushToAllTokens(
    tokens,
    { title: `${first} sent you a message`, body: input.text },
    { url: deepLink, familyMessage: input.text, familyFrom: first },
  );

  // Counts and codes only — never the text. Logging it would be storing it.
  return successCount > 0
    ? { delivered: true, toast: '✓ Sent. She will see it on her phone.' }
    : {
        delivered: false,
        toast: 'Saved as a check-in, but her phone did not accept the notification.',
      };
}
