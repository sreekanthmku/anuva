import { describe, expect, it } from 'vitest';
import {
  isQuotaFailure,
  isStorageCorruption,
  missingPushCapabilities,
  waitForIndexedDb,
  type IndexedDbProbe,
  type IndexedDbResult,
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
function scriptedProbe(outcomes: IndexedDbProbe[], error?: string) {
  const waited: number[] = [];
  let calls = 0;
  return {
    waited,
    get calls() {
      return calls;
    },
    probe: async (): Promise<IndexedDbResult> => {
      const outcome = outcomes[calls++] ?? 'error';
      return outcome === 'ok' || outcome === 'absent' ? { outcome } : { outcome, error };
    },
    sleep: async (ms: number) => void waited.push(ms),
  };
}

describe('waitForIndexedDb', () => {
  it('accepts storage that opens first time, without waiting', async () => {
    const probe = scriptedProbe(['ok']);
    await expect(waitForIndexedDb([0, 400], probe.probe, probe.sleep)).resolves.toEqual({
      outcome: 'ok',
      attempts: 1,
    });
    expect(probe.waited).toEqual([]);
  });

  it('recovers the iOS launch race: refused at launch, fine a moment later', async () => {
    const probe = scriptedProbe(['timeout', 'error', 'ok']);
    await expect(waitForIndexedDb([0, 400, 1200], probe.probe, probe.sleep)).resolves.toEqual({
      outcome: 'ok',
      attempts: 3,
    });
    expect(probe.waited).toEqual([400, 1200]);
  });

  it('gives up after the last delay, reporting the final outcome', async () => {
    const probe = scriptedProbe(['timeout', 'timeout', 'timeout']);
    await expect(waitForIndexedDb([0, 400, 1200], probe.probe, probe.sleep)).resolves.toEqual({
      outcome: 'timeout',
      attempts: 3,
    });
    expect(probe.calls).toBe(3);
  });

  it('carries the browser reason back, which is what names the cause', async () => {
    // QuotaExceededError means this origin is full and purging caches can help; UnknownError is
    // WebKit corruption, where it cannot. The difference is the whole diagnosis.
    const probe = scriptedProbe(['error', 'error'], 'QuotaExceededError: no space left');
    await expect(waitForIndexedDb([0, 400], probe.probe, probe.sleep)).resolves.toEqual({
      outcome: 'error',
      attempts: 2,
      error: 'QuotaExceededError: no space left',
    });
  });

  it('does not wait at all when IndexedDB is absent — there is nothing to wait for', async () => {
    const probe = scriptedProbe(['absent']);
    await expect(waitForIndexedDb([0, 400, 1200], probe.probe, probe.sleep)).resolves.toEqual({
      outcome: 'absent',
      attempts: 1,
    });
    expect(probe.calls).toBe(1);
  });
});

describe('reading the browser reason', () => {
  it('recognises a damaged database file — the case seen on iOS 18.7', () => {
    expect(isStorageCorruption('UnknownError: Unable to open database file on disk')).toBe(true);
    expect(isStorageCorruption('InvalidStateError: database is closed')).toBe(true);
  });

  it('does not mistake a damaged file for a full one', () => {
    // Deleting caches cannot repair a corrupt file, so the two must not be confused.
    expect(isQuotaFailure('UnknownError: Unable to open database file on disk')).toBe(false);
    expect(isStorageCorruption('QuotaExceededError: no space left')).toBe(false);
  });

  it('recognises being out of room', () => {
    expect(isQuotaFailure('QuotaExceededError: no space left')).toBe(true);
    expect(isQuotaFailure('quota exceeded')).toBe(true);
  });

  it('treats a missing reason as neither', () => {
    expect(isStorageCorruption(undefined)).toBe(false);
    expect(isQuotaFailure(undefined)).toBe(false);
    expect(isStorageCorruption('SecurityError: storage blocked')).toBe(false);
  });
});
