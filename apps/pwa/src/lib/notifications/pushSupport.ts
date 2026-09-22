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

/**
 * The outcome plus the browser's own reason for it. The reason is the whole diagnosis:
 * `QuotaExceededError` means this origin is out of storage, `UnknownError` is WebKit's corrupted
 * database, `SecurityError` means storage is blocked for the site. One word tells us which.
 */
export type IndexedDbResult = { outcome: IndexedDbProbe; error?: string };

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
export async function probeIndexedDb(timeoutMs = 2000): Promise<IndexedDbResult> {
  if (typeof indexedDB === 'undefined') return { outcome: 'absent' };

  return new Promise<IndexedDbResult>((resolve) => {
    let settled = false;
    const finish = (value: IndexedDbResult) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };
    const timer = setTimeout(() => finish({ outcome: 'timeout' }), timeoutMs);
    const describe = (error: unknown) =>
      error instanceof DOMException ? `${error.name}: ${error.message}` : String(error ?? 'unknown');

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
        finish({ outcome: 'ok' });
      };
      request.onerror = () => {
        clearTimeout(timer);
        finish({ outcome: 'error', error: describe(request.error) });
      };
      request.onblocked = () => {
        clearTimeout(timer);
        finish({ outcome: 'blocked' });
      };
    } catch (error) {
      // `open()` throws synchronously when storage is denied outright.
      clearTimeout(timer);
      finish({ outcome: 'error', error: describe(error) });
    }
  });
}

/** How full this origin's storage is — the direct test of "are we out of room?". */
export async function storageEstimate(): Promise<Record<string, number> | null> {
  try {
    const estimate = await navigator.storage?.estimate?.();
    if (!estimate) return null;
    const usage = estimate.usage ?? 0;
    const quota = estimate.quota ?? 0;
    return {
      usageMb: Math.round((usage / 1e6) * 10) / 10,
      quotaMb: Math.round((quota / 1e6) * 10) / 10,
      percentUsed: quota ? Math.round((usage / quota) * 100) : 0,
    };
  } catch {
    return null;
  }
}

export type IndexedDbWait = { outcome: IndexedDbProbe; attempts: number; error?: string };

/**
 * Retries the open a few times before accepting that storage is unusable.
 *
 * The delays are short and few: this runs while someone is waiting for the app, and the WebKit
 * fault it works around clears within a second or two of launch.
 */
export async function waitForIndexedDb(
  delaysMs: number[] = [0, 400, 1200, 2500],
  probe: (timeoutMs?: number) => Promise<IndexedDbResult> = probeIndexedDb,
  sleep: (ms: number) => Promise<void> = (ms) => new Promise((r) => setTimeout(r, ms)),
): Promise<IndexedDbWait> {
  let result: IndexedDbResult = { outcome: 'absent' };

  for (const [attempt, delay] of delaysMs.entries()) {
    if (delay > 0) await sleep(delay);
    result = await probe();
    if (result.outcome === 'ok' || result.outcome === 'absent') {
      return { ...result, attempts: attempt + 1 };
    }
  }

  return { ...result, attempts: delaysMs.length };
}

/**
 * Deletes the caches this origin can rebuild, then reports whether storage came back.
 *
 * Only runtime caches go: the API responses and the library photos, both of which refetch. The
 * precache stays, because dropping it breaks the app offline. If the open was failing because the
 * origin was full, this is what makes room; if it was failing for any other reason, this changes
 * nothing and the caller learns that too.
 */
export async function purgeRebuildableCaches(): Promise<string[]> {
  if (typeof caches === 'undefined') return [];
  const rebuildable = ['api-cache', 'library-images'];
  const deleted: string[] = [];
  for (const name of rebuildable) {
    try {
      if (await caches.delete(name)) deleted.push(name);
    } catch {
      /* nothing we can do about a cache that refuses to go */
    }
  }
  return deleted;
}

/** Everything worth knowing when push is refused, in one object for a log. */
export async function describePushSupport(wait?: IndexedDbWait): Promise<Record<string, unknown>> {
  const missing = missingPushCapabilities();
  const result = wait ?? { ...(await probeIndexedDb()), attempts: 1 };
  return {
    missing,
    indexedDb: result.outcome,
    // The browser's own words — this is what names the cause.
    indexedDbError: result.error ?? null,
    indexedDbAttempts: result.attempts,
    storage: await storageEstimate(),
    cookieEnabled: typeof navigator === 'undefined' ? null : navigator.cookieEnabled,
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
