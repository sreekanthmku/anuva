/**
 * Which of the browser's push pieces is missing — and whether it is missing for good.
 *
 * Firebase's `isSupported()` folds six checks into one boolean, so "this browser does not support
 * push notifications" is where the investigation stops. On an installed iOS app that worked an hour
 * earlier, that message is simply wrong: everything is present and the permission is granted, but
 * `indexedDB.open()` refuses to complete for a few seconds after the app launches — a long-standing
 * WebKit fault in standalone web apps. Firebase reads that as "no push", permanently, from a
 * condition that clears itself.
 *
 * So the IndexedDB check is retried rather than believed the first time, and whatever is still
 * missing afterwards is reported precisely (to the console and Sentry) instead of as one word.
 */
export type PushCapability =
  | 'serviceWorker'
  | 'pushManager'
  | 'notification'
  | 'showNotification'
  | 'pushSubscriptionKeys'
  | 'indexedDB';

/** Why a database open did not succeed — the distinction matters: a hang is not a refusal. */
export type IndexedDbProbe = 'ok' | 'error' | 'blocked' | 'timeout' | 'absent';

type CapabilityHost = {
  navigator?: { serviceWorker?: unknown };
  PushManager?: unknown;
  Notification?: unknown;
  ServiceWorkerRegistration?: { prototype?: { showNotification?: unknown } };
  PushSubscription?: { prototype?: { getKey?: unknown } };
  indexedDB?: unknown;
};

const PROBE_DB = 'anuva-push-support-probe';

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

/** One attempt at opening a database. A hung open never fires an event, hence the timeout. */
export async function probeIndexedDb(timeoutMs = 2000): Promise<IndexedDbProbe> {
  if (typeof indexedDB === 'undefined') return 'absent';

  return new Promise<IndexedDbProbe>((resolve) => {
    let settled = false;
    const finish = (value: IndexedDbProbe) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };
    const timer = setTimeout(() => finish('timeout'), timeoutMs);

    try {
      const request = indexedDB.open(PROBE_DB);
      request.onsuccess = () => {
        clearTimeout(timer);
        try {
          request.result.close();
          indexedDB.deleteDatabase(PROBE_DB);
        } catch {
          /* leaving the probe database behind is harmless */
        }
        finish('ok');
      };
      request.onerror = () => {
        clearTimeout(timer);
        finish('error');
      };
      request.onblocked = () => {
        clearTimeout(timer);
        finish('blocked');
      };
    } catch {
      clearTimeout(timer);
      finish('error');
    }
  });
}

export type IndexedDbWait = { outcome: IndexedDbProbe; attempts: number };

/**
 * Retries the open a few times before accepting that storage is unusable.
 *
 * The delays are short and few: this runs while someone is waiting for the app, and the WebKit
 * fault it works around clears within a second or two of launch.
 */
export async function waitForIndexedDb(
  delaysMs: number[] = [0, 400, 1200, 2500],
  probe: (timeoutMs?: number) => Promise<IndexedDbProbe> = probeIndexedDb,
  sleep: (ms: number) => Promise<void> = (ms) => new Promise((r) => setTimeout(r, ms)),
): Promise<IndexedDbWait> {
  let outcome: IndexedDbProbe = 'absent';

  for (const [attempt, delay] of delaysMs.entries()) {
    if (delay > 0) await sleep(delay);
    outcome = await probe();
    if (outcome === 'ok') return { outcome, attempts: attempt + 1 };
    // Nothing to wait for: the API is not there at all.
    if (outcome === 'absent') return { outcome, attempts: attempt + 1 };
  }

  return { outcome, attempts: delaysMs.length };
}

/** Everything worth knowing when push is refused, in one object for a log. */
export async function describePushSupport(wait?: IndexedDbWait): Promise<Record<string, unknown>> {
  const missing = missingPushCapabilities();
  return {
    missing,
    indexedDb: wait?.outcome ?? (await probeIndexedDb()),
    indexedDbAttempts: wait?.attempts ?? 1,
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
