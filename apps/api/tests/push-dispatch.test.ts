/**
 * The transport switch, and the two things it must never get wrong: notifying somebody twice
 * because their device is registered both ways, and dropping a live subscription because one send
 * failed.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const fcmToken = { findMany: vi.fn() };
const webPushSubscription = { findMany: vi.fn(), deleteMany: vi.fn() };
const familyFcmToken = { findMany: vi.fn() };
const familyWebPushSubscription = { findMany: vi.fn(), deleteMany: vi.fn() };
const specialistFcmToken = { findMany: vi.fn() };
const specialistWebPushSubscription = { findMany: vi.fn(), deleteMany: vi.fn() };
const familyMember = { findUnique: vi.fn(), findMany: vi.fn() };

vi.mock('@anuva/database', () => ({
  prisma: {
    fcmToken,
    webPushSubscription,
    familyFcmToken,
    familyWebPushSubscription,
    specialistFcmToken,
    specialistWebPushSubscription,
    familyMember,
  },
}));

const sendPushToAllTokens = vi.fn();
vi.mock('../src/fcm.js', () => ({ sendPushToAllTokens }));

const sendWebPush = vi.fn();
vi.mock('../src/push/webPush.js', () => ({ sendWebPush }));

const { countDevices, hasReachableDevice, sendToAudience, withoutDuplicateDevices } = await import(
  '../src/push/dispatch.js'
);

const NOTIFICATION = { title: 'She says thank you', body: 'It landed.' };

function subscription(endpoint: string, deviceId: string | null) {
  return { id: endpoint, endpoint, p256dh: 'p', auth: 'a', deviceId };
}

beforeEach(() => {
  for (const model of [fcmToken, familyFcmToken, specialistFcmToken]) {
    model.findMany.mockReset().mockResolvedValue([]);
  }
  for (const model of [webPushSubscription, familyWebPushSubscription, specialistWebPushSubscription]) {
    model.findMany.mockReset().mockResolvedValue([]);
    model.deleteMany.mockReset().mockResolvedValue({ count: 0 });
  }
  familyMember.findUnique.mockReset().mockResolvedValue(null);
  familyMember.findMany.mockReset().mockResolvedValue([]);
  sendPushToAllTokens.mockReset().mockResolvedValue({ successCount: 1, failureCount: 0 });
  sendWebPush.mockReset().mockResolvedValue({ successCount: 1, failureCount: 0, goneEndpoints: [] });
});

afterEach(() => {
  delete process.env.PUSH_PROVIDER;
});

describe('hasReachableDevice', () => {
  const active = { some: { status: 'ACTIVE' } };

  // The scheduled jobs pick recipients with this. Asking for FCM tokens alone left everyone who
  // registered after the move to Web Push without nudges.
  it('picks Web Push subscribers on webpush', () => {
    expect(hasReachableDevice('webpush')).toEqual({ OR: [{ webPushSubscriptions: active }] });
  });

  it('picks FCM token holders on fcm', () => {
    expect(hasReachableDevice('fcm')).toEqual({ OR: [{ fcmTokens: active }] });
  });

  it('picks either on both', () => {
    expect(hasReachableDevice('both')).toEqual({
      OR: [{ fcmTokens: active }, { webPushSubscriptions: active }],
    });
  });
});

describe('withoutDuplicateDevices', () => {
  it('drops the FCM token of a device that is also subscribed the newer way', () => {
    const tokens = [
      { token: 'her-phone', deviceId: 'device-1' },
      { token: 'her-tablet', deviceId: 'device-2' },
    ];
    expect(withoutDuplicateDevices(tokens, [subscription('https://push/1', 'device-1')])).toEqual([
      { token: 'her-tablet', deviceId: 'device-2' },
    ]);
  });

  it('keeps a token whose device cannot be identified', () => {
    // A duplicate notification is a smaller failure than a silent one.
    const tokens = [{ token: 'old-token', deviceId: null }];
    expect(withoutDuplicateDevices(tokens, [subscription('https://push/1', 'device-1')])).toEqual(tokens);
  });

  it('changes nothing when there are no subscriptions', () => {
    const tokens = [{ token: 'her-phone', deviceId: 'device-1' }];
    expect(withoutDuplicateDevices(tokens, [])).toEqual(tokens);
  });
});

describe('sendToAudience', () => {
  it('sends over FCM only, and does not read subscriptions, when the provider is fcm', async () => {
    process.env.PUSH_PROVIDER = 'fcm';
    fcmToken.findMany.mockResolvedValue([{ token: 'her-phone', deviceId: 'device-1' }]);

    await sendToAudience({ kind: 'user', userId: 'user-1' }, NOTIFICATION);

    expect(sendPushToAllTokens).toHaveBeenCalledWith(['her-phone'], NOTIFICATION, undefined);
    expect(sendWebPush).not.toHaveBeenCalled();
    expect(webPushSubscription.findMany).not.toHaveBeenCalled();
  });

  it('sends over Web Push only, and does not read tokens, when the provider is webpush', async () => {
    process.env.PUSH_PROVIDER = 'webpush';
    webPushSubscription.findMany.mockResolvedValue([subscription('https://push/1', 'device-1')]);

    await sendToAudience({ kind: 'user', userId: 'user-1' }, NOTIFICATION);

    expect(sendWebPush).toHaveBeenCalledTimes(1);
    expect(sendPushToAllTokens).not.toHaveBeenCalled();
    expect(fcmToken.findMany).not.toHaveBeenCalled();
  });

  it('notifies a doubly-registered device once when the provider is both', async () => {
    process.env.PUSH_PROVIDER = 'both';
    fcmToken.findMany.mockResolvedValue([{ token: 'her-phone', deviceId: 'device-1' }]);
    webPushSubscription.findMany.mockResolvedValue([subscription('https://push/1', 'device-1')]);

    await sendToAudience({ kind: 'user', userId: 'user-1' }, NOTIFICATION);

    expect(sendPushToAllTokens).not.toHaveBeenCalled();
    expect(sendWebPush).toHaveBeenCalledTimes(1);
  });

  it('still reaches a device that has only registered the old way, on both', async () => {
    process.env.PUSH_PROVIDER = 'both';
    fcmToken.findMany.mockResolvedValue([{ token: 'old-phone', deviceId: 'device-9' }]);
    webPushSubscription.findMany.mockResolvedValue([subscription('https://push/1', 'device-1')]);

    await sendToAudience({ kind: 'user', userId: 'user-1' }, NOTIFICATION);

    expect(sendPushToAllTokens).toHaveBeenCalledWith(['old-phone'], NOTIFICATION, undefined);
    expect(sendWebPush).toHaveBeenCalledTimes(1);
  });

  it('deletes subscriptions the push service says are gone', async () => {
    process.env.PUSH_PROVIDER = 'webpush';
    webPushSubscription.findMany.mockResolvedValue([subscription('https://push/dead', 'device-1')]);
    sendWebPush.mockResolvedValue({
      successCount: 0,
      failureCount: 1,
      goneEndpoints: ['https://push/dead'],
    });

    await sendToAudience({ kind: 'user', userId: 'user-1' }, NOTIFICATION);

    expect(webPushSubscription.deleteMany).toHaveBeenCalledWith({
      where: { endpoint: { in: ['https://push/dead'] } },
    });
  });

  it('keeps a subscription that merely failed to deliver', async () => {
    process.env.PUSH_PROVIDER = 'webpush';
    webPushSubscription.findMany.mockResolvedValue([subscription('https://push/1', 'device-1')]);
    sendWebPush.mockResolvedValue({ successCount: 0, failureCount: 1, goneEndpoints: [] });

    await sendToAudience({ kind: 'user', userId: 'user-1' }, NOTIFICATION);

    expect(webPushSubscription.deleteMany).not.toHaveBeenCalled();
  });

  it('routes each audience to its own tables', async () => {
    process.env.PUSH_PROVIDER = 'both';
    await sendToAudience({ kind: 'familyMember', familyMemberId: 'member-1' }, NOTIFICATION);
    expect(familyFcmToken.findMany).toHaveBeenCalled();
    expect(familyWebPushSubscription.findMany).toHaveBeenCalled();

    await sendToAudience({ kind: 'specialist', specialistId: 'doctor-1' }, NOTIFICATION);
    expect(specialistFcmToken.findMany).toHaveBeenCalled();
    expect(specialistWebPushSubscription.findMany).toHaveBeenCalled();
  });

  it('reaches a family member on devices registered under their other memberships on the same phone', async () => {
    process.env.PUSH_PROVIDER = 'both';
    familyMember.findUnique.mockResolvedValue({ phone: '+919800000001' });
    familyMember.findMany.mockResolvedValue([{ id: 'member-1' }, { id: 'member-2' }]);

    await sendToAudience({ kind: 'familyMember', familyMemberId: 'member-1' }, NOTIFICATION);

    expect(familyMember.findMany.mock.calls[0]![0].where).toEqual({ phone: '+919800000001', status: 'active' });
    expect(familyFcmToken.findMany.mock.calls[0]![0].where).toEqual({
      familyMemberId: { in: ['member-1', 'member-2'] },
      status: 'ACTIVE',
    });
    expect(familyWebPushSubscription.findMany.mock.calls[0]![0].where).toEqual({
      familyMemberId: { in: ['member-1', 'member-2'] },
      status: 'ACTIVE',
    });
  });

  it('never throws: a failed notification must not fail the action that triggered it', async () => {
    process.env.PUSH_PROVIDER = 'fcm';
    fcmToken.findMany.mockRejectedValue(new Error('database is down'));

    await expect(sendToAudience({ kind: 'user', userId: 'user-1' }, NOTIFICATION)).resolves.toEqual({
      successCount: 0,
      failureCount: 0,
    });
  });
});

describe('countDevices', () => {
  it('counts a doubly-registered device once', async () => {
    process.env.PUSH_PROVIDER = 'both';
    fcmToken.findMany.mockResolvedValue([{ token: 'her-phone', deviceId: 'device-1' }]);
    webPushSubscription.findMany.mockResolvedValue([subscription('https://push/1', 'device-1')]);

    await expect(countDevices({ kind: 'user', userId: 'user-1' })).resolves.toBe(1);
  });

  it('reports none when she has no devices', async () => {
    process.env.PUSH_PROVIDER = 'both';
    await expect(countDevices({ kind: 'user', userId: 'user-1' })).resolves.toBe(0);
  });
});

describe('withAccount', async () => {
  const { withAccount } = await import('../src/family/push.js');

  it('names the membership in the fragment, keeping whatever the link already carried', () => {
    expect(withAccount({ url: '/' }, 'member-2').url).toBe('/#as=member-2');
    expect(withAccount({ url: '/learn' }, 'member-2').url).toBe('/learn#as=member-2');
    expect(withAccount({ url: '/#familyThanks=message' }, 'member-2').url).toBe('/#familyThanks=message&as=member-2');
  });

  it('leaves a payload with no link alone', () => {
    expect(withAccount({ nudgeLayer: 'act' }, 'member-2')).toEqual({ nudgeLayer: 'act' });
  });
});
