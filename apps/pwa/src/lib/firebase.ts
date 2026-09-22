import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getMessaging, getToken, isSupported, onMessage, type Messaging } from 'firebase/messaging';
import { getOrCreateDeviceId } from './notifications/deviceId';
import { registerFcmTokenOnServer } from './notifications/registerFcmToken';
import type { FcmSyncResult } from './notifications/fcmSync';
import { toSyncErrorMessage } from './notifications/fcmSync';
import { requestNotificationPermission } from './notifications/notificationPrompt';
import { ApiError } from '../shared/lib/api';
import i18n from '../i18n';
import { describePushSupport } from './notifications/pushSupport';
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

/** True when the registration is actually running our FCM SW script (not the workbox `/` SW). */
function isFcmRegistration(
  registration: ServiceWorkerRegistration | undefined
): registration is ServiceWorkerRegistration {
  if (!registration) {
    return false;
  }
  const worker = registration.active ?? registration.waiting ?? registration.installing;
  return Boolean(worker?.scriptURL.endsWith(FCM_SW_URL));
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

  const existing = await navigator.serviceWorker.getRegistration(FCM_SW_SCOPE);
  const registration = isFcmRegistration(existing)
    ? existing
    : await navigator.serviceWorker.register(FCM_SW_URL, { scope: FCM_SW_SCOPE });

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

export async function obtainAndRegisterFcmToken(): Promise<FcmSyncResult> {
  if (!isFirebaseConfigured()) {
    return {
      ok: false,
      reason: 'not_configured',
      message: i18n.t('errors.pushNotConfigured'),
    };
  }

  if (!(await isSupported())) {
    // Firebase folds six checks into one boolean, so record which piece is actually missing.
    // On iOS this is usually IndexedDB refusing to open after the system reclaimed storage —
    // indistinguishable, from the message alone, from a browser that never had push at all.
    const detail = await describePushSupport();
    console.warn('[push] Firebase reports push unsupported', detail);
    Sentry.captureMessage('push unsupported', { level: 'warning', extra: detail });
    return {
      ok: false,
      reason: 'unsupported',
      message: i18n.t('errors.pushUnsupported'),
    };
  }

  if (Notification.permission !== 'granted') {
    return {
      ok: false,
      reason: 'not_granted',
      message: i18n.t('errors.permissionNotGranted'),
    };
  }

  try {
    const messagingInstance = await getFirebaseMessaging();
    if (!messagingInstance) {
      return {
        ok: false,
        reason: 'unsupported',
        message: i18n.t('errors.messagingInitFailed'),
      };
    }

    const registration = await getFcmServiceWorkerRegistration();

    let token: string;
    try {
      token = await getToken(messagingInstance, {
        vapidKey: vapidKey!,
        serviceWorkerRegistration: registration,
      });
    } catch {
      token = await resubscribe(messagingInstance, registration);
    }

    if (!token) {
      return {
        ok: false,
        reason: 'no_token',
        message: i18n.t('errors.noDeviceToken'),
      };
    }

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
    console.warn('[push] registration failed', error);
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
