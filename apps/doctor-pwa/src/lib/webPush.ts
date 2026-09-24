/**
 * Subscribing to notifications without Firebase.
 *
 * `pushManager.subscribe()` is the browser's own API: it needs a service worker and a VAPID key,
 * and nothing else. In particular it needs no IndexedDB, which is the whole point — the Firebase
 * SDK keeps its token in a database, and when WebKit refuses to open that database (a live iOS
 * fault) it reports that push is unsupported and an installed app can no longer register at all.
 *
 * Which transport this deployment uses comes from the API, not the build, so switching does not
 * require releasing the app. See `apps/api/src/push/config.ts`.
 */
import { apiFetch } from './api';

export type PushConfig = { provider: 'fcm' | 'webpush' | 'both'; vapidPublicKey: string | null };

/**
 * The VAPID key travels as base64url text and `subscribe()` wants bytes.
 * Exported for tests: getting this wrong fails deep inside the browser with an opaque error.
 */
export function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
  const normalised = padded.replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(normalised);
  return Uint8Array.from(raw, (char) => char.charCodeAt(0));
}

let cached: PushConfig | null = null;

/** Asked once per app start; a transport change is picked up on the next launch. */
export async function fetchPushConfig(): Promise<PushConfig> {
  if (cached) return cached;
  cached = await apiFetch<PushConfig>('/api/push/config');
  return cached;
}

export function webPushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

/** The shape the API stores: the endpoint, and the two keys that encrypt a payload to this device. */
export type SerializedSubscription = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
};

export function serializeSubscription(subscription: PushSubscription): SerializedSubscription | null {
  const json = subscription.toJSON();
  const p256dh = json.keys?.p256dh;
  const auth = json.keys?.auth;
  if (!json.endpoint || !p256dh || !auth) return null;
  return { endpoint: json.endpoint, keys: { p256dh, auth } };
}

/**
 * Subscribes this browser and registers it with the API.
 *
 * An existing subscription is reused unless it was issued for a different key — which happens when
 * the server's VAPID keypair changes, and leaves a subscription that can never be delivered to, so
 * it is replaced rather than kept.
 */
export async function subscribeToWebPush(
  registration: ServiceWorkerRegistration,
  vapidPublicKey: string,
  registerPath: string,
  deviceId: string,
): Promise<SerializedSubscription> {
  const applicationServerKey = urlBase64ToUint8Array(vapidPublicKey);

  let subscription = await registration.pushManager.getSubscription();
  if (subscription && !sameKey(subscription, applicationServerKey)) {
    await subscription.unsubscribe().catch(() => undefined);
    subscription = null;
  }

  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      // Required, and true in fact: every push this app sends shows a notification. iOS revokes
      // permission from a site whose push displays nothing.
      userVisibleOnly: true,
      applicationServerKey: applicationServerKey as BufferSource,
    });
  }

  const serialized = serializeSubscription(subscription);
  if (!serialized) throw new Error('The browser returned a subscription without keys.');

  await apiFetch(registerPath, {
    method: 'POST',
    body: JSON.stringify({
      subscription: serialized,
      platform: 'WEB',
      deviceId,
    }),
  });

  return serialized;
}

/** True when an existing subscription was issued for this same server key. */
function sameKey(subscription: PushSubscription, applicationServerKey: Uint8Array): boolean {
  const existing = subscription.options?.applicationServerKey;
  if (!existing) return false;
  const bytes = new Uint8Array(existing as ArrayBuffer);
  if (bytes.length !== applicationServerKey.length) return false;
  return bytes.every((byte, index) => byte === applicationServerKey[index]);
}
