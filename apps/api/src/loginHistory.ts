// Login history: one `LoginSession` row per sign-in, for patients, family members and doctors.
//
// The live session tables (`Session`, `FamilySession`, `SpecialistSession`) are unchanged in what
// they mean — a token that keeps someone signed in, deleted the moment it should stop working. This
// module is the record beside them. Every path that deletes a live session calls `endLoginSessions`
// first, with the reason, because after the delete there is nothing left to say which history row
// it belonged to.
//
// What is captured is what an "active devices" screen and a security review need — device, OS,
// browser, IP — and nothing a fingerprint would want. The device id is the random one the client
// already holds for push, not something derived from the browser.

import type { Request } from 'express';
import { prisma } from '@anuva/database';
import UAParser from 'ua-parser-js';

/** Mirrors the `LoginEndReason` enum in schema.prisma. */
export type LoginEndReason =
  | 'logout'
  | 'expired'
  | 'revoked_by_user'
  | 'admin_revoked'
  | 'password_changed'
  | 'member_revoked'
  | 'ended';

export type LoginMethod = 'otp' | 'email_beta' | 'password';

type LoginSessionWhere = NonNullable<Parameters<typeof prisma.loginSession.updateMany>[0]>['where'];

/** How long a full IP is kept before it is cut down to its network. Doctors default longer: their
 * sessions touch every patient's records, so an audit has more reason to look back. */
export const LOGIN_IP_RETENTION_DAYS = Math.max(
  1,
  Number(process.env.LOGIN_IP_RETENTION_DAYS || 90)
);
export const SPECIALIST_LOGIN_IP_RETENTION_DAYS = Math.max(
  LOGIN_IP_RETENTION_DAYS,
  Number(process.env.SPECIALIST_LOGIN_IP_RETENTION_DAYS || 365)
);

/** `lastSeenAt` is written at most this often per session, instead of on every request. */
export const LAST_SEEN_THROTTLE_MS = 5 * 60 * 1000;

const APP_PLATFORMS = new Set(['pwa', 'web', 'android', 'ios']);
const MAX_USER_AGENT = 512;
const MAX_FIELD = 64;
const DEVICE_ID_PATTERN = /^[A-Za-z0-9-]{8,64}$/;

export type LoginContext = {
  ipAddress: string | null;
  userAgent: string | null;
  deviceType: string | null;
  os: string | null;
  osVersion: string | null;
  browser: string | null;
  appPlatform: string | null;
  deviceId: string | null;
};

function clip(value: string | undefined | null, max = MAX_FIELD): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed.slice(0, max) : null;
}

function header(req: Request, name: string): string | undefined {
  const value = req.headers[name];
  return Array.isArray(value) ? value[0] : value;
}

/**
 * The client's address as Express resolved it. Only correct once `trust proxy` matches the
 * deployment — without it every row would hold the reverse proxy's address. IPv4-mapped IPv6
 * (`::ffff:1.2.3.4`) is unwrapped so the same client is stored the same way.
 */
export function clientIp(req: Request): string | null {
  const ip = req.ip || req.socket?.remoteAddress || '';
  return clip(ip.replace(/^::ffff:(?=\d+\.\d+\.\d+\.\d+$)/, ''), 64);
}

/** UA parsing on its own, so it can be tested without building a request. */
export function parseUserAgent(
  userAgent: string | null
): Pick<LoginContext, 'deviceType' | 'os' | 'osVersion' | 'browser'> {
  if (!userAgent) {
    return { deviceType: null, os: null, osVersion: null, browser: null };
  }

  const parsed = new UAParser(userAgent).getResult();
  // ua-parser leaves `device.type` undefined for desktops; it only names the ones that are not.
  const rawType = parsed.device.type;
  const deviceType =
    rawType === 'mobile' || rawType === 'tablet'
      ? rawType
      : rawType
        ? clip(rawType)
        : parsed.os.name
          ? 'desktop'
          : null;

  return {
    deviceType,
    os: clip(parsed.os.name),
    osVersion: clip(parsed.os.version),
    browser: clip(parsed.browser.name),
  };
}

export function loginContext(req: Request): LoginContext {
  const userAgent = clip(header(req, 'user-agent'), MAX_USER_AGENT);
  const platform = header(req, 'x-app-platform')?.trim().toLowerCase();
  const deviceId = header(req, 'x-device-id')?.trim();

  return {
    ipAddress: clientIp(req),
    userAgent,
    ...parseUserAgent(userAgent),
    appPlatform: platform && APP_PLATFORMS.has(platform) ? platform : null,
    deviceId: deviceId && DEVICE_ID_PATTERN.test(deviceId) ? deviceId : null,
  };
}

type Owner =
  | { principal: 'patient'; userId: string }
  | { principal: 'family'; familyMemberId: string }
  | { principal: 'specialist'; specialistId: string };

/**
 * The nested `create` for a live session's `loginSession` relation, so the live row and its history
 * row are written in one statement and cannot exist without each other. Prisma will not mix a
 * nested relation with scalar foreign keys on the same row, so the live session it goes into must
 * name its owner with `connect` rather than a bare id.
 */
export function loginSessionCreate(
  context: LoginContext,
  owner: Owner,
  method: LoginMethod,
  expiresAt: Date
) {
  return {
    create: {
      principal: owner.principal,
      method,
      expiresAt,
      ...context,
      lastSeenIp: context.ipAddress,
      userId: owner.principal === 'patient' ? owner.userId : null,
      familyMemberId: owner.principal === 'family' ? owner.familyMemberId : null,
      specialistId: owner.principal === 'specialist' ? owner.specialistId : null,
    },
  };
}

/**
 * Closes the history rows behind the live sessions about to be deleted. `where` filters history
 * rows, usually through the live relation (`{ liveSession: { is: { tokenHash } } }`). Only open rows
 * are touched, so the first reason recorded wins and a retried logout cannot overwrite it.
 */
export function endLoginSessions(
  where: LoginSessionWhere,
  reason: LoginEndReason,
  now: Date = new Date()
) {
  return prisma.loginSession.updateMany({
    where: { ...where, endedAt: null },
    data: { endedAt: now, endReason: reason },
  });
}

export function shouldTouch(lastSeenAt: Date, now: Date = new Date()): boolean {
  return now.getTime() - lastSeenAt.getTime() >= LAST_SEEN_THROTTLE_MS;
}

/**
 * Best-effort "still here" on the history row. The caller has already decided the throttle allows
 * it; a failure is swallowed because telemetry must never fail the request it rides on.
 */
export function touchLoginSession(loginSessionId: string | null, req: Request, now: Date): void {
  if (!loginSessionId) return;
  void prisma.loginSession
    .updateMany({
      // A row already truncated is not given a full address back.
      where: { id: loginSessionId, endedAt: null, ipTruncatedAt: null },
      data: { lastSeenAt: now, lastSeenIp: clientIp(req) },
    })
    .catch(() => undefined);
}

/**
 * Cuts an address down to its network: /24 for IPv4, /48 for IPv6. Enough to say "same city, same
 * ISP" in a security review a year later, not enough to name a household.
 */
export function truncateIp(ip: string | null): string | null {
  if (!ip) return null;

  const v4 = ip.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.\d{1,3}$/);
  if (v4) return `${v4[1]}.${v4[2]}.${v4[3]}.0/24`;

  if (ip.includes(':')) {
    const [head = ''] = ip.split('::');
    const groups = head.split(':').filter(Boolean).slice(0, 3);
    while (groups.length < 3) groups.push('0');
    return `${groups.join(':')}::/48`;
  }

  return null;
}

/**
 * Nothing deletes a live session when it simply lapses, so the history row behind it would stay
 * open for ever. This closes them: `expired` when the expiry has passed, `ended` when the live row
 * was removed by a path that did not record why. Also clears the lapsed live rows, which no path
 * cleans up on its own.
 */
export async function closeLapsedLoginSessions(now: Date = new Date()): Promise<number> {
  const expired = await endLoginSessions({ expiresAt: { lte: now } }, 'expired', now);

  const orphaned = await endLoginSessions(
    {
      expiresAt: { gt: now },
      liveSession: { is: null },
      liveFamilySession: { is: null },
      liveSpecialistSession: { is: null },
    },
    'ended',
    now
  );

  await prisma.$transaction([
    prisma.session.deleteMany({ where: { expiresAt: { lte: now } } }),
    prisma.familySession.deleteMany({ where: { expiresAt: { lte: now } } }),
    prisma.specialistSession.deleteMany({ where: { expiresAt: { lte: now } } }),
  ]);

  return expired.count + orphaned.count;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Truncates IPs once a sign-in has been idle past its retention, in batches. Measured from
 * `lastSeenAt`, not `startedAt`, so a session still in use is never cut down under itself.
 * Idempotent: a row is stamped once it is done.
 */
export async function truncateExpiredLoginIps(now: Date = new Date()): Promise<number> {
  const patientCutoff = new Date(now.getTime() - LOGIN_IP_RETENTION_DAYS * DAY_MS);
  const specialistCutoff = new Date(now.getTime() - SPECIALIST_LOGIN_IP_RETENTION_DAYS * DAY_MS);

  let truncated = 0;

  for (;;) {
    const due = await prisma.loginSession.findMany({
      where: {
        ipTruncatedAt: null,
        OR: [
          { principal: { in: ['patient', 'family'] }, lastSeenAt: { lte: patientCutoff } },
          { principal: 'specialist', lastSeenAt: { lte: specialistCutoff } },
        ],
      },
      select: { id: true, ipAddress: true, lastSeenIp: true },
      take: 500,
    });

    if (due.length === 0) break;

    await prisma.$transaction(
      due.map((row) =>
        prisma.loginSession.update({
          where: { id: row.id },
          data: {
            ipAddress: truncateIp(row.ipAddress),
            lastSeenIp: truncateIp(row.lastSeenIp),
            ipTruncatedAt: now,
          },
        })
      )
    );

    truncated += due.length;
    if (due.length < 500) break;
  }

  return truncated;
}
