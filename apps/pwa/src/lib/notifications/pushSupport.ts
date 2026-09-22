/**
 * Which of the browser's push pieces is actually missing.
 *
 * Firebase's `isSupported()` folds six separate checks into one boolean, so "this browser does not
 * support push notifications" is where the investigation stops — on an installed iOS app that
 * worked an hour ago, that message says nothing useful. These helpers answer the next question:
 * *which* piece. The result goes to the console and to Sentry, so a device that starts refusing
 * push can be diagnosed without the phone in hand.
 *
 * The checks mirror the ones Firebase makes (see `isWindowSupported` in firebase/messaging).
 */
export type PushCapability =
  | 'serviceWorker'
  | 'pushManager'
  | 'notification'
  | 'showNotification'
  | 'pushSubscriptionKeys'
  | 'indexedDB';

type CapabilityHost = {
  navigator?: { serviceWorker?: unknown };
  PushManager?: unknown;
  Notification?: unknown;
  ServiceWorkerRegistration?: { prototype?: { showNotification?: unknown } };
  PushSubscription?: { prototype?: { getKey?: unknown } };
  indexedDB?: unknown;
};

/** The synchronous half: what the browser exposes at all. */
export function missingPushCapabilities(host: CapabilityHost = window): PushCapability[] {
  const missing: PushCapability[] = [];
  if (!host.navigator?.serviceWorker) missing.push('serviceWorker');
  if (!host.PushManager) missing.push('pushManager');
  if (!host.Notification) missing.push('notification');
  if (!host.ServiceWorkerRegistration?.prototype?.showNotification) missing.push('showNotification');
  if (!host.PushSubscription?.prototype?.getKey) missing.push('pushSubscriptionKeys');
  if (!host.indexedDB) missing.push('indexedDB');
  return missing;
}

/**
 * The asynchronous half: IndexedDB is *present* but refuses to open.
 *
 * This is the one that bites on iOS. WebKit can leave a web app's storage in a state where opening
 * a database fails or hangs, usually after the system has reclaimed storage — and Firebase treats
 * that as "push is not supported", which is how a working install starts claiming otherwise.
 */
export async function isIndexedDbOpenable(timeoutMs = 3000): Promise<boolean> {
  if (typeof indexedDB === 'undefined') return false;
  return new Promise<boolean>((resolve) => {
    let settled = false;
    const finish = (value: boolean) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };
    // A hung open never fires any event, so the timeout is the answer in that case.
    const timer = setTimeout(() => finish(false), timeoutMs);
    try {
      const request = indexedDB.open('anuva-push-support-probe');
      request.onsuccess = () => {
        clearTimeout(timer);
        request.result.close();
        try {
          indexedDB.deleteDatabase('anuva-push-support-probe');
        } catch {
          /* leaving the probe behind is harmless */
        }
        finish(true);
      };
      request.onerror = () => {
        clearTimeout(timer);
        finish(false);
      };
      request.onblocked = () => {
        clearTimeout(timer);
        finish(false);
      };
    } catch {
      clearTimeout(timer);
      finish(false);
    }
  });
}

/** Everything worth knowing when push is refused, in one line for a log. */
export async function describePushSupport(): Promise<Record<string, unknown>> {
  const missing = missingPushCapabilities();
  return {
    missing,
    indexedDbOpenable: missing.includes('indexedDB') ? false : await isIndexedDbOpenable(),
    standalone: isStandaloneDisplay(),
    permission: typeof Notification === 'undefined' ? 'unavailable' : Notification.permission,
    userAgent: typeof navigator === 'undefined' ? null : navigator.userAgent,
  };
}

/** Installed-app vs browser tab: on iOS, push exists only in the installed app. */
function isStandaloneDisplay(): boolean {
  if (typeof window === 'undefined') return false;
  if ((window.navigator as Navigator & { standalone?: boolean }).standalone === true) return true;
  if (typeof window.matchMedia !== 'function') return false;
  return ['(display-mode: standalone)', '(display-mode: fullscreen)', '(display-mode: minimal-ui)'].some(
    (query) => window.matchMedia(query).matches,
  );
}
