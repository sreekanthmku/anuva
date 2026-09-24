/**
 * Which push transport this deployment uses, and the keys it needs.
 *
 * Two transports exist because the Firebase JS SDK cannot be relied on. It keeps its token in
 * IndexedDB, and when that database will not open — a live WebKit fault on iOS — it reports that
 * the browser has no push at all, and an installed app simply stops being able to register. A
 * browser push subscription needs no database, so `webpush` survives that.
 *
 * The provider is read from the environment rather than compiled into the apps, and the clients ask
 * the API which one to use (`GET /push/config`). Flipping it is an env change and a restart: no app
 * release, and no waiting for a device to pick up a new bundle.
 */
export type PushProvider = 'fcm' | 'webpush' | 'both';

const PROVIDERS: PushProvider[] = ['fcm', 'webpush', 'both'];

/** Defaults to `fcm`, so deploying this changes nothing until someone chooses otherwise. */
export function pushProvider(): PushProvider {
  const raw = process.env.PUSH_PROVIDER?.trim().toLowerCase();
  return PROVIDERS.includes(raw as PushProvider) ? (raw as PushProvider) : 'fcm';
}

export function usesFcm(provider = pushProvider()): boolean {
  return provider === 'fcm' || provider === 'both';
}

export function usesWebPush(provider = pushProvider()): boolean {
  return provider === 'webpush' || provider === 'both';
}

export type VapidKeys = { publicKey: string; privateKey: string; subject: string };

/**
 * The VAPID keypair identifying this server to push services. Null when unset, which is how a
 * deployment that has not been given keys stays on FCM instead of failing to boot.
 *
 * Generate with: `npx web-push generate-vapid-keys`. The public key is handed to browsers; the
 * private key signs, and never leaves the server.
 */
export function vapidKeys(): VapidKeys | null {
  const publicKey = process.env.VAPID_PUBLIC_KEY?.trim();
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim();
  if (!publicKey || !privateKey) return null;

  // Push services reject a subject that is not a mailto: or https: URL, at send time rather than
  // at startup — so default to something valid rather than letting one through.
  const configured = process.env.VAPID_SUBJECT?.trim();
  const subject =
    configured && /^(mailto:|https:\/\/)/.test(configured) ? configured : 'mailto:support@anuvawellness.com';

  return { publicKey, privateKey, subject };
}

/** What a browser needs to know before it can subscribe: which transport, and the key to use. */
export function clientPushConfig(): { provider: PushProvider; vapidPublicKey: string | null } {
  const provider = pushProvider();
  const keys = vapidKeys();

  // Promising `webpush` without a key would leave the app unable to subscribe at all; fall back to
  // FCM and say so in the log, which is recoverable, rather than turning notifications off.
  if (usesWebPush(provider) && !keys) {
    return { provider: 'fcm', vapidPublicKey: null };
  }

  return { provider, vapidPublicKey: keys?.publicKey ?? null };
}

/** True when the configuration asks for Web Push but cannot deliver it — worth logging at boot. */
export function webPushMisconfigured(): boolean {
  return usesWebPush() && !vapidKeys();
}
