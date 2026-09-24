import { copy, fill, withLanguage } from '../i18n/index.js';
import { languageForUser } from '../i18n/recipients.js';
import { prisma } from '@anuva/database';
import type { FamilySupportActionKind } from '@anuva/shared';
import { sendToAudience } from '../push/dispatch.js';
import { dayKey } from '../dayKey.js';
import { FAMILY_TEXT } from './content.js';
import { attributeSupportAction } from './nudgeLog.js';
import { FamilyError } from './errors.js';

/**
 * One recorded supportive action per member per day. What turns the Today CTA into
 * "✓ Support action completed", and in a later phase what tells her someone checked in.
 */

const TOASTS: Record<FamilySupportActionKind, string> = copy('family.supportToasts', {
  message: '✓ Message sent. She will see that you thought of her.',
  call: '✓ Call logged. A voice helps more than a text on a hard day.',
  flowers: '✓ Flowers sent. They are on her phone now.',
  chocolates: '✓ Virtual chocolates sent. They are on her phone now.',
});

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
const GIFT_PUSH: Record<FamilyGiftKind, { title: string; body: string }> = copy('family.giftPush', {
  flowers: {
    title: '{{name}} sent you flowers 🌻',
    body: 'Thinking of you today. Tap to open them.',
  },
  chocolates: {
    title: '{{name}} sent you chocolates 🍫',
    body: 'Something sweet for a hard day. Tap to open it.',
  },
});

const GIFT_TEXT = copy('family.giftText', {
  undelivered:
    'Recorded for today, but her phone has no notifications set up, so she will not see them.',
  alreadyFlowers: 'Already sent her flowers today. She has them.',
  alreadyChocolates: 'Already sent her chocolates today. She has them.',
  reminderSaved: 'Reminder saved for this evening.',
});

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

  const first = firstNameOf(input.memberName);
  const deepLink = `/home#familyGift=${input.kind}&familyFrom=${encodeURIComponent(first)}`;

  // Her lock screen, so her language — not the language of the family member who sent it.
  const notification = withLanguage(await languageForUser(input.userId), () => ({
    title: fill(GIFT_PUSH[input.kind].title, { name: first }),
    body: GIFT_PUSH[input.kind].body,
  }));

  const { successCount } = await sendToAudience({ kind: 'user', userId: input.userId }, notification, {
    url: deepLink,
    familyGift: input.kind,
    familyFrom: first,
  });

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

/**
 * The one kind the app cannot see happen.
 *
 * Message, flowers and chocolates are performed or delivered by the app, so recording them on the
 * tap is simply true. A call happens on a phone we have no visibility into, and recording it as done
 * the moment someone taps "Call her" makes the completion number — the thing the whole Act layer is
 * measured by — a record of intentions rather than actions.
 */
const CONFIRMED_KINDS: readonly FamilySupportActionKind[] = ['call'];

export function needsConfirmation(kind: FamilySupportActionKind): boolean {
  return CONFIRMED_KINDS.includes(kind);
}

/** What the member has selected but not yet confirmed. Null once confirmed or reminded away. */
export async function pendingActionFor(
  familyMemberId: string,
): Promise<FamilySupportActionKind | null> {
  const member = await prisma.familyMember.findUnique({
    where: { id: familyMemberId },
    select: { pendingActionKind: true },
  });
  return member?.pendingActionKind ?? null;
}

/**
 * Select an action without completing it. Stored on the member, so a second selection replaces the
 * first rather than queueing — there is only ever one thing on their list.
 */
async function selectAction(input: {
  familyMemberId: string;
  kind: FamilySupportActionKind;
  now: Date;
}): Promise<{ completedToday: false; pending: true; prompt: string; toast: string }> {
  await prisma.familyMember.update({
    where: { id: input.familyMemberId },
    data: { pendingActionKind: input.kind, pendingActionAt: input.now },
  });

  return {
    completedToday: false,
    pending: true,
    prompt: FAMILY_TEXT.actionCompletionPrompt,
    toast: FAMILY_TEXT.actionCompletionPrompt,
  };
}

/**
 * Confirm the selected action — the ✓ tap.
 *
 * Idempotent through the same unique index everything else leans on, so a double tap on a slow
 * connection records one call rather than two. Clearing the intent is unconditional: whether the row
 * was new or already there, nothing is outstanding afterwards.
 */
export async function confirmPendingAction(input: {
  familyMemberId: string;
  userId: string;
}): Promise<{ completedToday: true; kind: FamilySupportActionKind; toast: string }> {
  const now = new Date();

  const member = await prisma.familyMember.findUnique({
    where: { id: input.familyMemberId },
    select: { pendingActionKind: true },
  });

  const kind = member?.pendingActionKind;
  if (!kind) {
    throw new FamilyError(409, 'no_pending_action', 'Nothing is waiting to be confirmed.');
  }

  await prisma.familySupportAction.createMany({
    data: [{ familyMemberId: input.familyMemberId, userId: input.userId, kind, date: dayKey(now) }],
    skipDuplicates: true,
  });

  await prisma.familyMember.update({
    where: { id: input.familyMemberId },
    data: { pendingActionKind: null, pendingActionAt: null },
  });

  await attributeSupportAction({ familyMemberId: input.familyMemberId, kind, now });

  return { completedToday: true, kind, toast: FAMILY_TEXT.actionCompletionMessage };
}

export async function recordSupportAction(input: {
  familyMemberId: string;
  userId: string;
  memberName: string;
  kind: FamilySupportActionKind;
  /** True when they are choosing the action rather than reporting it done. */
  intent?: boolean;
}): Promise<{
  completedToday: boolean;
  pending: boolean;
  prompt: string | null;
  toast: string;
  delivered?: boolean;
}> {
  const now = new Date();

  // A call is only ever recorded through the confirm step, whether or not the client remembered to
  // ask for it. Honouring `intent` for the other kinds would let a client park a message as
  // "pending" that it has not sent, which the message route would then contradict.
  if (needsConfirmation(input.kind)) {
    return selectAction({ familyMemberId: input.familyMemberId, kind: input.kind, now });
  }

  // Upsert per *kind*: tapping the same action twice in a day is a re-affirmation rather than an
  // error, but a different action is a genuinely new one and must not overwrite the first. The
  // unique index on (member, day, kind) is what keeps both true, and caps this at four rows a day.
  //
  // `count` distinguishes the first tap of the day from a re-tap, which the gift kinds need:
  // recording twice is harmless, but notifying her twice for the same flowers is not.
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

  // Attributed on the first tap only. A re-tap is the same gesture reported twice, and counting it
  // again would inflate the one number the nudge ledger exists to produce.
  if (firstTapToday) {
    await attributeSupportAction({
      familyMemberId: input.familyMemberId,
      kind: input.kind,
      now,
    });
  }

  if (!isGiftKind(input.kind)) {
    return { completedToday: true, pending: false, prompt: null, toast: TOASTS[input.kind] };
  }

  if (!firstTapToday) {
    // Already sent today. Say so rather than silently doing nothing, and do not push again.
    return {
      completedToday: true,
      pending: false,
      prompt: null,
      toast:
        input.kind === 'flowers' ? GIFT_TEXT.alreadyFlowers : GIFT_TEXT.alreadyChocolates,
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
    pending: false,
    prompt: null,
    toast: delivered ? TOASTS[input.kind] : GIFT_TEXT.undelivered,
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

  return { remindAt: remindAt.toISOString(), toast: GIFT_TEXT.reminderSaved };
}
