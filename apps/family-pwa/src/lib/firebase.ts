import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getMessaging, getToken, isSupported, onMessage, type Messaging } from 'firebase/messaging';
import type { FcmPlatform } from '@anuva/shared';
import { ApiError, apiFetch } from '../shared/lib/api';
// The instance rather than the hook: none of this runs inside a React render.
import i18n from '../i18n';
import { getOrCreateDeviceId } from './notifications/deviceId';
import { requestNotificationPermission } from './notifications/notificationPrompt';
import { fetchPushConfig, subscribeToWebPush, webPushSupported } from './notifications/webPush';
import {
  describeError,
  describePushSupport,
  missingPushCapabilities,
  probeIndexedDb,
  waitForIndexedDb,
} from './notifications/pushSupport';
import * as Sentry from '@sentry/react';

/**
 * Push for the family app.
 *
 * Same Firebase project and the same two-service-worker dance as `apps/pwa/src/lib/firebase.ts`,
 * but the token goes to `/api/family/push/register` — a family device is registered against the
 * member, not against her account, so revoking a member takes their notifications with them.
 *
 * What actually arrives here is one thing: she said thank you. That is the whole reason this
 * exists, and it is worth saying plainly on the permission card rather than asking for
 * "notifications" in the abstract.
 */

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY as string | undefined,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string | undefined,
  appId: import.meta.env.VITE_FIREBASE_APP_ID as string | undefined,
};

const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY as string | undefined;

const FCM_SW_URL = '/firebase-messaging-sw.js';
const FCM_SW_SCOPE = '/firebase-cloud-messaging-push-scope/';

let app: FirebaseApp | null = null;
let messaging: Messaging | null = null;

export function isFirebaseConfigured(): boolean {
  return Boolean(
    firebaseConfig.apiKey &&
      firebaseConfig.projectId &&
      firebaseConfig.messagingSenderId &&
      firebaseConfig.appId &&
      vapidKey,
  );
}

async function getFirebaseMessaging(): Promise<Messaging | null> {
  if (!isFirebaseConfigured()) return null;

  if (!(await isSupported())) {
    // Everything present but IndexedDB will not open: the WebKit fault that clears a second or two
    // after an installed iOS app launches. Firebase reads it as "no push" for good, so wait for
    // storage and ask again before believing it. Anything genuinely missing fails straight through.
    const wait = missingPushCapabilities().length === 0 ? await waitForIndexedDb() : undefined;
    // Nothing to purge and retry here: this origin keeps no runtime caches, only its precache.
    if (wait?.outcome !== 'ok' || !(await isSupported())) {
      const detail = await describePushSupport(wait);
      console.warn('[push] Firebase reports push unsupported', detail);
      Sentry.captureMessage('push unsupported', { level: 'warning', extra: detail });
      return null;
    }
  }

  if (!app) {
    app = initializeApp(firebaseConfig);
  }
  if (!messaging) {
    messaging = getMessaging(app);
  }

  return messaging;
}

/**
 * `getRegistration(scope)` returns whichever registration's scope *contains* the URL — and the
 * workbox SW at `/` contains this scope. Accepting it would bind the token to a worker with no push
 * handler, which drops every notification silently. Only take a registration actually running our
 * FCM script.
 */
function isFcmRegistration(
  registration: ServiceWorkerRegistration | undefined,
  provider: string,
): registration is ServiceWorkerRegistration {
  const worker = registration?.active ?? registration?.waiting ?? registration?.installing;
  if (!worker) return false;
  // The provider rides in the query string: a worker registered for another transport is the wrong
  // one — on `webpush` it would still be loading Firebase — so it is replaced rather than reused.
  const url = new URL(worker.scriptURL, self.location.href);
  return url.pathname === FCM_SW_URL && url.searchParams.get('provider') === provider;
}

/** The worker's URL for a transport. The query is what tells the worker which one it is serving. */
function workerUrlFor(provider: string): string {
  return `${FCM_SW_URL}?provider=${encodeURIComponent(provider)}`;
}

async function waitForActivation(registration: ServiceWorkerRegistration): Promise<void> {
  if (registration.active) return;
  const worker = registration.installing ?? registration.waiting;
  if (!worker) return;
  await new Promise<void>((resolve) => {
    worker.addEventListener('statechange', () => {
      if (worker.state === 'activated') resolve();
    });
  });
}

async function getFcmServiceWorkerRegistration(): Promise<ServiceWorkerRegistration> {
  if (!('serviceWorker' in navigator)) {
    throw new Error(i18n.t('errors.serviceWorkerUnsupported'));
  }

  const existing = await navigator.serviceWorker.getRegistration(FCM_SW_SCOPE);
  const provider = (await fetchPushConfig().catch(() => null))?.provider ?? 'fcm';
  const registration = isFcmRegistration(existing, provider)
    ? existing
    : await navigator.serviceWorker.register(workerUrlFor(provider), {
        scope: FCM_SW_SCOPE,
        // Without this the browser may serve this script from its HTTP cache for up to 24 hours, so
        // a fix shipped to the worker does not reach the device.
        updateViaCache: 'none',
      });

  // Ask for a newer worker on every launch, not only after a subscribe has already failed — it is
  // the only thing that gets a worker change onto a device content with the copy it has.
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
 * PushSubscription blocks a fresh subscribe. Drop it on both scopes and let getToken try again.
 */
async function clearStalePushSubscriptions(fcm: ServiceWorkerRegistration): Promise<void> {
  const registrations = new Set<ServiceWorkerRegistration>([fcm]);
  try {
    const root = await navigator.serviceWorker.getRegistration('/');
    if (root) registrations.add(root);
  } catch {
    /* ignore */
  }

  await Promise.all(
    [...registrations].map(async (registration) => {
      try {
        await (await registration.pushManager.getSubscription())?.unsubscribe();
      } catch {
        /* ignore */
      }
    }),
  );
}

export type FamilyPushResult = { ok: true } | { ok: false; message: string };

async function registerTokenOnServer(fcmToken: string): Promise<void> {
  await apiFetch('/api/family/push/register', {
    method: 'POST',
    body: JSON.stringify({
      fcmToken,
      platform: 'WEB' satisfies FcmPlatform,
      deviceId: getOrCreateDeviceId(),
    }),
  });
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

/** The Web Push path: the browser's own subscription, no Firebase SDK and no IndexedDB. */
async function registerFamilyWebPush(vapidPublicKey: string): Promise<FamilyPushResult> {
  if (!webPushSupported()) {
    return { ok: false, message: i18n.t('errors.pushUnavailable') };
  }
  if (Notification.permission !== 'granted') {
    return { ok: false, message: i18n.t('errors.permissionNotGranted') };
  }

  try {
    const registration = await getFcmServiceWorkerRegistration();
    const subscription = await subscribeToWebPush(
      registration,
      vapidPublicKey,
      '/api/family/push/web/register',
    );
    try {
      localStorage.setItem('anuva-family-fcm-token', subscription.endpoint);
    } catch {
      /* ignore */
    }
    return { ok: true };
  } catch (error) {
    const detail = { transport: 'webpush', error: describeError(error), permission: Notification.permission };
    console.warn('[push] web push subscribe failed', detail, error);
    Sentry.captureMessage('push registration failed', { level: 'warning', extra: detail });
    return {
      ok: false,
      message: error instanceof ApiError ? error.message : i18n.t('errors.notificationsFailed'),
    };
  }
}

export async function registerFamilyDevice(): Promise<FamilyPushResult> {
  // Which transport this deployment uses; asked once per app start.
  const pushConfig = await fetchPushConfig().catch(() => null);
  if (pushConfig?.provider !== 'fcm' && pushConfig?.vapidPublicKey) {
    return registerFamilyWebPush(pushConfig.vapidPublicKey);
  }

  const instance = await getFirebaseMessaging();
  if (!instance) {
    return { ok: false, message: i18n.t('errors.pushUnavailable') };
  }

  if (Notification.permission !== 'granted') {
    return { ok: false, message: i18n.t('errors.permissionNotGranted') };
  }

  // Which step failed is the diagnosis: the browser throws the same opaque string whether the
  // worker never activated or the subscribe itself was refused.
  let stage: 'service-worker' | 'token' | 'resubscribe' | 'server' = 'service-worker';
  let firstTokenError: string | null = null;
  let registration: ServiceWorkerRegistration | null = null;

  try {
    registration = await getFcmServiceWorkerRegistration();

    let token: string;
    stage = 'token';
    try {
      token = await getToken(instance, { vapidKey: vapidKey!, serviceWorkerRegistration: registration });
    } catch (error) {
      firstTokenError = describeError(error);
      stage = 'resubscribe';
      token = await resubscribe(instance, registration);
    }

    if (!token) {
      return { ok: false, message: i18n.t('errors.noDeviceToken') };
    }

    stage = 'server';
    await registerTokenOnServer(token);
    try {
      localStorage.setItem('anuva-family-fcm-token', token);
    } catch {
      /* ignore */
    }

    return { ok: true };
  } catch (error) {
    // Browser subscribe failures ("push service initialization failed") are untranslated and not
    // actionable for a family member; the server's own message is. The original goes to the console.
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
    Sentry.captureMessage('push registration failed', { level: 'warning', extra: detail });
    return {
      ok: false,
      message: error instanceof ApiError ? error.message : i18n.t('errors.notificationsFailed'),
    };
  }
}

export async function enableFamilyNotifications(): Promise<{
  permission: NotificationPermission;
  sync: FamilyPushResult;
}> {
  const permission = await requestNotificationPermission();

  if (permission !== 'granted') {
    return { permission, sync: { ok: false, message: i18n.t('errors.permissionWasNotGranted') } };
  }

  return { permission, sync: await registerFamilyDevice() };
}

/** Permission already granted on a return visit: re-register, since tokens rotate. */
export async function syncFamilyDeviceIfGranted(): Promise<FamilyPushResult | null> {
  if (typeof window === 'undefined' || !('Notification' in window)) return null;
  if (Notification.permission !== 'granted') return null;
  return registerFamilyDevice();
}

/** Foreground pushes display nothing on their own — the app has to show them itself. */
export function subscribeToForegroundMessages(onPayload: (payload: unknown) => void): () => void {
  let unsubscribe: (() => void) | null = null;

  void getFirebaseMessaging().then((instance) => {
    if (instance) unsubscribe = onMessage(instance, onPayload);
  });

  return () => unsubscribe?.();
}

/**
 * FCM shows nothing when a tab is visible and hands the payload to `onMessage` instead. Re-display
 * it as the same system notification the background path produces; the FCM worker owns the click,
 * so tapping it routes identically in all three app states.
 */
async function showForegroundNotification(
  registration: ServiceWorkerRegistration,
  payload: unknown,
  fallbackTitle: string,
): Promise<void> {
  const message = payload as {
    notification?: { title?: string; body?: string };
    data?: Record<string, string>;
  };
  const data = message.data ?? {};
  const title = message.notification?.title || data.title || fallbackTitle;
  const body = message.notification?.body || data.body || '';
  await registration.showNotification(title, {
    body,
    icon: '/pwa-192.png',
    badge: '/pwa-192.png',
    data,
  });
}

/**
 * App-wide foreground display. Her thank-you is excluded: `ThanksListener` opens it as a card, and
 * showing a system notification on top would say the same thing twice while they are looking.
 */
export function subscribeToForegroundNotifications(): () => void {
  return subscribeToForegroundMessages((payload) => {
    const data = (payload as { data?: Record<string, string> }).data ?? {};
    if (data.familyThanks || data.familyMessage || data.familyGift) return;
    void getFcmServiceWorkerRegistration()
      .then((registration) => showForegroundNotification(registration, payload, 'Anuva Family'))
      .catch(() => {});
  });
}
