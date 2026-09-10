import { prisma } from '@anuva/database';
import type { FamilySupportActionKind, FamilyThanksResponse } from '@anuva/shared';
import { sendToFamilyMember } from './push.js';
import { FamilyError } from './errors.js';
import { rateLimit } from './rateLimit.js';

/**
 * The last leg of the support loop: she received something, and says so.
 *
 * Everything else in this module travels from her family toward her. This is the one thing that
 * goes the other way, and it is deliberately the smallest possible signal — a smiley and a name.
 * No text field, because a reply box would make this correspondence, and correspondence is a
 * commitment she does not owe anybody in exchange for a gesture.
 *
 * Nothing is stored, for the same reason a note is not: the fact that a thank-you was received only
 * has to survive as long as the notification it arrives in.
 */

/** Generous enough for every gesture she gets in a day, small enough not to become a channel. */
const THANKS_LIMIT = 12;
const THANKS_WINDOW_MS = 60 * 60 * 1000;

/** What she is thanking them *for*, phrased for their lock screen. */
const FOR_GESTURE: Record<FamilySupportActionKind, string> = {
  message: 'your note',
  call: 'your call',
  flowers: 'the roses',
  chocolates: 'the chocolates',
};

function firstNameOf(name: string | null | undefined): string {
  return name?.trim().split(/\s+/)[0] || 'She';
}

export async function sendFamilyThanks(input: {
  userId: string;
  kind?: FamilySupportActionKind;
  memberId?: string;
}): Promise<FamilyThanksResponse> {
  if (!rateLimit(`familyThanks:${input.userId}`, THANKS_LIMIT, THANKS_WINDOW_MS)) {
    throw new FamilyError(
      429,
      'thanks_rate_limited',
      'That is plenty of thank-yous for now. Try again in a little while.',
    );
  }

  const [user, members] = await Promise.all([
    prisma.user.findUnique({ where: { id: input.userId }, select: { name: true } }),
    prisma.familyMember.findMany({
      where: {
        userId: input.userId,
        status: 'active',
        ...(input.memberId ? { id: input.memberId } : {}),
      },
      select: { id: true },
    }),
  ]);

  if (members.length === 0) {
    // Nobody connected — or a memberId that is not hers. Same answer either way, so a guessed id
    // tells the caller nothing it did not already know.
    return { delivered: false, toast: 'Thank you noted.' };
  }

  const first = firstNameOf(user?.name);
  const forGesture = input.kind ? FOR_GESTURE[input.kind] : null;

  const title = `${first} says thank you 😊`;
  const body = forGesture
    ? `She opened ${forGesture} and it landed. 💛`
    : 'She saw what you did today, and it landed. 💛';

  // Deep-links to Today, where the support card is — the natural next thing after being thanked is
  // to do the next day's gesture, not to read a receipt.
  const data = { url: '/', familyThanks: input.kind ?? 'general', familyThanksFrom: first };

  const results = await Promise.all(
    members.map((member) => sendToFamilyMember(member.id, { title, body }, data)),
  );
  const delivered = results.some((count) => count > 0);

  return {
    delivered,
    toast: delivered ? '✓ They will know it landed.' : 'Thank you noted.',
  };
}
