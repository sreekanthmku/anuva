import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getMessaging, getToken, isSupported, onMessage, type Messaging } from 'firebase/messaging';
import type { FcmPlatform } from '@anuva/shared';
import { apiFetch } from '../shared/lib/api';
import { getOrCreateDeviceId } from './notifications/deviceId';
import { requestNotificationPermission } from './notifications/notificationPrompt';

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
  if (!isFirebaseConfigured() || !(await isSupported())) {
    return null;
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
): registration is ServiceWorkerRegistration {
  const worker = registration?.active ?? registration?.waiting ?? registration?.installing;
  return Boolean(worker?.scriptURL.endsWith(FCM_SW_URL));
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
    throw new Error('Service workers are not supported.');
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

export async function registerFamilyDevice(): Promise<FamilyPushResult> {
  const instance = await getFirebaseMessaging();
  if (!instance) {
    return { ok: false, message: 'Push notifications are not available in this browser.' };
  }

  if (Notification.permission !== 'granted') {
    return { ok: false, message: 'Notification permission is not granted.' };
  }

  try {
    const registration = await getFcmServiceWorkerRegistration();

    let token: string;
    try {
      token = await getToken(instance, { vapidKey: vapidKey!, serviceWorkerRegistration: registration });
    } catch {
      await clearStalePushSubscriptions(registration);
      token = await getToken(instance, { vapidKey: vapidKey!, serviceWorkerRegistration: registration });
    }

    if (!token) {
      return { ok: false, message: 'Could not get a device token. Try a hard refresh.' };
    }

    await registerTokenOnServer(token);
    try {
      localStorage.setItem('anuva-family-fcm-token', token);
    } catch {
      /* ignore */
    }

    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : 'Could not turn on notifications.',
    };
  }
}

export async function enableFamilyNotifications(): Promise<{
  permission: NotificationPermission;
  sync: FamilyPushResult;
}> {
  const permission = await requestNotificationPermission();

  if (permission !== 'granted') {
    return { permission, sync: { ok: false, message: 'Notification permission was not granted.' } };
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
