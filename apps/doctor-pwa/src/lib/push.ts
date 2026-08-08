import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getMessaging, getToken, isSupported, onMessage, type Messaging } from 'firebase/messaging';
import { apiFetch } from './api';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY as string | undefined,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string | undefined,
  appId: import.meta.env.VITE_FIREBASE_APP_ID as string | undefined,
};

const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY as string | undefined;

const DEVICE_ID_KEY = 'anuva-doctor-device-id';
const TOKEN_KEY = 'anuva-doctor-fcm-token';
const FCM_SW_URL = '/firebase-messaging-sw.js';
const FCM_SW_SCOPE = '/firebase-cloud-messaging-push-scope/';

let app: FirebaseApp | null = null;
let messaging: Messaging | null = null;

export type PushResult =
  | { ok: true; token: string }
  | {
      ok: false;
      reason: 'not_configured' | 'unsupported' | 'not_granted' | 'no_token' | 'server_error';
      message: string;
    };

export function isPushConfigured(): boolean {
  return Boolean(
    firebaseConfig.apiKey &&
      firebaseConfig.projectId &&
      firebaseConfig.messagingSenderId &&
      firebaseConfig.appId &&
      vapidKey,
  );
}

export function pushPermission(): NotificationPermission | 'unavailable' {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unavailable';
  }

  return Notification.permission;
}

function getDeviceId(): string {
  try {
    const existing = localStorage.getItem(DEVICE_ID_KEY);
    if (existing) {
      return existing;
    }

    const id = crypto.randomUUID();
    localStorage.setItem(DEVICE_ID_KEY, id);
    return id;
  } catch {
    return crypto.randomUUID();
  }
}

function getFirebaseApp(): FirebaseApp {
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

/**
 * The FCM worker runs in its own scope. `getRegistration(scope)` returns whichever registration
 * *contains* the path, and the workbox SW at `/` contains it — binding the token to a worker with
 * no push handler, which silently drops every notification. So only a registration actually
 * running the FCM script counts; anything else is re-registered explicitly.
 */
async function getFcmRegistration(): Promise<ServiceWorkerRegistration> {
  if (!('serviceWorker' in navigator)) {
    throw new Error('Service workers are not supported in this browser.');
  }

  const existing = await navigator.serviceWorker.getRegistration(FCM_SW_SCOPE);
  const worker = existing?.active ?? existing?.waiting ?? existing?.installing;
  const registration = worker?.scriptURL.endsWith(FCM_SW_URL)
    ? (existing as ServiceWorkerRegistration)
    : await navigator.serviceWorker.register(FCM_SW_URL, { scope: FCM_SW_SCOPE });

  if (!registration.active) {
    const pending = registration.installing ?? registration.waiting;
    if (pending) {
      await new Promise<void>((resolve) => {
        pending.addEventListener('statechange', () => {
          if (pending.state === 'activated') {
            resolve();
          }
        });
      });
    }
  }

  return registration;
}

/** Android Chrome refuses a fresh subscribe while a stale one (old VAPID key) is still bound. */
async function clearStaleSubscriptions(fcmRegistration: ServiceWorkerRegistration): Promise<void> {
  const registrations = new Set<ServiceWorkerRegistration>([fcmRegistration]);
  try {
    const root = await navigator.serviceWorker.getRegistration('/');
    if (root) registrations.add(root);
  } catch {
    /* ignore */
  }

  await Promise.all(
    [...registrations].map(async (registration) => {
      try {
        const sub = await registration.pushManager.getSubscription();
        if (sub) await sub.unsubscribe();
      } catch {
        /* ignore */
      }
    }),
  );
}

async function obtainAndRegisterToken(): Promise<PushResult> {
  if (!isPushConfigured()) {
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
    return { ok: false, reason: 'not_granted', message: 'Notification permission is not granted.' };
  }

  try {
    const instance = await getFirebaseMessaging();
    if (!instance) {
      return {
        ok: false,
        reason: 'unsupported',
        message: 'Could not start messaging in this browser.',
      };
    }

    const registration = await getFcmRegistration();

    let token: string;
    try {
      token = await getToken(instance, { vapidKey: vapidKey!, serviceWorkerRegistration: registration });
    } catch {
      await clearStaleSubscriptions(registration);
      token = await getToken(instance, { vapidKey: vapidKey!, serviceWorkerRegistration: registration });
    }

    if (!token) {
      return { ok: false, reason: 'no_token', message: 'Firebase did not return a device token.' };
    }

    await apiFetch('/api/doctor/push/register', {
      method: 'POST',
      body: JSON.stringify({ fcmToken: token, platform: 'WEB', deviceId: getDeviceId() }),
    });

    try {
      localStorage.setItem(TOKEN_KEY, token);
    } catch {
      /* ignore */
    }

    return { ok: true, token };
  } catch (error) {
    return {
      ok: false,
      reason: 'server_error',
      message: error instanceof Error ? error.message : 'Could not save this device.',
    };
  }
}

/** Asks for permission if it has not been decided yet, then registers the device. */
export async function enableDoctorPush(): Promise<PushResult> {
  if (!('Notification' in window)) {
    return {
      ok: false,
      reason: 'unsupported',
      message: 'This browser does not support notifications.',
    };
  }

  if (Notification.permission === 'default') {
    await Notification.requestPermission();
  }

  if (Notification.permission !== 'granted') {
    return {
      ok: false,
      reason: 'not_granted',
      message:
        'Notifications are blocked for this site. Allow them in your browser settings, then try again.',
    };
  }

  return obtainAndRegisterToken();
}

export async function disableDoctorPush(): Promise<void> {
  const token = (() => {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  })();

  await apiFetch('/api/doctor/push/unregister', {
    method: 'POST',
    body: JSON.stringify({ ...(token ? { fcmToken: token } : {}), deviceId: getDeviceId() }),
  }).catch(() => undefined);

  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore */
  }
}

export function hasRegisteredDevice(): boolean {
  try {
    return Boolean(localStorage.getItem(TOKEN_KEY));
  } catch {
    return false;
  }
}

/**
 * Re-registers on load when permission is already granted. FCM tokens rotate, and a token the
 * server has not seen since is a device that silently stops receiving anything.
 */
export async function syncDoctorPushIfGranted(): Promise<PushResult | null> {
  if (!isPushConfigured() || pushPermission() !== 'granted') {
    return null;
  }

  return obtainAndRegisterToken();
}

/** Foreground pushes never raise a system notification, so the portal refreshes its own feed. */
export function onForegroundPush(handler: () => void): () => void {
  if (!isPushConfigured()) {
    return () => {};
  }

  let unsubscribe: (() => void) | null = null;

  void getFirebaseMessaging().then((instance) => {
    if (!instance) return;
    unsubscribe = onMessage(instance, () => handler());
  });

  return () => unsubscribe?.();
}
