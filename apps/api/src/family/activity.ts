import { prisma } from '@anuva/database';
import type { FamilyActivityResponse, FamilySupportActionKind } from '@anuva/shared';
import { FAMILY_MAX_MEMBERS } from './config.js';
import { dayKey } from '../dayKey.js';

/**
 * The return leg of the support loop: what her family did, shown to her.
 *
 * Kept deliberately thin. She sees who is connected, what they did today, and how much of the week
 * they showed up for — no clock times, because "he messaged you at 23:14" turns a gesture into a
 * conversation about the hour. And no failure state: a family member who has done nothing gets no
 * card at all rather than a card reporting their absence. That last rule matters more than it did
 * when there was one slot, because with several people connected an absence becomes a comparison.
 */

/** Phrased from her side — she is the one reading it. */
const ACTION_PHRASES: Record<FamilySupportActionKind, string> = {
  message: 'messaged you',
  call: 'called you',
  flowers: 'sent you flowers 🌻',
  chocolates: 'sent you chocolates 🍫',
};

/**
 * The same gestures again, as standalone lines rather than clauses in a sentence — what the card
 * expands into when she taps it. Sentence-shaped, because in the detail view each one is a row of
 * its own rather than part of a list.
 */
const ACTION_LINES: Record<FamilySupportActionKind, string> = {
  message: 'Sent you a message',
  call: 'Called you',
  flowers: 'Sent you flowers',
  chocolates: 'Sent you chocolates',
};

function joinWords(words: string[]): string {
  if (words.length === 1) return words[0]!;
  if (words.length === 2) return `${words[0]} and ${words[1]}`;
  return `${words.slice(0, -1).join(', ')} and ${words[words.length - 1]}`;
}

function firstNameOf(name: string): string {
  return name.trim().split(/\s+/)[0] || name;
}

function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length <= 4) return phone;
  return `${phone.slice(0, Math.max(0, phone.length - 6))}${'*'.repeat(Math.max(0, phone.length - 6))}${phone.slice(-2)}`;
}

/** Monday of the current week, at local midnight. Matches the report's Mon–Sun window. */
function startOfWeek(now: Date): Date {
  const start = new Date(now);
  const weekday = (start.getDay() + 6) % 7; // Monday = 0
  start.setDate(start.getDate() - weekday);
  start.setHours(0, 0, 0, 0);
  return start;
}

export async function buildFamilyActivity(userId: string): Promise<FamilyActivityResponse> {
  const now = new Date();

  const members = await prisma.familyMember.findMany({
    where: { userId, status: 'active' },
    orderBy: { createdAt: 'desc' },
    take: FAMILY_MAX_MEMBERS,
    select: {
      id: true,
      name: true,
      relationship: true,
      phone: true,
      createdAt: true,
      lastSeenAt: true,
    },
  });

  if (members.length === 0) {
    return { member: null, members: [], today: null, daysThisWeek: 0, weekLine: null };
  }

  const summaries = members.map((member) => ({
    id: member.id,
    name: member.name,
    relationship: member.relationship,
    maskedPhone: maskPhone(member.phone),
    joinedAt: member.createdAt.toISOString(),
    lastSeenAt: member.lastSeenAt.toISOString(),
  }));

  const firstNames = new Map(members.map((member) => [member.id, firstNameOf(member.name)]));

  const actions = await prisma.familySupportAction.findMany({
    where: {
      familyMemberId: { in: members.map((member) => member.id) },
      date: { gte: dayKey(startOfWeek(now)) },
    },
    select: { kind: true, date: true, familyMemberId: true },
    orderBy: { createdAt: 'asc' },
  });

  const todayKey = dayKey(now).getTime();
  const todayActions = actions.filter((action) => action.date.getTime() === todayKey);

  // Distinct *days* anyone showed up, not the sum of everyone's days. Two people checking in on the
  // same Tuesday is one day on which she was thought of, and adding them up would eventually put
  // "5 of 4 days this week" on her screen.
  const daysThisWeek = new Set(actions.map((action) => action.date.getTime())).size;

  // Deduplicated in first-action order, so the headline names people in the order they showed up.
  const actorsToday = [...new Set(todayActions.map((action) => action.familyMemberId))].map(
    (id) => firstNames.get(id) ?? 'Someone',
  );

  const dayCount = daysThisWeek === 1 ? 'once' : `${daysThisWeek} days`;

  return {
    member: summaries[0] ?? null,
    members: summaries,
    today: todayActions.length
      ? {
          items: todayActions.map((action) => ({
            kind: action.kind,
            label: ACTION_LINES[action.kind],
            memberFirstName: firstNames.get(action.familyMemberId) ?? 'Someone',
          })),
          headline: `${joinWords(actorsToday)} checked in on you`,
          // One person keeps the original sentence naming what they did. Several would run to a
          // paragraph if every gesture were attributed inline, so the body counts people instead and
          // the expanded items carry who did what — which is what `memberFirstName` is for.
          body:
            actorsToday.length === 1
              ? `${actorsToday[0]} ${joinWords(todayActions.map((action) => ACTION_PHRASES[action.kind]))} today.`
              : `${actorsToday.length} people thought of you today.`,
        }
      : null,
    daysThisWeek,
    weekLine: daysThisWeek
      ? members.length > 1
        ? `Your family has shown up ${dayCount} this week.`
        : `${firstNames.get(members[0]!.id)} has shown up ${dayCount} this week.`
      : null,
  };
}
