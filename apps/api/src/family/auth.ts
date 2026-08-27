import crypto from 'node:crypto';
import type { Request } from 'express';
import { prisma } from '@anuva/database';
import { FAMILY_SESSION_COOKIE_NAME, FAMILY_SESSION_TTL_DAYS } from './config.js';
import { FamilyError } from './errors.js';

/**
 * Family sessions. Deliberately the same construction as the patient and doctor sessions — an
 * opaque random token in an httpOnly cookie, sha256 of it in Postgres — so there is one story about
 * what a session is in this codebase rather than three.
 *
 * The cookie name differs, which means a woman and her partner can both be signed in on one browser
 * without either session standing on the other.
 */

export type FamilyIdentity = {
  memberId: string;
  name: string;
  relationship: 'partner' | 'child' | 'parent' | 'sibling' | 'friend' | 'other';
  /** The patient this member supports. Every content route scopes to it. */
  userId: string;
  patientName: string | null;
};

function sha256(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function parseCookies(header: string | undefined): Record<string, string> {
  if (!header) return {};

  return header.split(';').reduce<Record<string, string>>((acc, part) => {
    const [rawName, ...rawValue] = part.trim().split('=');
    if (!rawName) return acc;
    acc[rawName] = decodeURIComponent(rawValue.join('='));
    return acc;
  }, {});
}

export function getFamilySessionToken(req: Request): string | null {
  return parseCookies(req.headers.cookie)[FAMILY_SESSION_COOKIE_NAME] || null;
}

export function familySessionExpiry(now: Date): Date {
  return new Date(now.getTime() + FAMILY_SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);
}

/** Returns the raw token — shown to nobody but the browser it is being set on. */
export async function createFamilySession(
  familyMemberId: string,
  now: Date,
): Promise<{ token: string; expiresAt: Date }> {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = familySessionExpiry(now);

  await prisma.familySession.create({
    data: { tokenHash: sha256(token), familyMemberId, expiresAt },
  });

  return { token, expiresAt };
}

/**
 * Resolves the signed-in family member.
 *
 * Four things can end their access and all four are checked on every request, because a family
 * member's cookie lives for months and any of these can change under it: the session expiring, the
 * member being revoked, the patient being erased, and the patient opting out of family features. The
 * last one matters most — `familyFeatureOptOut` means "do not involve my family", and it has to take
 * effect on her word, not when a cookie happens to lapse.
 */
export async function requireFamilyMember(req: Request): Promise<FamilyIdentity> {
  const token = getFamilySessionToken(req);
  if (!token) {
    throw new FamilyError(401, 'no_family_session', 'You are not signed in.');
  }

  const session = await prisma.familySession.findUnique({
    where: { tokenHash: sha256(token) },
    select: {
      id: true,
      expiresAt: true,
      member: {
        select: {
          id: true,
          name: true,
          relationship: true,
          status: true,
          userId: true,
          user: { select: { name: true, erasedAt: true, familyFeatureOptOut: true } },
        },
      },
    },
  });

  if (!session || session.expiresAt <= new Date()) {
    throw new FamilyError(401, 'family_session_expired', 'Your session has expired. Open your invite link again.');
  }

  const { member } = session;

  if (member.status !== 'active') {
    throw new FamilyError(403, 'family_access_revoked', 'You no longer have access to this.');
  }

  if (member.user.erasedAt || member.user.familyFeatureOptOut) {
    throw new FamilyError(403, 'family_sharing_stopped', 'Sharing has been turned off.');
  }

  await prisma.$transaction([
    prisma.familySession.update({ where: { id: session.id }, data: { lastSeenAt: new Date() } }),
    prisma.familyMember.update({ where: { id: member.id }, data: { lastSeenAt: new Date() } }),
  ]);

  req.log = req.log?.child?.({ familyMemberId: member.id, userId: member.userId }) ?? req.log;

  return {
    memberId: member.id,
    name: member.name,
    relationship: member.relationship,
    userId: member.userId,
    patientName: member.user.name,
  };
}

export async function destroyFamilySession(req: Request): Promise<void> {
  const token = getFamilySessionToken(req);
  if (!token) return;
  await prisma.familySession.deleteMany({ where: { tokenHash: sha256(token) } });
}
