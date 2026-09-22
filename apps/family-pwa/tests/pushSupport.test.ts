import { describe, expect, it } from 'vitest';
import {
  missingPushCapabilities,
  waitForIndexedDb,
  type IndexedDbProbe,
} from '../src/lib/notifications/pushSupport';

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

/** A probe that returns each scripted outcome in turn, recording how long it was made to wait. */
function scriptedProbe(outcomes: IndexedDbProbe[]) {
  const waited: number[] = [];
  let calls = 0;
  return {
    waited,
    get calls() {
      return calls;
    },
    probe: async () => outcomes[calls++] ?? 'error',
    sleep: async (ms: number) => void waited.push(ms),
  };
}

describe('waitForIndexedDb', () => {
  it('accepts storage that opens first time, without waiting', async () => {
    const s = scriptedProbe(['ok']);
    await expect(waitForIndexedDb([0, 400], s.probe, s.sleep)).resolves.toEqual({
      outcome: 'ok',
      attempts: 1,
    });
    expect(s.waited).toEqual([]);
  });

  it('recovers the iOS case: refused at launch, fine a moment later', async () => {
    // Exactly what Sentry recorded — everything present, storage briefly unopenable.
    const s = scriptedProbe(['timeout', 'error', 'ok']);
    await expect(waitForIndexedDb([0, 400, 1200], s.probe, s.sleep)).resolves.toEqual({
      outcome: 'ok',
      attempts: 3,
    });
    expect(s.waited).toEqual([400, 1200]);
  });

  it('gives up after the last delay, reporting the final outcome', async () => {
    const s = scriptedProbe(['timeout', 'timeout', 'timeout']);
    await expect(waitForIndexedDb([0, 400, 1200], s.probe, s.sleep)).resolves.toEqual({
      outcome: 'timeout',
      attempts: 3,
    });
    expect(s.calls).toBe(3);
  });

  it('does not wait at all when IndexedDB is absent — there is nothing to wait for', async () => {
    const s = scriptedProbe(['absent']);
    await expect(waitForIndexedDb([0, 400, 1200], s.probe, s.sleep)).resolves.toEqual({
      outcome: 'absent',
      attempts: 1,
    });
    expect(s.calls).toBe(1);
  });
});
