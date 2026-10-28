import { deleteFirebaseDatabases, purgeRebuildableCaches } from './notifications/pushSupport';
import { clearPendingNavigation } from './pwa/pendingNavigation';
import { setSentryUser } from './sentry';

/**
 * Leaves this device holding nothing of hers: on sign-out, and the first time the app finds her
 * session gone after it had one (which is how a completed account deletion shows up here — the
 * erasure runs on the server while she is away, and the next request is simply refused).
 *
 * What goes:
 *   - the browser's push subscription, so nothing more of hers arrives on this phone;
 *   - the runtime caches (API responses, library photos) and any notification link waiting to open;
 *   - Firebase's IndexedDB databases (push token and keys from the FCM days);
 *   - all of sessionStorage — her assessment answers and score among it;
 *   - all of localStorage except the chosen language, which is a setting of the device rather than
 *     of her account, so the sign-in screen still speaks it. The device id goes with the rest, so a
 *     new account here starts on a new id rather than one tied to hers;
 *   - the error-reporting user.
 *
 * What stays: the precached app shell (dropping it breaks the app offline) and the service workers.
 * The server side of sign-out — her session, and this device's push rows — is the logout request's
 * job, made before this runs while she is still signed in.
 *
 * Every step is best-effort: one storage area refusing must not stop the others.
 */

const KEEP_KEYS = ['anuva.lang'];

/** Set while someone is signed in here, so a later refusal can tell "signed out" from "never was". */
const HAD_SESSION_KEY = 'anuva-had-session';

export function markSignedIn(): void {
  try {
    localStorage.setItem(HAD_SESSION_KEY, '1');
  } catch {
    /* storage blocked: the wipe on a lost session just will not run here */
  }
}

export function wasSignedIn(): boolean {
  try {
    return localStorage.getItem(HAD_SESSION_KEY) === '1';
  } catch {
    return false;
  }
}

async function unsubscribePush(): Promise<void> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
  const registrations = await navigator.serviceWorker.getRegistrations();
  await Promise.allSettled(
    registrations.map(async (registration) => {
      const subscription = await registration.pushManager?.getSubscription();
      await subscription?.unsubscribe();
    }),
  );
}

export async function wipeDeviceData(): Promise<void> {
  setSentryUser(null);

  await Promise.allSettled([
    unsubscribePush(),
    purgeRebuildableCaches(),
    clearPendingNavigation(),
    deleteFirebaseDatabases(),
  ]);

  try {
    sessionStorage.clear();
  } catch {
    /* blocked */
  }

  try {
    const kept = KEEP_KEYS.map((key) => [key, localStorage.getItem(key)] as const);
    localStorage.clear();
    for (const [key, value] of kept) {
      if (value !== null) localStorage.setItem(key, value);
    }
  } catch {
    /* blocked */
  }
}
