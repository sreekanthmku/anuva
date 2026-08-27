import { prisma } from '@anuva/database';
import type { FamilySupportActionKind } from '@anuva/shared';
import { dayKey } from '../dayKey.js';

/**
 * One recorded supportive action per member per day. What turns the Today CTA into
 * "✓ Support action completed", and in a later phase what tells her someone checked in.
 */

const TOASTS: Record<FamilySupportActionKind, string> = {
  message: '✓ Message sent. She will see that you thought of her.',
  call: '✓ Call logged. A voice helps more than a text on a hard day.',
  flowers: '✓ Flowers on the way. Recorded for today.',
  chocolates: '✓ Chocolates on the way. Recorded for today.',
};

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
  kind: FamilySupportActionKind;
}): Promise<{ completedToday: true; toast: string }> {
  const now = new Date();

  // Upsert per *kind*: tapping the same action twice in a day is a re-affirmation rather than an
  // error, but a different action is a genuinely new one and must not overwrite the first. The
  // unique index on (member, day, kind) is what keeps both true, and caps this at four rows a day.
  await prisma.familySupportAction.upsert({
    where: {
      familyMemberId_date_kind: {
        familyMemberId: input.familyMemberId,
        date: dayKey(now),
        kind: input.kind,
      },
    },
    create: {
      familyMemberId: input.familyMemberId,
      userId: input.userId,
      kind: input.kind,
      date: dayKey(now),
    },
    update: {},
  });

  return { completedToday: true, toast: TOASTS[input.kind] };
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
