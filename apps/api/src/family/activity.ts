import { prisma } from '@anuva/database';
import type { FamilyActivityResponse, FamilySupportActionKind } from '@anuva/shared';
import { dayKey } from '../dayKey.js';

/**
 * The return leg of the support loop: what her family did, shown to her.
 *
 * Kept deliberately thin. She sees who is connected, what they did today, and how much of the week
 * they showed up for — no clock times, because "he messaged you at 23:14" turns a gesture into a
 * conversation about the hour. And no failure state: a family member who has done nothing gets no
 * card at all rather than a card reporting their absence.
 */

/** Phrased from her side — she is the one reading it. */
const ACTION_PHRASES: Record<FamilySupportActionKind, string> = {
  message: 'messaged you',
  call: 'called you',
  flowers: 'sent you flowers',
  chocolates: 'sent you chocolates',
};

function joinPhrases(phrases: string[]): string {
  if (phrases.length === 1) return phrases[0]!;
  if (phrases.length === 2) return `${phrases[0]} and ${phrases[1]}`;
  return `${phrases.slice(0, -1).join(', ')} and ${phrases[phrases.length - 1]}`;
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

  const member = await prisma.familyMember.findFirst({
    where: { userId, status: 'active' },
    select: {
      id: true,
      name: true,
      relationship: true,
      phone: true,
      createdAt: true,
      lastSeenAt: true,
    },
  });

  if (!member) {
    return { member: null, today: null, daysThisWeek: 0, weekLine: null };
  }

  const actions = await prisma.familySupportAction.findMany({
    where: { familyMemberId: member.id, date: { gte: dayKey(startOfWeek(now)) } },
    select: { kind: true, date: true },
    orderBy: { createdAt: 'asc' },
  });

  const todayKey = dayKey(now).getTime();
  const todayKinds = actions.filter((a) => a.date.getTime() === todayKey).map((a) => a.kind);
  const daysThisWeek = new Set(actions.map((a) => a.date.getTime())).size;
  const first = firstNameOf(member.name);

  return {
    member: {
      id: member.id,
      name: member.name,
      relationship: member.relationship,
      maskedPhone: maskPhone(member.phone),
      joinedAt: member.createdAt.toISOString(),
      lastSeenAt: member.lastSeenAt.toISOString(),
    },
    today: todayKinds.length
      ? {
          kinds: todayKinds,
          headline: `${first} checked in on you`,
          body: `${first} ${joinPhrases(todayKinds.map((kind) => ACTION_PHRASES[kind]))} today.`,
        }
      : null,
    daysThisWeek,
    weekLine: daysThisWeek
      ? `${first} has shown up ${daysThisWeek === 1 ? 'once' : `${daysThisWeek} days`} this week.`
      : null,
  };
}
