/**
 * The service worker's push handling, loaded and run in a fake worker scope.
 *
 * This guards a bug that shipped: every Web Push notification arrived twice. The Firebase worker
 * installs its own `push` listener, and that listener does not check whether a push came from FCM —
 * it accepts any JSON and displays anything with a `notification` field, which ours has. So the
 * message was rendered once by our handler and once by Firebase's.
 *
 * The file is plain JavaScript served to the browser, not part of any bundle, so it is read from
 * disk and evaluated here with the globals a worker would have.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';

const WORKER = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  'public',
  'firebase-messaging-sw.js',
);

type Listener = (event: unknown) => void;

/** Loads the worker with stubbed globals and hands back what it registered. */
function loadWorker(provider = 'fcm') {
  const listeners = new Map<string, Listener[]>();
  const showNotification = vi.fn().mockResolvedValue(undefined);
  const onBackgroundMessage = vi.fn();
  const imported: string[] = [];

  const self = {
    addEventListener(type: string, listener: Listener) {
      const existing = listeners.get(type) ?? [];
      existing.push(listener);
      listeners.set(type, existing);
    },
    registration: { showNotification },
    clients: { matchAll: vi.fn().mockResolvedValue([]), openWindow: vi.fn(), claim: vi.fn() },
    // The provider reaches the worker in its own URL; there is nowhere else it could read it from.
    location: { href: `https://app.anuvawellness.com/firebase-messaging-sw.js?provider=${provider}` },
    skipWaiting: vi.fn(),
    // Present, as it is in production: the worker only initialises Firebase when it is configured.
    FIREBASE_WEB_CONFIG: { apiKey: 'test-key' },
  };

  const firebase = {
    initializeApp: vi.fn(),
    messaging: vi.fn(() => ({ onBackgroundMessage })),
  };

  const source = readFileSync(WORKER, 'utf8');
  // eslint-disable-next-line @typescript-eslint/no-implied-eval, no-new-func
  new Function('self', 'firebase', 'importScripts', 'caches', 'Response', source)(
    self,
    firebase,
    (url: string) => imported.push(url),
    { open: vi.fn().mockResolvedValue({ put: vi.fn() }) },
    class {},
  );

  return {
    listeners,
    showNotification,
    imported,
    firebaseInitialised: firebase.messaging.mock.calls.length > 0,
  };
}

/** A push event carrying a JSON payload, recording whether propagation was stopped. */
function pushEvent(payload: unknown) {
  const stopImmediatePropagation = vi.fn();
  const waited: unknown[] = [];
  return {
    event: {
      data: { json: () => payload },
      stopImmediatePropagation,
      waitUntil: (promise: unknown) => waited.push(promise),
    },
    stopImmediatePropagation,
    waited,
  };
}

const OUR_PAYLOAD = {
  anuva: 1,
  notification: { title: 'Meera says thank you', body: 'It landed.' },
  data: { url: '/home' },
};

describe('the service worker push handler', () => {
  it('registers its own listener before Firebase initialises, so it sees the event first', () => {
    const { listeners, firebaseInitialised } = loadWorker('fcm');
    expect(listeners.get('push')?.length).toBe(1);
    // Firebase adds its listener internally when messaging() is called; ours must already be on.
    expect(firebaseInitialised).toBe(true);
  });

  it('shows our notification once, and stops the event reaching Firebase', () => {
    const { listeners, showNotification } = loadWorker();
    const { event, stopImmediatePropagation } = pushEvent(OUR_PAYLOAD);

    listeners.get('push')![0]!(event);

    expect(showNotification).toHaveBeenCalledTimes(1);
    expect(showNotification).toHaveBeenCalledWith(
      'Meera says thank you',
      expect.objectContaining({ body: 'It landed.', data: { url: '/home' } }),
    );
    // Without this the same message is displayed again by Firebase's own push listener.
    expect(stopImmediatePropagation).toHaveBeenCalledTimes(1);
  });

  it('leaves a message that is not ours to Firebase, untouched', () => {
    const { listeners, showNotification } = loadWorker();
    // An FCM message: no `anuva` marker. The `both` migration mode depends on this passing through.
    const { event, stopImmediatePropagation } = pushEvent({
      notification: { title: 'From FCM', body: 'Sent the old way.' },
    });

    listeners.get('push')![0]!(event);

    expect(showNotification).not.toHaveBeenCalled();
    expect(stopImmediatePropagation).not.toHaveBeenCalled();
  });

  it('ignores a push with no data rather than showing an empty notification', () => {
    const { listeners, showNotification } = loadWorker();
    listeners.get('push')![0]!({ data: null, stopImmediatePropagation: vi.fn(), waitUntil: vi.fn() });
    expect(showNotification).not.toHaveBeenCalled();
  });

  it('survives a payload that is not JSON', () => {
    const { listeners, showNotification } = loadWorker();
    const event = {
      data: {
        json: () => {
          throw new Error('not json');
        },
      },
      stopImmediatePropagation: vi.fn(),
      waitUntil: vi.fn(),
    };

    expect(() => listeners.get('push')![0]!(event)).not.toThrow();
    expect(showNotification).not.toHaveBeenCalled();
  });
});

describe('what the worker loads', () => {
  it('does not touch Firebase at all on the webpush transport', () => {
    const { imported, firebaseInitialised, listeners } = loadWorker('webpush');

    // No scripts fetched from gstatic on every worker start, no second push listener to draw a
    // duplicate, and no Firebase IndexedDB token store — the subsystem that fails on iOS and the
    // reason this transport exists.
    expect(imported).toEqual([]);
    expect(firebaseInitialised).toBe(false);
    expect(listeners.get('push')?.length).toBe(1);
  });

  it('still loads Firebase on the fcm transport', () => {
    const { imported, firebaseInitialised } = loadWorker('fcm');
    expect(imported.some((url) => url.includes('firebase-messaging-compat'))).toBe(true);
    expect(imported).toContain('/firebase-config.js');
    expect(firebaseInitialised).toBe(true);
  });

  it('loads Firebase on both, where each transport is in use', () => {
    // `both` is the migration mode: FCM messages must still reach Firebase's own handler.
    const { firebaseInitialised } = loadWorker('both');
    expect(firebaseInitialised).toBe(true);
  });

  it('defaults to loading Firebase when no provider is named', () => {
    // An older registration has no query string; it must keep behaving exactly as it did.
    const { firebaseInitialised } = loadWorker('');
    expect(firebaseInitialised).toBe(true);
  });

  it('still shows our own notification when Firebase is not loaded', () => {
    const { listeners, showNotification } = loadWorker('webpush');
    listeners.get('push')![0]!({
      data: { json: () => OUR_PAYLOAD },
      stopImmediatePropagation: vi.fn(),
      waitUntil: vi.fn(),
    });
    expect(showNotification).toHaveBeenCalledTimes(1);
  });
});
