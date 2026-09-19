import crypto from 'node:crypto';
import { prisma } from '@anuva/database';
import type { FamilyGate, FamilyInvite, FamilyStatusResponse } from '@anuva/shared';
import {
  FAMILY_CONSENT_VERSION,
  FAMILY_INVITE_TTL_DAYS,
  FAMILY_MAX_MEMBERS,
  FAMILY_REPROMPT_MINUTES,
} from './config.js';
import { FamilyError } from './errors.js';
import { buildShareMessage, buildShareUrl, inviteTokenHash, mintInviteToken } from './tokens.js';

/**
 * The invite half of family sharing: minting the magic link, recording that it was shared, and
 * deciding whether the gate in the patient PWA is open.
 *
 * The gate's grace window is measured from `FamilyInvite.sharedAt` in Postgres rather than from a
 * client timer, so a reload, a second device, or a reinstall cannot buy more time before it
 * re-opens. The client renders `gate`; it never computes it.
 */

type InviteRow = {
  id: string;
  expiresAt: Date;
  sharedAt: Date | null;
  shareCount: number;
};

type MemberRow = {
  id: string;
  name: string;
  relationship: 'partner' | 'child' | 'parent' | 'sibling' | 'friend' | 'other';
  phone: string;
  createdAt: Date;
  lastSeenAt: Date;
};

const INVITE_SELECT = { id: true, expiresAt: true, sharedAt: true, shareCount: true } as const;

const MEMBER_SELECT = {
  id: true,
  name: true,
  relationship: true,
  phone: true,
  createdAt: true,
  lastSeenAt: true,
} as const;

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

/** Same shape as the masking in the auth routes: enough to recognise a number, not to dial it. */
function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length <= 4) {
    return phone;
  }
  return `${phone.slice(0, Math.max(0, phone.length - 6))}${'*'.repeat(Math.max(0, phone.length - 6))}${phone.slice(-2)}`;
}

function firstNameOf(name: string | null): string | null {
  return name?.trim().split(/\s+/)[0] || null;
}

function serializeInvite(row: InviteRow): FamilyInvite {
  const token = mintInviteToken(row.id);
  const shareUrl = buildShareUrl(token);

  return {
    id: row.id,
    shareUrl,
    shareMessage: '',
    expiresAt: row.expiresAt.toISOString(),
    sharedAt: row.sharedAt?.toISOString() ?? null,
    shareCount: row.shareCount,
  };
}

function withShareMessage(invite: FamilyInvite, firstName: string | null): FamilyInvite {
  return { ...invite, shareMessage: buildShareMessage(firstName, invite.shareUrl) };
}

/**
 * The whole gate decision, in one place.
 *
 * `repromptAfterSeconds` is non-null only while a share is still inside its grace window: it is how
 * long until the gate re-opens, and what the client arms a timer for. Null means there is nothing
 * to wait for — the gate is either already open, or closed for good because someone joined.
 */
export function computeGate(
  input: {
    optedOut: boolean;
    onboardingCompleted: boolean;
    hasMember: boolean;
    sharedAt: Date | null;
  },
  now: Date,
): FamilyGate {
  if (input.optedOut || !input.onboardingCompleted || input.hasMember) {
    return { mustShare: false, repromptAfterSeconds: null };
  }

  if (!input.sharedAt) {
    return { mustShare: true, repromptAfterSeconds: null };
  }

  const reopensAt = input.sharedAt.getTime() + FAMILY_REPROMPT_MINUTES * 60 * 1000;
  const remainingMs = reopensAt - now.getTime();

  if (remainingMs <= 0) {
    return { mustShare: true, repromptAfterSeconds: null };
  }

  return { mustShare: false, repromptAfterSeconds: Math.ceil(remainingMs / 1000) };
}

async function loadUser(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      onboardingCompleted: true,
      familyFeatureOptOut: true,
      erasedAt: true,
    },
  });

  if (!user || user.erasedAt) {
    throw new FamilyError(401, 'no_account', 'This account is no longer available.');
  }

  return user;
}

/**
 * Everyone currently connected, newest first.
 *
 * Was a single `findFirst`. The nudge corpus is written for a partner, a teen and a caregiver, and
 * one slot meant only one of the three could ever receive it — so the cap moved to
 * `FAMILY_MAX_MEMBERS` and this returns a list. Newest first because the most recent joiner is the
 * one she is most likely to be looking for, and because the patient PWA's single-slot `member` field
 * is served from the head of it.
 */
function activeMembers(userId: string) {
  return prisma.familyMember.findMany({
    where: { userId, status: 'active' },
    select: MEMBER_SELECT,
    orderBy: { createdAt: 'desc' },
    take: FAMILY_MAX_MEMBERS,
  });
}

/**
 * The pending invite, minting one if there is none and retiring one that has expired. She must
 * always have a link to show, so this is called on the read path and not only on an explicit
 * "create link" action.
 *
 * The `FamilyInvite_single_pending` partial index means two concurrent calls cannot both insert; the
 * loser reads the winner's row instead of failing.
 */
async function ensurePendingInvite(userId: string, now: Date): Promise<InviteRow> {
  const existing = await prisma.familyInvite.findFirst({
    where: { userId, status: 'pending' },
    select: INVITE_SELECT,
    orderBy: { createdAt: 'desc' },
  });

  if (existing && existing.expiresAt > now) {
    return existing;
  }

  if (existing) {
    await prisma.familyInvite.update({
      where: { id: existing.id },
      data: { status: 'expired' },
    });
  }

  try {
    return await mintInvite(userId, now);
  } catch (error) {
    if (isUniqueViolation(error)) {
      const winner = await prisma.familyInvite.findFirst({
        where: { userId, status: 'pending' },
        select: INVITE_SELECT,
        orderBy: { createdAt: 'desc' },
      });
      if (winner) {
        return winner;
      }
    }
    throw error;
  }
}

/**
 * Two writes in one transaction, because the token is derived from the row id and the id does not
 * exist until the row does. The placeholder hash never leaves the transaction, and cannot collide
 * with a real one: a real value is 64 hex characters, this one is not.
 */
async function mintInvite(userId: string, now: Date): Promise<InviteRow> {
  return prisma.$transaction(async (tx) => {
    const created = await tx.familyInvite.create({
      data: {
        userId,
        tokenHash: `minting:${crypto.randomBytes(24).toString('hex')}`,
        expiresAt: addDays(now, FAMILY_INVITE_TTL_DAYS),
        consentVersion: FAMILY_CONSENT_VERSION,
      },
      select: { id: true },
    });

    return tx.familyInvite.update({
      where: { id: created.id },
      data: { tokenHash: inviteTokenHash(mintInviteToken(created.id)) },
      select: INVITE_SELECT,
    });
  });
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { code?: unknown }).code === 'P2002'
  );
}

export async function getFamilyStatus(userId: string): Promise<FamilyStatusResponse> {
  const now = new Date();
  const user = await loadUser(userId);
  const members = await activeMembers(userId);

  // Nothing to invite anyone to once every slot is taken, and nothing to show if she opted out —
  // in both cases minting a link would be pointless work and a pointless secret.
  const full = members.length >= FAMILY_MAX_MEMBERS;
  const invite = full || user.familyFeatureOptOut ? null : await ensurePendingInvite(userId, now);

  return buildStatus(user, members, invite, now);
}

function serializeMember(member: MemberRow) {
  return {
    id: member.id,
    name: member.name,
    relationship: member.relationship,
    maskedPhone: maskPhone(member.phone),
    joinedAt: member.createdAt.toISOString(),
    lastSeenAt: member.lastSeenAt.toISOString(),
  };
}

function buildStatus(
  user: { name: string | null; onboardingCompleted: boolean; familyFeatureOptOut: boolean },
  members: MemberRow[],
  invite: InviteRow | null,
  now: Date,
): FamilyStatusResponse {
  const firstName = firstNameOf(user.name);
  const serialized = members.map(serializeMember);

  return {
    // One joiner closes the gate for good, not a full roster. The gate exists to get her past the
    // first share, and re-opening it to chase a second and third person would turn a one-time ask
    // into a standing one — which is the behaviour `familyFeatureOptOut` exists to relieve.
    gate: computeGate(
      {
        optedOut: user.familyFeatureOptOut,
        onboardingCompleted: user.onboardingCompleted,
        hasMember: members.length > 0,
        sharedAt: invite?.sharedAt ?? null,
      },
      now,
    ),
    invite: invite ? withShareMessage(serializeInvite(invite), firstName) : null,
    member: serialized[0] ?? null,
    members: serialized,
    slotsRemaining: Math.max(0, FAMILY_MAX_MEMBERS - members.length),
    optedOut: user.familyFeatureOptOut,
  };
}

/**
 * A fresh link, replacing any pending one. The new invite has no `sharedAt`, so the gate opens
 * immediately — correct, because a link she has not sent anywhere cannot count as shared.
 */
export async function rotateInvite(userId: string): Promise<FamilyInvite> {
  const now = new Date();
  const user = await loadUser(userId);

  const members = await activeMembers(userId);
  if (members.length >= FAMILY_MAX_MEMBERS) {
    throw new FamilyError(
      409,
      'member_slots_full',
      `You can have ${FAMILY_MAX_MEMBERS} people connected at a time. Remove someone first to invite anyone else.`,
      { key: 'errors.family.memberSlotsFull', vars: { count: FAMILY_MAX_MEMBERS } },
    );
  }

  const invite = await prisma.$transaction(async (tx) => {
    await tx.familyInvite.updateMany({
      where: { userId, status: 'pending' },
      data: { status: 'revoked' },
    });

    const created = await tx.familyInvite.create({
      data: {
        userId,
        tokenHash: `minting:${crypto.randomBytes(24).toString('hex')}`,
        expiresAt: addDays(now, FAMILY_INVITE_TTL_DAYS),
        consentVersion: FAMILY_CONSENT_VERSION,
      },
      select: { id: true },
    });

    return tx.familyInvite.update({
      where: { id: created.id },
      data: { tokenHash: inviteTokenHash(mintInviteToken(created.id)) },
      select: INVITE_SELECT,
    });
  });

  return withShareMessage(serializeInvite(invite), firstNameOf(user.name));
}

/**
 * Records that she actually sent the link. This is the only thing that closes the gate, so it is
 * called on every share path — including `navigator.share`, which on iOS reports neither success
 * nor cancellation, and so must be treated as a share the moment the sheet opens.
 */
export async function markInviteShared(
  userId: string,
  inviteId: string,
): Promise<{ gate: FamilyGate; invite: FamilyInvite }> {
  const now = new Date();
  const user = await loadUser(userId);

  const invite = await prisma.familyInvite.findFirst({
    where: { id: inviteId, userId },
    select: { id: true, status: true, expiresAt: true },
  });

  if (!invite) {
    throw new FamilyError(404, 'invite_not_found', 'That invite no longer exists.');
  }

  if (invite.status !== 'pending' || invite.expiresAt <= now) {
    throw new FamilyError(410, 'invite_stale', 'That link is no longer valid. Get a new one.');
  }

  const updated = await prisma.familyInvite.update({
    where: { id: invite.id },
    data: { sharedAt: now, shareCount: { increment: 1 } },
    select: INVITE_SELECT,
  });

  const members = await activeMembers(userId);

  return {
    gate: computeGate(
      {
        optedOut: user.familyFeatureOptOut,
        onboardingCompleted: user.onboardingCompleted,
        hasMember: members.length > 0,
        sharedAt: updated.sharedAt,
      },
      now,
    ),
    invite: withShareMessage(serializeInvite(updated), firstNameOf(user.name)),
  };
}

export async function revokeInvite(userId: string, inviteId: string): Promise<void> {
  const { count } = await prisma.familyInvite.updateMany({
    where: { id: inviteId, userId, status: 'pending' },
    data: { status: 'revoked' },
  });

  if (count === 0) {
    throw new FamilyError(404, 'invite_not_found', 'That invite no longer exists.');
  }
}

/**
 * Revoking a member frees the single-active slot and drops their sessions immediately, so access
 * ends on their next request rather than whenever their cookie happens to expire. The accepted
 * invite row is left as it is — it is the record of who joined and when.
 */
export async function removeMember(userId: string, memberId: string): Promise<void> {
  const member = await prisma.familyMember.findFirst({
    where: { id: memberId, userId, status: 'active' },
    select: { id: true },
  });

  if (!member) {
    throw new FamilyError(404, 'member_not_found', 'That family member is not connected.');
  }

  await prisma.$transaction([
    prisma.familySession.deleteMany({ where: { familyMemberId: member.id } }),
    prisma.familyMember.update({
      where: { id: member.id },
      data: { status: 'revoked', revokedAt: new Date() },
    }),
  ]);
}
