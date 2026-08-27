import { prisma } from '@anuva/database';
import type {
  FamilyJoinPreviewResponse,
  FamilyJoinRequestOtpResponse,
  FamilyMeResponse,
  FamilyRelationship,
} from '@anuva/shared';
import { FamilyError } from './errors.js';
import { FAMILY_SHARED_SCOPES } from './content.js';
import { createFamilySession } from './auth.js';
import { inviteTokenHash, parseInviteToken } from './tokens.js';

/**
 * Claiming an invite.
 *
 * The invite token is the only thing standing between a stranger and a woman's wellness trends
 * before the OTP step, so every route here re-validates it from scratch rather than trusting a
 * previous step. Three guards apply in order on every call: the signature must hold, the invite must
 * still be claimable, and the patient must still be sharing.
 */

export type OtpDeps = {
  /** Sends the OTP and returns the provider's session id. */
  send: (phone: string) => Promise<string>;
  verify: (providerSessionId: string, otp: string) => Promise<void>;
  expiryMinutes: number;
  resendCooldownSeconds: number;
  maxSendsPer15Minutes: number;
  maxVerifyAttempts: number;
};

function addSeconds(date: Date, seconds: number): Date {
  return new Date(date.getTime() + seconds * 1000);
}

function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length <= 4) return phone;
  return `${phone.slice(0, Math.max(0, phone.length - 6))}${'*'.repeat(Math.max(0, phone.length - 6))}${phone.slice(-2)}`;
}

function firstNameOf(name: string | null): string {
  return name?.trim().split(/\s+/)[0] || 'She';
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0];
  if (!first) return '?';
  const last = parts.length > 1 ? parts[parts.length - 1] : undefined;
  if (!last) return first.slice(0, 2).toUpperCase();
  return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase();
}

const INVITE_WITH_USER = {
  id: true,
  tokenHash: true,
  status: true,
  expiresAt: true,
  userId: true,
  user: {
    select: { id: true, name: true, phone: true, erasedAt: true, familyFeatureOptOut: true },
  },
} as const;

type LoadedInvite = {
  id: string;
  status: 'pending' | 'accepted' | 'revoked' | 'expired';
  expiresAt: Date;
  userId: string;
  user: {
    id: string;
    name: string | null;
    phone: string;
    erasedAt: Date | null;
    familyFeatureOptOut: boolean;
  };
};

/**
 * Resolve a token to its invite. An unknown or tampered token is a 404 and nothing more: telling a
 * stranger the difference between "no such invite" and "that invite was revoked" is a disclosure in
 * itself.
 */
async function loadInvite(token: string): Promise<LoadedInvite> {
  const inviteId = parseInviteToken(token);
  if (!inviteId) {
    throw new FamilyError(404, 'invite_not_found', 'This link is not valid.');
  }

  const invite = await prisma.familyInvite.findUnique({
    where: { id: inviteId },
    select: INVITE_WITH_USER,
  });

  // The signature already proved the id, so a hash mismatch cannot happen through the front door.
  // Checked anyway: it is the assertion that the stored row and the presented token are the same
  // credential, and it costs one string compare.
  if (!invite || invite.tokenHash !== inviteTokenHash(token)) {
    throw new FamilyError(404, 'invite_not_found', 'This link is not valid.');
  }

  return invite;
}

/** She stopped sharing, or her account is gone. The recipient learns nothing about which. */
function assertPatientStillSharing(invite: LoadedInvite): void {
  if (invite.user.erasedAt || invite.user.familyFeatureOptOut) {
    throw new FamilyError(410, 'invite_unavailable', 'This link is no longer active.');
  }
}

function assertClaimable(invite: LoadedInvite, now: Date): void {
  if (invite.status === 'accepted') {
    throw new FamilyError(409, 'invite_claimed', 'Someone has already joined with this link.');
  }
  if (invite.status !== 'pending' || invite.expiresAt <= now) {
    throw new FamilyError(410, 'invite_expired', 'This link has expired. Ask her for a new one.');
  }
}

/**
 * What a visitor holding the link may know before verifying anything: her first name, and whether
 * the link still works. Revoked and expired both read as "expired" — that she revoked it is her
 * business, not the recipient's.
 */
export async function previewInvite(token: string): Promise<FamilyJoinPreviewResponse> {
  const now = new Date();
  const invite = await loadInvite(token);
  assertPatientStillSharing(invite);

  if (invite.status === 'accepted') {
    return { patientFirstName: firstNameOf(invite.user.name), status: 'claimed' };
  }

  if (invite.status !== 'pending' || invite.expiresAt <= now) {
    return { patientFirstName: firstNameOf(invite.user.name), status: 'expired' };
  }

  return { patientFirstName: firstNameOf(invite.user.name), status: 'pending' };
}

export async function requestJoinOtp(
  input: { token: string; phone: string; name: string; relationship: FamilyRelationship },
  otp: OtpDeps,
): Promise<FamilyJoinRequestOtpResponse> {
  const now = new Date();
  const invite = await loadInvite(input.token);
  assertPatientStillSharing(invite);
  assertClaimable(invite, now);

  const phone = input.phone;

  // A family member may use the same number as hers. Households share phones, and the number she
  // registered with is often the family one — refusing it would lock out the very people this is
  // for. It grants no access she does not already have: anyone holding that phone can already OTP
  // into her full account, so the family session is strictly the weaker of the two credentials.
  //
  // Nor is a phone unique across patients: the same person supporting two women is two rows.

  const fifteenMinutesAgo = addSeconds(now, -(15 * 60));
  const [recentSends, lastChallenge] = await Promise.all([
    prisma.otpChallenge.count({ where: { phone, createdAt: { gte: fifteenMinutesAgo } } }),
    prisma.otpChallenge.findFirst({
      where: {
        phone,
        purpose: 'family_join',
        createdAt: { gte: addSeconds(now, -otp.resendCooldownSeconds) },
      },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    }),
  ]);

  // Counted across every purpose on this phone, the same as the patient login flow: the limit
  // protects the SMS spend and the recipient's inbox, neither of which cares why we sent it.
  if (recentSends >= otp.maxSendsPer15Minutes) {
    throw new FamilyError(429, 'otp_rate_limited', 'Too many codes requested. Try again in a few minutes.');
  }

  if (lastChallenge) {
    const retryIn = Math.max(
      0,
      Math.ceil(
        (addSeconds(lastChallenge.createdAt, otp.resendCooldownSeconds).getTime() - now.getTime()) / 1000,
      ),
    );
    if (retryIn > 0) {
      throw new FamilyError(429, 'otp_cooldown', `Please wait ${retryIn} seconds before asking for another code.`);
    }
  }

  const providerSessionId = await otp.send(phone);

  const challenge = await prisma.otpChallenge.create({
    data: {
      phone,
      // The patient, not the family member — this phone has no account. It is set so that her
      // erasure sweeps the row: `eraseAccount` deletes challenges by userId or by her phone, and a
      // family member's number matches neither, which would leave a third party's phone behind.
      userId: invite.userId,
      purpose: 'family_join',
      provider: '2factor',
      providerSessionId,
      expiresAt: addSeconds(now, otp.expiryMinutes * 60),
    },
    select: { id: true },
  });

  return {
    challengeId: challenge.id,
    maskedPhone: maskPhone(phone),
    resendAfterSeconds: otp.resendCooldownSeconds,
  };
}

export async function verifyJoinOtp(
  input: {
    token: string;
    challengeId: string;
    phone: string;
    otp: string;
    name: string;
    relationship: FamilyRelationship;
  },
  otp: OtpDeps,
): Promise<{ body: FamilyMeResponse; sessionToken: string; sessionExpiresAt: Date }> {
  const now = new Date();
  const invite = await loadInvite(input.token);
  assertPatientStillSharing(invite);
  assertClaimable(invite, now);

  const challenge = await prisma.otpChallenge.findUnique({
    where: { id: input.challengeId },
    select: { id: true, phone: true, purpose: true, status: true, expiresAt: true, attemptCount: true, providerSessionId: true },
  });

  if (!challenge || challenge.phone !== input.phone || challenge.purpose !== 'family_join') {
    throw new FamilyError(404, 'challenge_not_found', 'That code request could not be found.');
  }

  if (challenge.status !== 'pending') {
    throw new FamilyError(400, 'challenge_used', 'That code has already been used. Ask for a new one.');
  }

  if (challenge.expiresAt <= now) {
    await prisma.otpChallenge.update({ where: { id: challenge.id }, data: { status: 'expired' } });
    throw new FamilyError(400, 'challenge_expired', 'That code has expired. Ask for a new one.');
  }

  if (challenge.attemptCount >= otp.maxVerifyAttempts) {
    await prisma.otpChallenge.update({ where: { id: challenge.id }, data: { status: 'failed' } });
    throw new FamilyError(429, 'too_many_attempts', 'Too many incorrect codes. Ask for a new one.');
  }

  try {
    await otp.verify(challenge.providerSessionId, input.otp);
  } catch (error) {
    const nextCount = challenge.attemptCount + 1;
    await prisma.otpChallenge.update({
      where: { id: challenge.id },
      data: {
        attemptCount: { increment: 1 },
        status: nextCount >= otp.maxVerifyAttempts ? 'failed' : 'pending',
      },
    });
    throw error;
  }

  // One transaction, because a member without an accepted invite would let the link be claimed
  // twice, and an accepted invite without a member would lock her out of inviting anyone.
  let member: { id: string; name: string; relationship: FamilyRelationship };
  try {
    member = await prisma.$transaction(async (tx) => {
      const created = await tx.familyMember.create({
        data: {
          userId: invite.userId,
          name: input.name.trim(),
          relationship: input.relationship,
          phone: input.phone,
          phoneVerifiedAt: now,
        },
        select: { id: true, name: true, relationship: true },
      });

      // Guarded on `status: 'pending'` so two verifies racing to the same link cannot both accept
      // it: the loser updates zero rows and is rolled back below.
      const claimed = await tx.familyInvite.updateMany({
        where: { id: invite.id, status: 'pending' },
        data: { status: 'accepted', acceptedAt: now, memberId: created.id },
      });

      if (claimed.count === 0) {
        throw new FamilyError(409, 'invite_claimed', 'Someone has already joined with this link.');
      }

      return created;
    });
  } catch (error) {
    // The partial unique index on one-active-member fires here when a second person claims a link
    // in the same instant.
    if (typeof error === 'object' && error !== null && (error as { code?: unknown }).code === 'P2002') {
      throw new FamilyError(409, 'invite_claimed', 'Someone has already joined with this link.');
    }
    throw error;
  }

  await prisma.otpChallenge.update({
    where: { id: challenge.id },
    data: { status: 'verified', verifiedAt: now },
  });

  const session = await createFamilySession(member.id, now);

  return {
    body: {
      member: {
        firstName: firstNameOf(member.name),
        initials: initialsOf(member.name),
        relationship: member.relationship,
      },
      patientFirstName: firstNameOf(invite.user.name),
      sharedScopes: [...FAMILY_SHARED_SCOPES],
    },
    sessionToken: session.token,
    sessionExpiresAt: session.expiresAt,
  };
}

export function familyMeBody(identity: {
  name: string;
  relationship: FamilyRelationship;
  patientName: string | null;
}): FamilyMeResponse {
  return {
    member: {
      firstName: firstNameOf(identity.name),
      initials: initialsOf(identity.name),
      relationship: identity.relationship,
    },
    patientFirstName: firstNameOf(identity.patientName),
    sharedScopes: [...FAMILY_SHARED_SCOPES],
  };
}
