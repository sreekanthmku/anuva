import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getMessaging, getToken, isSupported, onMessage, type Messaging } from 'firebase/messaging';
import { getOrCreateDeviceId } from './notifications/deviceId';
import { registerFcmTokenOnServer } from './notifications/registerFcmToken';
import type { FcmSyncResult } from './notifications/fcmSync';
import { toSyncErrorMessage } from './notifications/fcmSync';
import { requestNotificationPermission } from './notifications/notificationPrompt';
import { ApiError } from '../shared/lib/api';
import i18n from '../i18n';
import { fetchPushConfig, subscribeToWebPush, webPushSupported } from './notifications/webPush';
import {
  deleteFirebaseDatabases,
  describeError,
  describePushSupport,
  isQuotaFailure,
  isStorageCorruption,
  missingPushCapabilities,
  probeIndexedDb,
  purgeRebuildableCaches,
  waitForIndexedDb,
} from './notifications/pushSupport';
import * as Sentry from '@sentry/react';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY as string | undefined,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string | undefined,
  appId: import.meta.env.VITE_FIREBASE_APP_ID as string | undefined,
};

const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY as string | undefined;

let app: FirebaseApp | null = null;
let messaging: Messaging | null = null;

export function isFirebaseConfigured(): boolean {
  return Boolean(
    firebaseConfig.apiKey &&
    firebaseConfig.projectId &&
    firebaseConfig.messagingSenderId &&
    firebaseConfig.appId &&
    vapidKey
  );
}

function getFirebaseApp(): FirebaseApp {
  if (!isFirebaseConfigured()) {
    throw new Error(i18n.t('errors.firebaseNotConfigured'));
  }

  if (!app) {
    app = initializeApp(firebaseConfig);
  }

  return app;
}

async function getFirebaseMessaging(): Promise<Messaging | null> {
  if (!(await isSupported())) {
    return null;
  }

  if (!messaging) {
    messaging = getMessaging(getFirebaseApp());
  }

  return messaging;
}

const FCM_SW_URL = '/firebase-messaging-sw.js';
const FCM_SW_SCOPE = '/firebase-cloud-messaging-push-scope/';

/**
 * True when the registration is running our push worker *for this transport*.
 *
 * The provider rides in the script's query string, because a worker is a static file and cannot
 * read the API's configuration itself. A registration running the same script under a different
 * provider is therefore the wrong worker — on `webpush` it would still be loading Firebase — so it
 * is rejected and re-registered, which swaps it in place.
 */
function isFcmRegistration(
  registration: ServiceWorkerRegistration | undefined,
  provider: string,
): registration is ServiceWorkerRegistration {
  if (!registration) {
    return false;
  }
  const worker = registration.active ?? registration.waiting ?? registration.installing;
  if (!worker) {
    return false;
  }
  const url = new URL(worker.scriptURL, self.location.href);
  return url.pathname === FCM_SW_URL && url.searchParams.get('provider') === provider;
}

/** The worker's URL for a transport. The query is what tells the worker which one it is serving. */
function workerUrlFor(provider: string): string {
  return `${FCM_SW_URL}?provider=${encodeURIComponent(provider)}`;
}

async function waitForActivation(registration: ServiceWorkerRegistration): Promise<void> {
  if (registration.active) {
    return;
  }
  const worker = registration.installing ?? registration.waiting;
  if (!worker) {
    return;
  }
  await new Promise<void>((resolve) => {
    worker.addEventListener('statechange', () => {
      if (worker.state === 'activated') {
        resolve();
      }
    });
  });
}

/**
 * Dedicated FCM service worker (separate scope so it does not conflict with the Vite PWA workbox SW).
 *
 * `navigator.serviceWorker.getRegistration(scope)` returns the registration whose scope *contains*
 * the URL — and the workbox SW at `/` contains `/firebase-cloud-messaging-push-scope/`. So a bare
 * `getRegistration` hands back the workbox SW (no push handler) and the FCM token gets bound to it,
 * which silently drops every notification. Only accept a registration actually running our FCM SW
 * script; otherwise register it explicitly.
 */
async function getFcmServiceWorkerRegistration(): Promise<ServiceWorkerRegistration> {
  if (!('serviceWorker' in navigator)) {
    throw new Error(i18n.t('errors.serviceWorkerUnsupported'));
  }

  // The worker is told the transport at registration time; see `workerUrlFor`.
  const provider = (await fetchPushConfig().catch(() => null))?.provider ?? 'fcm';
  const existing = await navigator.serviceWorker.getRegistration(FCM_SW_SCOPE);
  const registration = isFcmRegistration(existing, provider)
    ? existing
    : await navigator.serviceWorker.register(workerUrlFor(provider), {
        scope: FCM_SW_SCOPE,
        // Without this the browser may serve this script from its HTTP cache for up to 24 hours, so
        // a fix shipped to the worker does not reach the device. That is how a deployed
        // notification-click fix kept behaving like the old one on an installed iOS app.
        updateViaCache: 'none',
      });


  // Ask for a newer worker on every launch, not only after a subscribe has already failed. The
  // check is cheap, and it is the only thing that gets a worker change onto a device that is
  // otherwise content with the copy it has.
  try {
    void registration.update();
  } catch {
    /* offline, or nothing new to fetch */
  }
  await waitForActivation(registration);

  return registration;
}

/**
 * Android Chrome throws `AbortError: Registration failed - push service error` when a stale
 * PushSubscription (bound to an old VAPID key or the old workbox `/` registration) blocks a fresh
 * subscribe. Drop any existing subscription on both the FCM scope and the root scope so getToken
 * can subscribe cleanly. Desktop tolerates the stale sub; Android does not.
 */
async function clearStalePushSubscriptions(
  fcmRegistration: ServiceWorkerRegistration
): Promise<void> {
  const registrations = new Set<ServiceWorkerRegistration>([fcmRegistration]);
  try {
    const root = await navigator.serviceWorker.getRegistration('/');
    if (root) {
      registrations.add(root);
    }
  } catch {
    /* ignore */
  }

  await Promise.all(
    [...registrations].map(async (registration) => {
      try {
        const sub = await registration.pushManager.getSubscription();
        if (sub) {
          await sub.unsubscribe();
        }
      } catch {
        /* ignore */
      }
    })
  );
}

/**
 * Subscribing again after the first attempt failed.
 *
 * A stale subscription (Android) or a service worker that has just been replaced (iOS, where the
 * update drops the old subscription) both fail the first `getToken`. Retrying in the same tick
 * fails too, because the new worker is still activating — so each attempt clears what is there,
 * pulls the freshest registration, waits for it to activate, and only then asks again.
 */
async function resubscribe(
  messagingInstance: Messaging,
  registration: ServiceWorkerRegistration,
): Promise<string> {
  let lastError: unknown;

  for (const backoffMs of [200, 1200]) {
    try {
      await clearStalePushSubscriptions(registration);
      try {
        await registration.update();
      } catch {
        /* offline, or nothing new to fetch */
      }
      await waitForActivation(registration);
      await new Promise((resolve) => setTimeout(resolve, backoffMs));

      return await getToken(messagingInstance, {
        vapidKey: vapidKey!,
        serviceWorkerRegistration: registration,
      });
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError;
}

export async function saveFcmTokenToServer(fcmToken: string): Promise<void> {
  await registerFcmTokenOnServer({
    fcmToken,
    platform: 'WEB',
    deviceId: getOrCreateDeviceId(),
  });
}

/**
 * The Web Push path: the browser's own subscription, no Firebase SDK and no IndexedDB.
 *
 * Chosen by the API (`GET /push/config`), so a deployment can switch transports without releasing
 * the apps. Failures here are reported the same way the Firebase path reports its own, because to
 * the person waiting they are the same thing: notifications did not turn on.
 */
async function registerWebPushSubscription(vapidPublicKey: string): Promise<FcmSyncResult> {
  if (!webPushSupported()) {
    const detail = await describePushSupport();
    console.warn('[push] browser cannot subscribe', detail);
    Sentry.captureMessage('push unsupported', { level: 'warning', extra: detail });
    return { ok: false, reason: 'unsupported', message: i18n.t('errors.pushUnsupported') };
  }

  if (Notification.permission !== 'granted') {
    return { ok: false, reason: 'not_granted', message: i18n.t('errors.permissionNotGranted') };
  }

  try {
    const registration = await getFcmServiceWorkerRegistration();
    const subscription = await subscribeToWebPush(registration, vapidPublicKey, '/api/push/web/register');
    try {
      // Kept for the same reason the FCM token is: it tells a later visit that this device is
      // already registered, without asking the server.
      localStorage.setItem('anuva-fcm-token', subscription.endpoint);
    } catch {
      /* ignore */
    }
    return { ok: true, token: subscription.endpoint };
  } catch (error) {
    const detail = { transport: 'webpush', error: describeError(error), permission: Notification.permission };
    console.warn('[push] web push subscribe failed', detail, error);
    Sentry.captureMessage('push registration failed', { level: 'warning', extra: detail });
    return {
      ok: false,
      reason: error instanceof ApiError ? 'server_error' : 'unknown',
      message:
        error instanceof ApiError ? toSyncErrorMessage(error) : i18n.t('errors.deviceRegisterFailed'),
    };
  }
}

export async function obtainAndRegisterFcmToken(): Promise<FcmSyncResult> {
  // Which transport is this deployment's business, not this device's. Asked once per app start.
  const pushConfig = await fetchPushConfig().catch(() => null);
  if (pushConfig?.provider !== 'fcm' && pushConfig?.vapidPublicKey) {
    return registerWebPushSubscription(pushConfig.vapidPublicKey);
  }

  if (!isFirebaseConfigured()) {
    return {
      ok: false,
      reason: 'not_configured',
      message: i18n.t('errors.pushNotConfigured'),
    };
  }

  if (!(await isSupported())) {
    // Firebase folds six checks into one boolean. When everything is present and only IndexedDB
    // will not open, this is the WebKit fault that clears a second or two after an installed iOS
    // app launches — so wait for storage and ask again rather than telling her push is impossible.
    const stillMissing = missingPushCapabilities();
    let wait = stillMissing.length === 0 ? await waitForIndexedDb() : undefined;
    let purged: string[] = [];
    let deletedDatabases: string[] = [];

    // Still refusing after the waits, so try the one repair that matches the reason given.
    //
    // Out of room: give back the caches this origin can rebuild. Measured at 0% used on the device
    // that prompted this, so it is the rarer case — but cheap, and a stale API response is worth
    // less than being reachable.
    if (wait && isQuotaFailure(wait.error)) {
      purged = await purgeRebuildableCaches();
      if (purged.length > 0) wait = await waitForIndexedDb([0, 400]);
    }

    // "Unable to open database file on disk": the file is damaged, not full. Dropping Firebase's
    // own databases sometimes clears it; when it does not, only reinstalling the app will, and the
    // log below is what says so.
    if (wait && isStorageCorruption(wait.error)) {
      deletedDatabases = await deleteFirebaseDatabases();
      if (deletedDatabases.length > 0) wait = await waitForIndexedDb([0, 400]);
    }

    const recovered = wait?.outcome === 'ok' && (await isSupported());

    if (!recovered) {
      const detail = {
        ...(await describePushSupport(wait)),
        purgedCaches: purged,
        deletedDatabases,
        // Said plainly in the log, because no amount of retrying fixes a damaged database file.
        likelyFix: isStorageCorruption(wait?.error) ? 'reinstall app: storage is corrupted' : null,
      };
      console.warn('[push] Firebase reports push unsupported', detail);
      Sentry.captureMessage('push unsupported', { level: 'warning', extra: detail });
      return {
        ok: false,
        reason: 'unsupported',
        message: i18n.t('errors.pushUnsupported'),
      };
    }

    // Worth knowing how often the wait saves a registration, and how long it took.
    Sentry.addBreadcrumb({
      category: 'push',
      level: 'info',
      message: 'indexedDB recovered after wait',
      data: { attempts: wait?.attempts, purgedCaches: purged, deletedDatabases },
    });
  }

  if (Notification.permission !== 'granted') {
    return {
      ok: false,
      reason: 'not_granted',
      message: i18n.t('errors.permissionNotGranted'),
    };
  }

  // Which step failed is the whole diagnosis when a subscribe goes wrong, and it is not knowable
  // from the message the browser throws — "push service initialization failed" is the same string
  // whether the worker never activated or the VAPID key was refused.
  let stage: 'messaging' | 'service-worker' | 'token' | 'resubscribe' | 'server' = 'messaging';
  let firstTokenError: string | null = null;
  let registration: ServiceWorkerRegistration | null = null;

  try {
    const messagingInstance = await getFirebaseMessaging();
    if (!messagingInstance) {
      return {
        ok: false,
        reason: 'unsupported',
        message: i18n.t('errors.messagingInitFailed'),
      };
    }

    stage = 'service-worker';
    registration = await getFcmServiceWorkerRegistration();

    let token: string;
    stage = 'token';
    try {
      token = await getToken(messagingInstance, {
        vapidKey: vapidKey!,
        serviceWorkerRegistration: registration,
      });
    } catch (error) {
      // The first failure is often the informative one; the retry hides it behind its own.
      firstTokenError = describeError(error);
      stage = 'resubscribe';
      token = await resubscribe(messagingInstance, registration);
    }

    if (!token) {
      return {
        ok: false,
        reason: 'no_token',
        message: i18n.t('errors.noDeviceToken'),
      };
    }

    stage = 'server';
    await saveFcmTokenToServer(token);

    try {
      localStorage.setItem('anuva-fcm-token', token);
    } catch {
      /* ignore */
    }

    return { ok: true, token };
  } catch (error) {
    // A browser/Firebase subscribe failure reads like "push service initialization failed" — true,
    // untranslated, and not something she can act on. The server's own errors still speak for
    // themselves. Either way the original is kept for the console and Sentry.
    const detail = {
      stage,
      error: describeError(error),
      firstTokenError,
      swScope: registration?.scope ?? null,
      swScript: registration?.active?.scriptURL ?? null,
      permission: Notification.permission,
      indexedDb: (await probeIndexedDb()).outcome,
    };
    console.warn('[push] registration failed', detail, error);
    // Previously console-only, which left the commonest failure — tapping Allow and getting
    // nowhere — with no trace anywhere it could be read from a phone.
    Sentry.captureMessage('push registration failed', { level: 'warning', extra: detail });
    return {
      ok: false,
      reason: 'server_error',
      message:
        error instanceof ApiError ? toSyncErrorMessage(error) : i18n.t('errors.deviceRegisterFailed'),
    };
  }
}

/** Browser permission + FCM token registration (when Firebase env is set). */
export async function enablePushNotifications(): Promise<{
  permission: NotificationPermission;
  sync: FcmSyncResult;
}> {
  const permission = await requestNotificationPermission();

  if (permission !== 'granted') {
    return {
      permission,
      sync: {
        ok: false,
        reason: 'not_granted',
        message: i18n.t('errors.permissionWasNotGranted'),
      },
    };
  }

  return { permission, sync: await obtainAndRegisterFcmToken() };
}

/** Re-register when user already granted permission (e.g. return visit to home). */
export async function syncFcmTokenIfGranted(): Promise<FcmSyncResult | null> {
  if (Notification.permission !== 'granted') {
    return null;
  }

  return obtainAndRegisterFcmToken();
}

export function subscribeToForegroundMessages(onPayload: (payload: unknown) => void): () => void {
  if (!isFirebaseConfigured()) {
    return () => {};
  }

  let unsubscribe: (() => void) | null = null;

  void getFirebaseMessaging().then((instance) => {
    if (!instance) {
      return;
    }

    unsubscribe = onMessage(instance, onPayload);
  });

  return () => unsubscribe?.();
}

export type { FcmSyncResult };
export { needsPushRegistrationRetry } from './notifications/fcmSync';

const FAMILY_PUSH_KEYS = ['familyMessage', 'familyGift'];

/**
 * FCM shows nothing when a tab is visible and hands the payload to `onMessage` instead, so without
 * this a push received while the app is open simply vanished. Re-display it as the same system
 * notification the background path produces; the FCM worker owns the click, so tapping it routes
 * identically in all three states. Family notes/gifts are excluded: they open their own in-app card.
 */
export function subscribeToForegroundNotifications(): () => void {
  return subscribeToForegroundMessages((payload) => {
    const message = payload as {
      notification?: { title?: string; body?: string };
      data?: Record<string, string>;
    };
    const data = message.data ?? {};
    if (FAMILY_PUSH_KEYS.some((key) => data[key])) return;

    const title = message.notification?.title || data.title || 'Anuva';
    const body = message.notification?.body || data.body || '';
    if (!title && !body) return;

    void getFcmServiceWorkerRegistration()
      .then((registration) =>
        registration.showNotification(title, {
          body,
          icon: '/pwa-192.png',
          badge: '/pwa-192.png',
          data,
          tag: data.type && data.consultationId ? `${data.type}:${data.consultationId}` : undefined,
        })
      )
      .catch(() => {
        /* permission revoked or SW unavailable: nothing useful to do */
      });
  });
}
