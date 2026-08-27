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

export async function hasActedToday(familyMemberId: string, now = new Date()): Promise<boolean> {
  const existing = await prisma.familySupportAction.findUnique({
    where: { familyMemberId_date: { familyMemberId, date: dayKey(now) } },
    select: { id: true },
  });
  return Boolean(existing);
}

export async function recordSupportAction(input: {
  familyMemberId: string;
  userId: string;
  kind: FamilySupportActionKind;
}): Promise<{ completedToday: true; toast: string }> {
  const now = new Date();

  // Upsert rather than create: tapping twice in a day is a re-affirmation, not an error, and the
  // unique index on (member, day) is what keeps the row count honest.
  await prisma.familySupportAction.upsert({
    where: { familyMemberId_date: { familyMemberId: input.familyMemberId, date: dayKey(now) } },
    create: {
      familyMemberId: input.familyMemberId,
      userId: input.userId,
      kind: input.kind,
      date: dayKey(now),
    },
    update: { kind: input.kind },
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
