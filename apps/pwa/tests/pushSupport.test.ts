import { describe, expect, it } from 'vitest';
import { missingPushCapabilities } from '../src/lib/notifications/pushSupport';

/** A browser with everything push needs. */
const complete = {
  navigator: { serviceWorker: {} },
  PushManager: {},
  Notification: {},
  ServiceWorkerRegistration: { prototype: { showNotification: () => {} } },
  PushSubscription: { prototype: { getKey: () => {} } },
  indexedDB: {},
};

describe('missingPushCapabilities', () => {
  it('reports nothing missing on a browser that supports push', () => {
    expect(missingPushCapabilities(complete)).toEqual([]);
  });

  it('names an iPhone Safari tab: no notifications and no push', () => {
    // iOS exposes neither outside an installed app, which is why push is refused there.
    const { Notification, PushManager, ...safariTab } = complete;
    expect(missingPushCapabilities(safariTab)).toEqual(['pushManager', 'notification']);
  });

  it('names IndexedDB on its own', () => {
    const { indexedDB, ...noStorage } = complete;
    expect(missingPushCapabilities(noStorage)).toEqual(['indexedDB']);
  });

  it('spots a service worker without notification support', () => {
    expect(
      missingPushCapabilities({ ...complete, ServiceWorkerRegistration: { prototype: {} } }),
    ).toEqual(['showNotification']);
  });

  it('survives a host with nothing on it', () => {
    expect(missingPushCapabilities({})).toEqual([
      'serviceWorker',
      'pushManager',
      'notification',
      'showNotification',
      'pushSubscriptionKeys',
      'indexedDB',
    ]);
  });
});
