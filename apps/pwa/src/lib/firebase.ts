import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getMessaging, getToken, isSupported, onMessage, type Messaging } from 'firebase/messaging';
import { getOrCreateDeviceId } from './notifications/deviceId';
import { registerFcmTokenOnServer } from './notifications/registerFcmToken';
import type { FcmSyncResult } from './notifications/fcmSync';
import { toSyncErrorMessage } from './notifications/fcmSync';
import { requestNotificationPermission } from './notifications/notificationPrompt';

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
    throw new Error('Firebase is not configured.');
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
    throw new Error('Service workers are not supported.');
  }

  const existing = await navigator.serviceWorker.getRegistration(FCM_SW_SCOPE);
  const registration = isFcmRegistration(existing)
    ? existing
    : await navigator.serviceWorker.register(FCM_SW_URL, { scope: FCM_SW_SCOPE });

  await waitForActivation(registration);

  return registration;
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
      message: 'Push notifications are not configured on this build.',
    };
  }

  if (!(await isSupported())) {
    return {
      ok: false,
      reason: 'unsupported',
      message: 'This browser does not support push notifications.',
    };
  }

  if (Notification.permission !== 'granted') {
    return {
      ok: false,
      reason: 'not_granted',
      message: 'Notification permission is not granted.',
    };
  }

  try {
    const messagingInstance = await getFirebaseMessaging();
    if (!messagingInstance) {
      return {
        ok: false,
        reason: 'unsupported',
        message: 'Could not initialize messaging in this browser.',
      };
    }

    const registration = await getFcmServiceWorkerRegistration();
    const token = await getToken(messagingInstance, {
      vapidKey: vapidKey!,
      serviceWorkerRegistration: registration,
    });

    if (!token) {
      return {
        ok: false,
        reason: 'no_token',
        message: 'Could not get a device token from Firebase. Try a hard refresh.',
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
    return {
      ok: false,
      reason: 'server_error',
      message: toSyncErrorMessage(error),
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
        message: 'Notification permission was not granted.',
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
