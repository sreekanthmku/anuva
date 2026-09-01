import { prisma } from '@anuva/database';
import type {
  FamilyMeResponse,
  FamilySignInRequestOtpResponse,
} from '@anuva/shared';
import { createFamilySession } from './auth.js';
import { FamilyError } from './errors.js';
import { familyMeBody, type OtpDeps } from './join.js';

/**
 * Signing back in.
 *
 * An invite link is single-use and gone the moment it is claimed, and a family session lasts 90
 * days — so without this the only way back after a lapse is to ask her for a fresh link, which is
 * both a nuisance and a reason for her to be nudged again about something she already did. The
 * standing grant is the `FamilyMember` row, not the link; this flow re-opens a session against the
 * phone that row already verified at join.
 *
 * No new authority is created here. Every content route still re-checks the membership, her opt-out
 * and her erasure on each request (see requireFamilyMember), so a session minted here is exactly as
 * revocable as one minted by the join flow.
 */

function addSeconds(date: Date, seconds: number): Date {
  return new Date(date.getTime() + seconds * 1000);
}

function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length <= 4) return phone;
  return `${phone.slice(0, Math.max(0, phone.length - 6))}${'*'.repeat(Math.max(0, phone.length - 6))}${phone.slice(-2)}`;
}

/**
 * The membership this phone signs into.
 *
 * A phone can support two women — that is two rows, and nothing in the schema forbids it. The most
 * recently active one wins, which is the right guess for someone returning to the app; switching
 * between them is not a thing the app offers yet, and inventing an account-picker here would be a
 * screen with no product behind it.
 *
 * A revoked member, an erased patient, or a patient who turned family sharing off all read the same
 * to the caller as a phone that never joined: "no active connection". Telling a caller apart from
 * those cases would confirm that a given number is connected to somebody.
 */
async function findActiveMembership(phone: string) {
  return prisma.familyMember.findFirst({
    where: {
      phone,
      status: 'active',
      user: { erasedAt: null, familyFeatureOptOut: false },
    },
    orderBy: { lastSeenAt: 'desc' },
    select: {
      id: true,
      name: true,
      relationship: true,
      user: { select: { name: true } },
    },
  });
}

const NO_MEMBERSHIP = () =>
  new FamilyError(
    404,
    'family_member_not_found',
    'We could not find an active connection for this number. Ask her to send you a new invite link.',
  );

export async function requestSignInOtp(
  input: { phone: string },
  otp: OtpDeps,
): Promise<FamilySignInRequestOtpResponse> {
  const now = new Date();
  const phone = input.phone;

  const member = await findActiveMembership(phone);
  if (!member) {
    throw NO_MEMBERSHIP();
  }

  // Counted across every purpose on this phone, the same as the join flow and the patient login:
  // the limit protects the SMS spend and the recipient's inbox, neither of which cares why we sent.
  const fifteenMinutesAgo = addSeconds(now, -(15 * 60));
  const [recentSends, lastChallenge] = await Promise.all([
    prisma.otpChallenge.count({ where: { phone, createdAt: { gte: fifteenMinutesAgo } } }),
    prisma.otpChallenge.findFirst({
      where: {
        phone,
        purpose: 'family_signin',
        createdAt: { gte: addSeconds(now, -otp.resendCooldownSeconds) },
      },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    }),
  ]);

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
      // Deliberately unset. The join flow stamps her id so that her erasure sweeps the row; here
      // there is no invite to read a patient from before the phone is proven, and resolving one
      // from the membership would write which woman this number supports into a row that is created
      // before anything is verified.
      purpose: 'family_signin',
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

export async function verifySignInOtp(
  input: { challengeId: string; phone: string; otp: string },
  otp: OtpDeps,
): Promise<{ body: FamilyMeResponse; sessionToken: string; sessionExpiresAt: Date }> {
  const now = new Date();

  const challenge = await prisma.otpChallenge.findUnique({
    where: { id: input.challengeId },
    select: {
      id: true,
      phone: true,
      purpose: true,
      status: true,
      expiresAt: true,
      attemptCount: true,
      providerSessionId: true,
    },
  });

  if (!challenge || challenge.phone !== input.phone || challenge.purpose !== 'family_signin') {
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

  // Re-read rather than trust the row found at request time: she may have revoked access, or opted
  // out, in the minute between the code being sent and it being typed in.
  const member = await findActiveMembership(input.phone);
  if (!member) {
    throw NO_MEMBERSHIP();
  }

  await prisma.otpChallenge.update({
    where: { id: challenge.id },
    data: { status: 'verified', verifiedAt: now },
  });

  const session = await createFamilySession(member.id, now);

  return {
    body: familyMeBody({
      name: member.name,
      relationship: member.relationship,
      patientName: member.user.name,
    }),
    sessionToken: session.token,
    sessionExpiresAt: session.expiresAt,
  };
}
