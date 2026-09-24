import { afterEach, describe, expect, it } from 'vitest';
import {
  clientPushConfig,
  pushProvider,
  usesFcm,
  usesWebPush,
  vapidKeys,
  webPushMisconfigured,
} from '../src/push/config.js';

const KEYS = {
  VAPID_PUBLIC_KEY: 'BPublicKeyForTests',
  VAPID_PRIVATE_KEY: 'PrivateKeyForTests',
};

afterEach(() => {
  for (const name of ['PUSH_PROVIDER', 'VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY', 'VAPID_SUBJECT']) {
    delete process.env[name];
  }
});

describe('pushProvider', () => {
  it('defaults to fcm, so deploying this changes nothing by itself', () => {
    expect(pushProvider()).toBe('fcm');
    expect(usesFcm()).toBe(true);
    expect(usesWebPush()).toBe(false);
  });

  it('reads the three valid settings, whatever the casing', () => {
    process.env.PUSH_PROVIDER = 'WebPush';
    expect(pushProvider()).toBe('webpush');
    process.env.PUSH_PROVIDER = ' both ';
    expect(pushProvider()).toBe('both');
    expect(usesFcm()).toBe(true);
    expect(usesWebPush()).toBe(true);
  });

  it('falls back to fcm on a typo rather than sending nothing', () => {
    process.env.PUSH_PROVIDER = 'web-push';
    expect(pushProvider()).toBe('fcm');
  });
});

describe('vapidKeys', () => {
  it('is null until both halves are set', () => {
    process.env.VAPID_PUBLIC_KEY = KEYS.VAPID_PUBLIC_KEY;
    expect(vapidKeys()).toBeNull();
    process.env.VAPID_PRIVATE_KEY = KEYS.VAPID_PRIVATE_KEY;
    expect(vapidKeys()).toMatchObject(KEYS ? { publicKey: KEYS.VAPID_PUBLIC_KEY } : {});
  });

  it('replaces a subject a push service would reject', () => {
    Object.assign(process.env, KEYS, { VAPID_SUBJECT: 'support@anuvawellness.com' });
    // Missing the mailto: scheme — push services reject it at send time, not at boot.
    expect(vapidKeys()?.subject).toMatch(/^mailto:/);
  });

  it('keeps a valid subject', () => {
    Object.assign(process.env, KEYS, { VAPID_SUBJECT: 'https://anuvawellness.com' });
    expect(vapidKeys()?.subject).toBe('https://anuvawellness.com');
  });
});

describe('clientPushConfig', () => {
  it('tells a browser to use FCM when Web Push is asked for without keys', () => {
    // Promising webpush with no key would leave the app unable to subscribe at all.
    process.env.PUSH_PROVIDER = 'webpush';
    expect(clientPushConfig()).toEqual({ provider: 'fcm', vapidPublicKey: null });
    expect(webPushMisconfigured()).toBe(true);
  });

  it('hands over the public key once it is configured', () => {
    process.env.PUSH_PROVIDER = 'webpush';
    Object.assign(process.env, KEYS);
    expect(clientPushConfig()).toEqual({
      provider: 'webpush',
      vapidPublicKey: KEYS.VAPID_PUBLIC_KEY,
    });
    expect(webPushMisconfigured()).toBe(false);
  });

  it('says nothing about keys on an FCM deployment', () => {
    expect(clientPushConfig()).toEqual({ provider: 'fcm', vapidPublicKey: null });
    expect(webPushMisconfigured()).toBe(false);
  });
});
