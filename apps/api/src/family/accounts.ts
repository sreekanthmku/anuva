import { prisma } from '@anuva/database';
import type { FamilyAccount, FamilyMeResponse } from '@anuva/shared';
import { createFamilySession } from './auth.js';
import { FamilyError } from './errors.js';
import { familyMeBody, firstNameOf } from './join.js';
import type { LoginContext } from '../loginHistory.js';

/**
 * One person, several women.
 *
 * A family member who supports two women holds two memberships — two `FamilyMember` rows, each
 * joined through that woman's own invite and each verified by OTP against the same phone. There is
 * no separate "family person" record: the verified phone is what ties the memberships together, and
 * a session is signed into exactly one of them at a time. Everything a content route shows is scoped
 * to that one woman, as before.
 *
 * Only active memberships of women who still share count. A revoked membership, an erased patient
 * or a patient who turned sharing off drops out of the list the same way it drops out of sign-in.
 */

const LIVE_MEMBERSHIP = {
  status: 'active',
  user: { erasedAt: null, familyFeatureOptOut: false },
} as const;

/** Every live membership on this phone, most recently used first. */
export async function familyAccountsForPhone(phone: string, currentMemberId: string): Promise<FamilyAccount[]> {
  const rows = await prisma.familyMember.findMany({
    where: { phone, ...LIVE_MEMBERSHIP },
    orderBy: { lastSeenAt: 'desc' },
    select: { id: true, relationship: true, user: { select: { name: true } } },
  });
  return rows.map((row) => ({
    memberId: row.id,
    patientFirstName: firstNameOf(row.user.name),
    relationship: row.relationship,
    current: row.id === currentMemberId,
  }));
}

export async function familyAccountsForMember(memberId: string): Promise<FamilyAccount[]> {
  const member = await prisma.familyMember.findUnique({ where: { id: memberId }, select: { phone: true } });
  return member ? familyAccountsForPhone(member.phone, memberId) : [];
}

/**
 * Moves a signed-in person to another of their memberships. The target must share the phone the
 * current membership verified — that phone is the credential for both — so no new code is needed,
 * and no membership on any other phone can be reached this way.
 *
 * Returns a fresh session for the target; the caller ends the old one and swaps the cookie.
 */
export async function switchFamilyAccount(
  currentMemberId: string,
  targetMemberId: string,
  login: LoginContext,
): Promise<{ body: FamilyMeResponse; sessionToken: string; sessionExpiresAt: Date }> {
  const current = await prisma.familyMember.findUnique({
    where: { id: currentMemberId },
    select: { phone: true },
  });
  const target = current
    ? await prisma.familyMember.findFirst({
        where: { id: targetMemberId, phone: current.phone, ...LIVE_MEMBERSHIP },
        select: {
          id: true,
          name: true,
          relationship: true,
          periodSharing: true,
          emergencyAlerts: true,
          user: { select: { name: true } },
        },
      })
    : null;

  // The same answer for "not yours" and "no longer available": telling them apart would confirm
  // that a given id belongs to somebody.
  if (!current || !target) {
    throw new FamilyError(404, 'account_not_found', 'This account is no longer available.');
  }

  const now = new Date();
  const session = await createFamilySession(target.id, now, login);
  await prisma.familyMember.update({ where: { id: target.id }, data: { lastSeenAt: now } });

  return {
    body: familyMeBody(
      {
        name: target.name,
        relationship: target.relationship,
        patientName: target.user.name,
        periodSharing: target.periodSharing,
        emergencyAlerts: target.emergencyAlerts,
      },
      await familyAccountsForPhone(current.phone, target.id),
    ),
    sessionToken: session.token,
    sessionExpiresAt: session.expiresAt,
  };
}
