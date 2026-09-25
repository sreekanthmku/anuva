/**
 * The notification destination, handed from the service worker to the app through Cache Storage.
 *
 * Tapping a notification while the app is merely *backgrounded* used to post the destination to the
 * router and trust it to arrive. On iOS it does not: a backgrounded web app is frozen, and a
 * `client.postMessage` sent to it is dropped rather than queued. The app came forward on whatever
 * screen it was left on and the note never opened — while a *closed* app worked, because there the
 * worker opens a URL and the destination rides in the address bar.
 *
 * Cache Storage is shared between the worker and the page and survives the freeze, so the worker
 * leaves the destination there and the page collects it when it wakes. The posted message stays as
 * the fast path where it works; whichever arrives first clears the other.
 */
const CACHE = 'anuva-pending-nav';
const KEY = '/__pending-navigation';

/** Older than this and the tap is no longer what the person is doing now. */
const FRESH_MS = 2 * 60 * 1000;

type Stored = { url: string; at: number };

/** Exported for tests: the freshness rule, without the Cache Storage plumbing. */
export function parsePending(raw: string | null, now = Date.now()): string | null {
  if (!raw) return null;
  try {
    const { url, at } = JSON.parse(raw) as Stored;
    // A path on this origin, nothing else: `//evil.com` is protocol-relative and would navigate
    // off-site if the router ever handed it to the browser.
    if (typeof url !== 'string' || !url.startsWith('/') || url.startsWith('//')) return null;
    if (typeof at !== 'number' || now - at > FRESH_MS) return null;
    return url;
  } catch {
    return null;
  }
}

/**
 * One tap, one navigation.
 *
 * Both routes to a destination run at the same moment on resume: the posted message, and the stored
 * copy read back from Cache Storage. Clearing the store is asynchronous, so the read could win and
 * the app navigated to the same deep link twice. The second one re-added the `#familyMessage=…`
 * fragment, which re-opened the card — and if it landed after she had tapped "thank you", the card
 * she had just dismissed came straight back and the button looked broken.
 *
 * So the destination itself is remembered, and whichever route gets there first wins.
 */
const HANDLED_FOR_MS = 60_000;

let lastHandled: { url: string; at: number } | null = null;

export function markNavigationHandled(url: string): void {
  lastHandled = { url, at: Date.now() };
}

export function alreadyHandled(url: string, now = Date.now()): boolean {
  if (!lastHandled || lastHandled.url !== url) return false;
  // A genuinely new notification to the same place, much later, is not a duplicate.
  return now - lastHandled.at < HANDLED_FOR_MS;
}

/**
 * Reads the destination and clears it in the same breath, so a second wake-up does not navigate
 * again. Returns null when there is nothing pending, which is the common case.
 */
export async function takePendingNavigation(): Promise<string | null> {
  if (typeof caches === 'undefined') return null;
  try {
    const cache = await caches.open(CACHE);
    const response = await cache.match(KEY);
    if (!response) return null;
    await cache.delete(KEY);
    const url = parsePending(await response.text());
    // The posted message may have taken this destination already, moments ago.
    if (!url || alreadyHandled(url)) return null;
    markNavigationHandled(url);
    return url;
  } catch {
    // Private mode, evicted storage, no Cache API: the posted message is still the fast path.
    return null;
  }
}

/** Drops anything pending — called when the posted message got there first. */
export async function clearPendingNavigation(): Promise<void> {
  if (typeof caches === 'undefined') return;
  try {
    const cache = await caches.open(CACHE);
    await cache.delete(KEY);
  } catch {
    /* nothing to clear */
  }
}
