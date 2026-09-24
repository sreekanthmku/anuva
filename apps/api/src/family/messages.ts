import { copy, fill, withLanguage } from '../i18n/index.js';
import { languageForUser } from '../i18n/recipients.js';
import { prisma } from '@anuva/database';
import type { FamilyMessageResponse } from '@anuva/shared';
import { countDevices, sendToAudience } from '../push/dispatch.js';
import { dayKey } from '../dayKey.js';
import { attributeSupportAction } from './nudgeLog.js';

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

const MESSAGE_TEXT = copy('family.messageText', {
  noDevice:
    'Saved as a check-in. She has no device set up for notifications, so she will not see the note itself.',
  pushTitle: '{{name}} sent you a message',
  sent: '✓ Sent. She will see it on her phone.',
  notAccepted: 'Saved as a check-in, but her phone did not accept the notification.',
});

function firstNameOf(name: string): string {
  return name.trim().split(/\s+/)[0] || name;
}

export async function sendFamilyMessage(input: {
  familyMemberId: string;
  memberName: string;
  userId: string;
  text: string;
}): Promise<FamilyMessageResponse> {
  const deviceCount = await countDevices({ kind: 'user', userId: input.userId });

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

  // A note is a supportive action like any other, so it answers the day's nudge like any other.
  // Attribution is idempotent on the ledger row, so an upsert that changed nothing cannot double
  // count — which is why this sits outside the first-tap check the gift kinds need.
  await attributeSupportAction({ familyMemberId: input.familyMemberId, kind: 'message' });

  if (deviceCount === 0) {
    return {
      delivered: false,
      toast: MESSAGE_TEXT.noDevice,
    };
  }

  // encodeURIComponent, then into the fragment. The app decodes it and strips the hash on read.
  const deepLink = `/home#familyMessage=${encodeURIComponent(input.text)}&familyFrom=${encodeURIComponent(first)}`;

  // The title is on her lock screen, so it is worded in her language; the note itself goes as written.
  const title = withLanguage(await languageForUser(input.userId), () =>
    fill(MESSAGE_TEXT.pushTitle, { name: first }),
  );

  const { successCount } = await sendToAudience(
    { kind: 'user', userId: input.userId },
    { title, body: input.text },
    { url: deepLink, familyMessage: input.text, familyFrom: first },
  );

  // Counts and codes only — never the text. Logging it would be storing it.
  return successCount > 0
    ? { delivered: true, toast: MESSAGE_TEXT.sent }
    : { delivered: false, toast: MESSAGE_TEXT.notAccepted };
}
