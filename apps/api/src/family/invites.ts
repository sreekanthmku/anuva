import crypto from 'node:crypto';
import { prisma } from '@anuva/database';
import {
  FAMILY_CORE_SHARING_CONSENT_VERSION,
  FAMILY_EMERGENCY_ALERTS_CONSENT_VERSION,
  FAMILY_PERIOD_SHARING_CONSENT_VERSION,
  type FamilyGate,
  type FamilyInvite,
  type FamilyMemberDeparture,
  type FamilyMemberSummary,
  type FamilyStatusResponse,
} from '@anuva/shared';
import {
  FAMILY_CONSENT_VERSION,
  FAMILY_INVITE_TTL_DAYS,
  FAMILY_REPROMPT_MINUTES,
} from './config.js';
import { FamilyError } from './errors.js';
import { familySharedScopes } from './content.js';
import { endLoginSessions } from '../loginHistory.js';
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
  sharePeriod: boolean;
  coreSharingVersion: string | null;
  shareEmergency: boolean;
};

type MemberRow = {
  id: string;
  name: string;
  relationship: 'partner' | 'child' | 'parent' | 'sibling' | 'friend' | 'other';
  phone: string;
  createdAt: Date;
  lastSeenAt: Date;
  periodSharing: boolean;
  emergencyAlerts: boolean;
};

const INVITE_SELECT = {
  id: true,
  expiresAt: true,
  sharedAt: true,
  shareCount: true,
  sharePeriod: true,
  coreSharingVersion: true,
  shareEmergency: true,
} as const;

const MEMBER_SELECT = {
  id: true,
  name: true,
  relationship: true,
  phone: true,
  createdAt: true,
  lastSeenAt: true,
  periodSharing: true,
  emergencyAlerts: true,
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
    sharePeriod: row.sharePeriod,
    coreSharing: row.coreSharingVersion !== null,
    shareEmergency: row.shareEmergency,
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
 * There is no cap: she may invite as many people as she likes. Each member already holds their own
 * session, push devices and nudge ledger, so another member changes nothing downstream. Newest
 * first because the most recent joiner is the one she is most likely to be looking for, and because
 * the patient PWA's older single-slot `member` field is served from the head of it.
 */
function activeMembers(userId: string) {
  return prisma.familyMember.findMany({
    where: { userId, status: 'active' },
    select: MEMBER_SELECT,
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * Everyone who chose to leave her, newest first, with whether she has dismissed the notice yet.
 * Read for the gate as well as the notice: someone who joined and later left still got her past her
 * first share, and being made to share again because someone else walked away would be unkind.
 */
function departedMembers(userId: string) {
  return prisma.familyMember.findMany({
    where: { userId, status: 'revoked', endedBy: 'member' },
    select: { id: true, name: true, relationship: true, revokedAt: true, emergencyAlerts: true, departureSeenAt: true },
    orderBy: { revokedAt: 'desc' },
  });
}

type DepartedRow = Awaited<ReturnType<typeof departedMembers>>[number];

function serializeDeparture(member: DepartedRow): FamilyMemberDeparture {
  return {
    id: member.id,
    name: member.name,
    relationship: member.relationship,
    leftAt: (member.revokedAt ?? new Date(0)).toISOString(),
    wasEmergencyContact: member.emergencyAlerts,
  };
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
  const [members, departed] = await Promise.all([activeMembers(userId), departedMembers(userId)]);

  // There is always a link to invite one more person with — except for a woman who opted out, for
  // whom minting one would be pointless work and a pointless secret.
  const invite = user.familyFeatureOptOut ? null : await ensurePendingInvite(userId, now);

  return buildStatus(user, members, departed, invite, now);
}

function serializeMember(member: MemberRow): FamilyMemberSummary {
  return {
    id: member.id,
    name: member.name,
    relationship: member.relationship,
    maskedPhone: maskPhone(member.phone),
    joinedAt: member.createdAt.toISOString(),
    lastSeenAt: member.lastSeenAt.toISOString(),
    periodSharing: member.periodSharing,
    emergencyAlerts: member.emergencyAlerts,
  };
}

function buildStatus(
  user: { name: string | null; onboardingCompleted: boolean; familyFeatureOptOut: boolean },
  members: MemberRow[],
  departed: DepartedRow[],
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
        hasMember: members.length > 0 || departed.length > 0,
        sharedAt: invite?.sharedAt ?? null,
      },
      now,
    ),
    invite: invite ? withShareMessage(serializeInvite(invite), firstName) : null,
    member: serialized[0] ?? null,
    members: serialized,
    departures: departed.filter((member) => !member.departureSeenAt).map(serializeDeparture),
    optedOut: user.familyFeatureOptOut,
    // The minimum only: the optional extras are switches of their own, each with its own notice.
    sharedByDefault: familySharedScopes(),
  };
}

/**
 * A fresh link, replacing any pending one. The new invite has no `sharedAt`, so the gate opens
 * immediately — correct, because a link she has not sent anywhere cannot count as shared.
 */
export async function rotateInvite(userId: string): Promise<FamilyInvite> {
  const now = new Date();
  const user = await loadUser(userId);

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
    select: { id: true, status: true, expiresAt: true, coreSharingVersion: true },
  });

  if (!invite) {
    throw new FamilyError(404, 'invite_not_found', 'That invite no longer exists.');
  }

  if (invite.status !== 'pending' || invite.expiresAt <= now) {
    throw new FamilyError(410, 'invite_stale', 'That link is no longer valid. Get a new one.');
  }

  // The gate cannot be passed by sending a link she has not agreed to share through.
  if (!invite.coreSharingVersion) {
    throw new FamilyError(409, 'core_consent_required', 'Agree to what they will see before you send the link.');
  }

  const updated = await prisma.familyInvite.update({
    where: { id: invite.id },
    data: { sharedAt: now, shareCount: { increment: 1 } },
    select: INVITE_SELECT,
  });

  const [members, departed] = await Promise.all([activeMembers(userId), departedMembers(userId)]);

  return {
    gate: computeGate(
      {
        optedOut: user.familyFeatureOptOut,
        onboardingCompleted: user.onboardingCompleted,
        hasMember: members.length > 0 || departed.length > 0,
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
 * Ending a membership, whichever side ends it, drops their sessions immediately, so access ends on
 * their next request rather than whenever their cookie happens to expire. The accepted invite row is
 * left as it is — it is the record of who joined and when.
 *
 * Only an active membership is ended, and the status check is part of the write, so two taps (or her
 * removing them as they leave) cannot both count. Returns whether this call ended it.
 */
export async function endMembership(memberId: string, endedBy: 'patient' | 'member'): Promise<boolean> {
  const [, , ended] = await prisma.$transaction([
    endLoginSessions({ familyMemberId: memberId }, endedBy === 'patient' ? 'member_revoked' : 'member_left'),
    prisma.familySession.deleteMany({ where: { familyMemberId: memberId } }),
    prisma.familyMember.updateMany({
      where: { id: memberId, status: 'active' },
      data: {
        status: 'revoked',
        revokedAt: new Date(),
        endedBy,
        // Nothing outstanding should follow them out: no reminder, no half-finished gesture.
        supportRemindAt: null,
        pendingActionKind: null,
        pendingActionAt: null,
      },
    }),
  ]);
  return ended.count > 0;
}

export async function removeMember(userId: string, memberId: string): Promise<void> {
  const member = await prisma.familyMember.findFirst({
    where: { id: memberId, userId, status: 'active' },
    select: { id: true },
  });

  if (!member || !(await endMembership(member.id, 'patient'))) {
    throw new FamilyError(404, 'member_not_found', 'That family member is not connected.');
  }
}

/** She has seen that they left. Only her own departures, and only ones that were their choice. */
export async function dismissDeparture(userId: string, memberId: string): Promise<void> {
  const { count } = await prisma.familyMember.updateMany({
    where: { id: memberId, userId, endedBy: 'member', departureSeenAt: null },
    data: { departureSeenAt: new Date() },
  });
  if (count === 0) {
    throw new FamilyError(404, 'member_not_found', 'That family member is not connected.');
  }
}

// ─────────────────────────────────────────────
// Period sharing — her choice, per link and per person
// ─────────────────────────────────────────────

/** Turning it on needs the notice she just read; turning it off needs nothing. */
function assertPeriodConsent(enabled: boolean, consentTextVersion: string | undefined): void {
  if (enabled && consentTextVersion !== FAMILY_PERIOD_SHARING_CONSENT_VERSION) {
    throw new FamilyError(
      409,
      'consent_outdated',
      'The wording about sharing your period has changed. Please read it again.',
    );
  }
}

/**
 * Whether whoever claims her pending link will also see her period updates. Only a pending link:
 * once someone has joined, the choice lives on them and is changed with `setMemberPeriodSharing`.
 */
export async function setInvitePeriodSharing(
  userId: string,
  inviteId: string,
  input: { enabled: boolean; consentTextVersion?: string },
): Promise<FamilyInvite> {
  assertPeriodConsent(input.enabled, input.consentTextVersion);
  const version = input.enabled ? FAMILY_PERIOD_SHARING_CONSENT_VERSION : null;
  return updateInviteChoice(userId, inviteId, 'period', input.enabled, version, {
    sharePeriod: input.enabled,
    periodSharingVersion: version,
  });
}

/**
 * Her agreement to the minimum sharing on her pending link. Required before the link can be sent or
 * claimed. She may untick it again before anyone joins, which makes the link unusable until she
 * ticks it again; once someone has joined it lives on them and ends only when she disconnects them.
 */
export async function setInviteCoreSharing(
  userId: string,
  inviteId: string,
  input: { enabled: boolean; consentTextVersion?: string },
): Promise<FamilyInvite> {
  if (input.enabled && input.consentTextVersion !== FAMILY_CORE_SHARING_CONSENT_VERSION) {
    throw new FamilyError(409, 'consent_outdated', 'What family members see has changed. Please read it again.');
  }
  const version = input.enabled ? FAMILY_CORE_SHARING_CONSENT_VERSION : null;
  return updateInviteChoice(userId, inviteId, 'core', input.enabled, version, { coreSharingVersion: version });
}

/** Whether whoever claims her pending link is also alerted in an emergency. Copied onto them at claim. */
export async function setInviteEmergencyAlerts(
  userId: string,
  inviteId: string,
  input: { enabled: boolean; consentTextVersion?: string },
): Promise<FamilyInvite> {
  assertEmergencyConsent(input.enabled, input.consentTextVersion);
  const version = input.enabled ? FAMILY_EMERGENCY_ALERTS_CONSENT_VERSION : null;
  return updateInviteChoice(userId, inviteId, 'emergency', input.enabled, version, {
    shareEmergency: input.enabled,
    emergencyAlertsVersion: version,
  });
}

/**
 * One choice on her pending link, written with its consent record in one transaction. Only a
 * pending link: once someone has joined, the choice lives on them.
 */
async function updateInviteChoice(
  userId: string,
  inviteId: string,
  scope: 'core' | 'period' | 'emergency',
  granted: boolean,
  textVersion: string | null,
  data: {
    coreSharingVersion?: string | null;
    sharePeriod?: boolean;
    periodSharingVersion?: string | null;
    shareEmergency?: boolean;
    emergencyAlertsVersion?: string | null;
  },
): Promise<FamilyInvite> {
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

  const [updated] = await prisma.$transaction([
    prisma.familyInvite.update({ where: { id: invite.id }, data, select: INVITE_SELECT }),
    prisma.familyShareConsent.create({
      data: { userId, inviteId: invite.id, scope, granted, textVersion },
    }),
  ]);

  return withShareMessage(serializeInvite(updated), firstNameOf(user.name));
}

/**
 * Turns period sharing on or off for one connected person. Their app reads the flag on every
 * request, so turning it off takes the card away on their next refresh, not at some later sync.
 */
export async function setMemberPeriodSharing(
  userId: string,
  memberId: string,
  input: { enabled: boolean; consentTextVersion?: string },
): Promise<FamilyMemberSummary> {
  assertPeriodConsent(input.enabled, input.consentTextVersion);

  const member = await prisma.familyMember.findFirst({
    where: { id: memberId, userId, status: 'active' },
    select: { id: true },
  });
  if (!member) {
    throw new FamilyError(404, 'member_not_found', 'That family member is not connected.');
  }

  const version = input.enabled ? FAMILY_PERIOD_SHARING_CONSENT_VERSION : null;
  const [updated] = await prisma.$transaction([
    prisma.familyMember.update({
      where: { id: member.id },
      data: { periodSharing: input.enabled, periodSharingVersion: version, periodSharingChangedAt: new Date() },
      select: MEMBER_SELECT,
    }),
    prisma.familyShareConsent.create({
      data: { userId, memberId: member.id, scope: 'period', granted: input.enabled, textVersion: version },
    }),
  ]);

  return serializeMember(updated);
}

// ─────────────────────────────────────────────
// Emergency alerts — her choice, per link and per person
// ─────────────────────────────────────────────

function assertEmergencyConsent(enabled: boolean, consentTextVersion: string | undefined): void {
  if (enabled && consentTextVersion !== FAMILY_EMERGENCY_ALERTS_CONSENT_VERSION) {
    throw new FamilyError(
      409,
      'consent_outdated',
      'The wording about emergency alerts has changed. Please read it again.',
    );
  }
}

/**
 * Turns emergency alerts on or off for one connected person. Read when an alert is sent, so turning
 * it off applies to the very next one.
 */
export async function setMemberEmergencyAlerts(
  userId: string,
  memberId: string,
  input: { enabled: boolean; consentTextVersion?: string },
): Promise<FamilyMemberSummary> {
  assertEmergencyConsent(input.enabled, input.consentTextVersion);

  const member = await prisma.familyMember.findFirst({
    where: { id: memberId, userId, status: 'active' },
    select: { id: true },
  });
  if (!member) {
    throw new FamilyError(404, 'member_not_found', 'That family member is not connected.');
  }

  const version = input.enabled ? FAMILY_EMERGENCY_ALERTS_CONSENT_VERSION : null;
  const [updated] = await prisma.$transaction([
    prisma.familyMember.update({
      where: { id: member.id },
      data: { emergencyAlerts: input.enabled, emergencyAlertsVersion: version, emergencyAlertsChangedAt: new Date() },
      select: MEMBER_SELECT,
    }),
    prisma.familyShareConsent.create({
      data: { userId, memberId: member.id, scope: 'emergency', granted: input.enabled, textVersion: version },
    }),
  ]);

  return serializeMember(updated);
}
