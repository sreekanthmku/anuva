import { prisma } from '@anuva/database';
import type { FamilySupportActionKind } from '@anuva/shared';
import { sendPushToAllTokens } from '../fcm.js';
import { dayKey } from '../dayKey.js';

/**
 * One recorded supportive action per member per day. What turns the Today CTA into
 * "✓ Support action completed", and in a later phase what tells her someone checked in.
 */

const TOASTS: Record<FamilySupportActionKind, string> = {
  message: '✓ Message sent. She will see that you thought of her.',
  call: '✓ Call logged. A voice helps more than a text on a hard day.',
  flowers: '✓ Virtual flowers sent. They are on her phone now.',
  chocolates: '✓ Virtual chocolates sent. They are on her phone now.',
};

/**
 * The two gestures that are *delivered* rather than merely recorded. Real flowers and chocolates
 * are a later phase; until then these arrive as a push and a card in her app, which is a real thing
 * happening on her screen rather than a row only her family can see.
 */
const GIFT_KINDS = ['flowers', 'chocolates'] as const;
type FamilyGiftKind = (typeof GIFT_KINDS)[number];

function isGiftKind(kind: FamilySupportActionKind): kind is FamilyGiftKind {
  return (GIFT_KINDS as readonly string[]).includes(kind);
}

/** Phrased for her lock screen. Short — the whole gesture has to survive a notification preview. */
const GIFT_PUSH: Record<FamilyGiftKind, { title: (first: string) => string; body: string }> = {
  flowers: {
    title: (first) => `${first} sent you flowers 💐`,
    body: 'A bouquet, thinking of you today. Tap to open it.',
  },
  chocolates: {
    title: (first) => `${first} sent you chocolates 🍫`,
    body: 'Something sweet for a hard day. Tap to open it.',
  },
};

const GIFT_UNDELIVERED_TOAST: Record<FamilyGiftKind, string> = {
  flowers: 'Recorded for today, but her phone has no notifications set up, so she will not see them.',
  chocolates: 'Recorded for today, but her phone has no notifications set up, so she will not see them.',
};

function firstNameOf(name: string): string {
  return name.trim().split(/\s+/)[0] || name;
}

/**
 * Delivery carries the gift kind and the sender's first name in the deep link's *fragment*, for the
 * same reason a note does: fragments never reach a server, so nothing about the gesture lands in an
 * access log. Nothing about the gift is stored beyond the `FamilySupportAction` row itself.
 */
async function deliverGift(input: {
  userId: string;
  memberName: string;
  kind: FamilyGiftKind;
}): Promise<boolean> {
  const rows = await prisma.fcmToken.findMany({
    where: { userId: input.userId, status: 'ACTIVE' },
    select: { token: true },
  });
  const tokens = [...new Set(rows.map((row) => row.token))];
  if (tokens.length === 0) return false;

  const first = firstNameOf(input.memberName);
  const copy = GIFT_PUSH[input.kind];
  const deepLink = `/home#familyGift=${input.kind}&familyFrom=${encodeURIComponent(first)}`;

  const { successCount } = await sendPushToAllTokens(
    tokens,
    { title: copy.title(first), body: copy.body },
    { url: deepLink, familyGift: input.kind, familyFrom: first },
  );

  return successCount > 0;
}

/**
 * Which actions they have already taken today. Doing one does not use up the day — messaging her and
 * sending flowers are both worth doing — so this returns the set rather than a boolean, and the
 * client marks what is done instead of disabling the button.
 */
export async function kindsDoneToday(
  familyMemberId: string,
  now = new Date(),
): Promise<FamilySupportActionKind[]> {
  const rows = await prisma.familySupportAction.findMany({
    where: { familyMemberId, date: dayKey(now) },
    select: { kind: true },
    orderBy: { createdAt: 'asc' },
  });
  return rows.map((row) => row.kind);
}

export async function recordSupportAction(input: {
  familyMemberId: string;
  userId: string;
  memberName: string;
  kind: FamilySupportActionKind;
}): Promise<{ completedToday: true; toast: string; delivered?: boolean }> {
  const now = new Date();

  // Upsert per *kind*: tapping the same action twice in a day is a re-affirmation rather than an
  // error, but a different action is a genuinely new one and must not overwrite the first. The
  // unique index on (member, day, kind) is what keeps both true, and caps this at four rows a day.
  //
  // `count` distinguishes the first tap of the day from a re-tap, which the gift kinds need:
  // recording twice is harmless, but notifying her twice for the same bouquet is not.
  const { count } = await prisma.familySupportAction.createMany({
    data: [
      {
        familyMemberId: input.familyMemberId,
        userId: input.userId,
        kind: input.kind,
        date: dayKey(now),
      },
    ],
    skipDuplicates: true,
  });
  const firstTapToday = count > 0;

  if (!isGiftKind(input.kind)) {
    return { completedToday: true, toast: TOASTS[input.kind] };
  }

  if (!firstTapToday) {
    // Already sent today. Say so rather than silently doing nothing, and do not push again.
    return {
      completedToday: true,
      toast:
        input.kind === 'flowers'
          ? 'Already sent her flowers today. She has them.'
          : 'Already sent her chocolates today. She has them.',
      delivered: true,
    };
  }

  // Recorded before delivery is attempted, same as a note: the gesture happened either way, and her
  // "your family checked in" card should not depend on whether her phone had notifications on.
  const delivered = await deliverGift({
    userId: input.userId,
    memberName: input.memberName,
    kind: input.kind,
  });

  return {
    completedToday: true,
    toast: delivered ? TOASTS[input.kind] : GIFT_UNDELIVERED_TOAST[input.kind],
    delivered,
  };
}

/**
 * "Remind me later" — this evening, in her timezone. Stored on the member rather than as its own
 * row: there is only ever one outstanding reminder, and a second tap should move it, not queue.
 */
export async function scheduleSupportReminder(
  familyMemberId: string,
): Promise<{ remindAt: string; toast: string }> {
  const now = new Date();
  const remindAt = new Date(now);
  remindAt.setHours(19, 0, 0, 0);
  if (remindAt <= now) {
    // Already past seven — tomorrow evening instead of a reminder that fires immediately.
    remindAt.setDate(remindAt.getDate() + 1);
  }

  await prisma.familyMember.update({
    where: { id: familyMemberId },
    data: { supportRemindAt: remindAt },
  });

  return { remindAt: remindAt.toISOString(), toast: 'Reminder saved for this evening.' };
}
