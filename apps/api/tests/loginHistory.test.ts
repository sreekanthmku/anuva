/**
 * Login history: what is captured at sign-in, how a sign-in is closed, and the two sweeps that keep
 * the table honest (closing lapsed sign-ins, cutting old IPs down to their network).
 *
 * Prisma is mocked: these pin the queries each function sends, which is where the rules live —
 * "only open rows", "a truncated row never gets a full IP back", "idle time, not age".
 */

import type { Request } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const loginSession = {
  updateMany: vi.fn(),
  findMany: vi.fn(),
  update: vi.fn(),
};
const deleteMany = vi.fn();
const prisma = {
  loginSession,
  session: { deleteMany },
  familySession: { deleteMany },
  specialistSession: { deleteMany },
  $transaction: vi.fn(async (ops: unknown[]) => Promise.all(ops)),
};

vi.mock('@anuva/database', () => ({ prisma }));

const {
  LAST_SEEN_THROTTLE_MS,
  LOGIN_IP_RETENTION_DAYS,
  SPECIALIST_LOGIN_IP_RETENTION_DAYS,
  clientIp,
  closeLapsedLoginSessions,
  endLoginSessions,
  loginContext,
  loginSessionCreate,
  parseUserAgent,
  shouldTouch,
  touchLoginSession,
  truncateExpiredLoginIps,
  truncateIp,
} = await import('../src/loginHistory.js');

const ANDROID_CHROME =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36';
const IPHONE_SAFARI =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const MAC_FIREFOX =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14.5; rv:127.0) Gecko/20100101 Firefox/127.0';

function fakeRequest(headers: Record<string, string>, ip = '203.0.113.42'): Request {
  return { headers, ip, socket: { remoteAddress: '10.0.0.1' } } as unknown as Request;
}

const NOW = new Date('2026-10-08T10:00:00Z');
const DAY = 24 * 60 * 60 * 1000;

beforeEach(() => {
  vi.clearAllMocks();
  loginSession.updateMany.mockResolvedValue({ count: 0 });
  loginSession.findMany.mockResolvedValue([]);
  loginSession.update.mockImplementation(async (args: unknown) => args);
  deleteMany.mockResolvedValue({ count: 0 });
});

describe('parseUserAgent', () => {
  it('reads a phone as mobile, with its OS and browser', () => {
    expect(parseUserAgent(ANDROID_CHROME)).toEqual({
      deviceType: 'mobile',
      os: 'Android',
      osVersion: '14',
      browser: 'Chrome',
    });
    expect(parseUserAgent(IPHONE_SAFARI)).toMatchObject({ deviceType: 'mobile', os: 'iOS' });
  });

  it('calls a recognised OS with no device type a desktop', () => {
    expect(parseUserAgent(MAC_FIREFOX)).toMatchObject({
      deviceType: 'desktop',
      os: 'Mac OS',
      browser: 'Firefox',
    });
  });

  it('records nothing rather than guessing when there is no user agent, or an unreadable one', () => {
    expect(parseUserAgent(null)).toEqual({
      deviceType: null,
      os: null,
      osVersion: null,
      browser: null,
    });
    expect(parseUserAgent('curl/8.6.0').deviceType).toBeNull();
  });
});

describe('loginContext', () => {
  it('takes the platform and device id from the client headers', () => {
    const context = loginContext(
      fakeRequest({
        'user-agent': ANDROID_CHROME,
        'x-app-platform': 'PWA',
        'x-device-id': '6f1c2a90-5b1e-4c2e-9d55-0b6f7e1d2c3a',
      })
    );
    expect(context).toMatchObject({
      ipAddress: '203.0.113.42',
      appPlatform: 'pwa',
      deviceId: '6f1c2a90-5b1e-4c2e-9d55-0b6f7e1d2c3a',
      os: 'Android',
    });
  });

  it('drops a platform it does not know and a device id that is not an id', () => {
    const context = loginContext(
      fakeRequest({ 'x-app-platform': 'windows-phone', 'x-device-id': '<script>' })
    );
    expect(context.appPlatform).toBeNull();
    expect(context.deviceId).toBeNull();
  });

  it('caps an absurd user agent instead of storing all of it', () => {
    const context = loginContext(fakeRequest({ 'user-agent': 'x'.repeat(5000) }));
    expect(context.userAgent).toHaveLength(512);
  });
});

describe('clientIp', () => {
  it('unwraps an IPv4-mapped IPv6 address', () => {
    expect(clientIp(fakeRequest({}, '::ffff:198.51.100.7'))).toBe('198.51.100.7');
  });

  it('falls back to the socket when Express has no ip', () => {
    expect(clientIp(fakeRequest({}, ''))).toBe('10.0.0.1');
  });
});

describe('loginSessionCreate', () => {
  const context = loginContext(fakeRequest({ 'user-agent': ANDROID_CHROME }));
  const expiresAt = new Date(NOW.getTime() + 30 * DAY);

  it('names exactly one owner, matching the principal', () => {
    expect(
      loginSessionCreate(context, { principal: 'patient', userId: 'u1' }, 'otp', expiresAt).create
    ).toMatchObject({
      principal: 'patient',
      userId: 'u1',
      familyMemberId: null,
      specialistId: null,
    });
    expect(
      loginSessionCreate(context, { principal: 'family', familyMemberId: 'f1' }, 'otp', expiresAt)
        .create
    ).toMatchObject({
      principal: 'family',
      userId: null,
      familyMemberId: 'f1',
      specialistId: null,
    });
    expect(
      loginSessionCreate(
        context,
        { principal: 'specialist', specialistId: 's1' },
        'password',
        expiresAt
      ).create
    ).toMatchObject({
      principal: 'specialist',
      userId: null,
      familyMemberId: null,
      specialistId: 's1',
    });
  });

  it('starts lastSeenIp at the sign-in address', () => {
    const { create } = loginSessionCreate(
      context,
      { principal: 'patient', userId: 'u1' },
      'otp',
      expiresAt
    );
    expect(create.lastSeenIp).toBe(create.ipAddress);
    expect(create.expiresAt).toBe(expiresAt);
  });
});

describe('endLoginSessions', () => {
  it('closes only rows that are still open, so the first reason recorded wins', async () => {
    await endLoginSessions({ liveSession: { is: { tokenHash: 'h' } } }, 'logout', NOW);
    expect(loginSession.updateMany).toHaveBeenCalledWith({
      where: { liveSession: { is: { tokenHash: 'h' } }, endedAt: null },
      data: { endedAt: NOW, endReason: 'logout' },
    });
  });
});

describe('shouldTouch and touchLoginSession', () => {
  it('writes at most once per throttle window', () => {
    expect(shouldTouch(new Date(NOW.getTime() - 1000), NOW)).toBe(false);
    expect(shouldTouch(new Date(NOW.getTime() - LAST_SEEN_THROTTLE_MS), NOW)).toBe(true);
  });

  it('never gives a truncated or ended row a full address back', () => {
    touchLoginSession('ls1', fakeRequest({}), NOW);
    expect(loginSession.updateMany).toHaveBeenCalledWith({
      where: { id: 'ls1', endedAt: null, ipTruncatedAt: null },
      data: { lastSeenAt: NOW, lastSeenIp: '203.0.113.42' },
    });
  });

  it('does nothing for a session from before login history existed', () => {
    touchLoginSession(null, fakeRequest({}), NOW);
    expect(loginSession.updateMany).not.toHaveBeenCalled();
  });
});

describe('truncateIp', () => {
  it('keeps the /24 of an IPv4 address', () => {
    expect(truncateIp('203.0.113.42')).toBe('203.0.113.0/24');
  });

  it('keeps the /48 of an IPv6 address, compressed or not', () => {
    expect(truncateIp('2001:db8:85a3:8d3:1319:8a2e:370:7348')).toBe('2001:db8:85a3::/48');
    expect(truncateIp('2001:db8::1')).toBe('2001:db8:0::/48');
  });

  it('passes null through and refuses to keep something it cannot parse', () => {
    expect(truncateIp(null)).toBeNull();
    expect(truncateIp('not-an-ip')).toBeNull();
  });
});

describe('closeLapsedLoginSessions', () => {
  it('closes expired sign-ins as expired, and orphaned live ones as ended', async () => {
    loginSession.updateMany.mockResolvedValueOnce({ count: 3 }).mockResolvedValueOnce({ count: 1 });

    expect(await closeLapsedLoginSessions(NOW)).toBe(4);

    expect(loginSession.updateMany).toHaveBeenNthCalledWith(1, {
      where: { expiresAt: { lte: NOW }, endedAt: null },
      data: { endedAt: NOW, endReason: 'expired' },
    });
    expect(loginSession.updateMany).toHaveBeenNthCalledWith(2, {
      where: {
        expiresAt: { gt: NOW },
        liveSession: { is: null },
        liveFamilySession: { is: null },
        liveSpecialistSession: { is: null },
        endedAt: null,
      },
      data: { endedAt: NOW, endReason: 'ended' },
    });
  });

  it('clears lapsed live sessions of all three kinds', async () => {
    await closeLapsedLoginSessions(NOW);
    expect(deleteMany).toHaveBeenCalledTimes(3);
    for (const call of deleteMany.mock.calls) {
      expect(call[0]).toEqual({ where: { expiresAt: { lte: NOW } } });
    }
  });
});

describe('truncateExpiredLoginIps', () => {
  it('measures retention from last use, with the longer window for doctors', async () => {
    await truncateExpiredLoginIps(NOW);

    expect(loginSession.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          ipTruncatedAt: null,
          OR: [
            {
              principal: { in: ['patient', 'family'] },
              lastSeenAt: { lte: new Date(NOW.getTime() - LOGIN_IP_RETENTION_DAYS * DAY) },
            },
            {
              principal: 'specialist',
              lastSeenAt: {
                lte: new Date(NOW.getTime() - SPECIALIST_LOGIN_IP_RETENTION_DAYS * DAY),
              },
            },
          ],
        },
      })
    );
  });

  it('cuts both addresses down and stamps the row so it is not done twice', async () => {
    loginSession.findMany.mockResolvedValueOnce([
      { id: 'a', ipAddress: '203.0.113.42', lastSeenIp: '198.51.100.7' },
      { id: 'b', ipAddress: null, lastSeenIp: null },
    ]);

    expect(await truncateExpiredLoginIps(NOW)).toBe(2);
    expect(loginSession.update).toHaveBeenCalledWith({
      where: { id: 'a' },
      data: { ipAddress: '203.0.113.0/24', lastSeenIp: '198.51.100.0/24', ipTruncatedAt: NOW },
    });
    expect(loginSession.update).toHaveBeenCalledWith({
      where: { id: 'b' },
      data: { ipAddress: null, lastSeenIp: null, ipTruncatedAt: NOW },
    });
  });
});
