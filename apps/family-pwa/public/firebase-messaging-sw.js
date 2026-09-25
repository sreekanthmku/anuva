/* eslint-disable no-undef */

/**
 * Which transport this deployment uses, taken from this worker's own URL.
 *
 * A worker is a static file: it cannot read `PUSH_PROVIDER`, which lives in the API's environment
 * and reaches the page through `GET /push/config`. So the page passes it on when it registers —
 * `/firebase-messaging-sw.js?provider=webpush` — and this worker reads it back off `self.location`.
 *
 * On `webpush` nothing below is loaded: no Firebase scripts fetched on every worker start, no
 * second `push` listener to render each message a second time, and no Firebase IndexedDB token
 * store — which matters because opening a database is exactly what fails on iOS when WebKit has
 * lost the origin's storage, and that is a fault this transport exists to route around.
 */
const PUSH_PROVIDER = new URL(self.location.href).searchParams.get('provider') || 'fcm';

if (PUSH_PROVIDER !== 'webpush') {
  importScripts('https://www.gstatic.com/firebasejs/11.6.0/firebase-app-compat.js');
  importScripts('https://www.gstatic.com/firebasejs/11.6.0/firebase-messaging-compat.js');
  importScripts('/firebase-config.js');
}

/**
 * Push delivered over the standard Web Push protocol — our own payload, no Firebase involved.
 *
 * Registered *before* `firebase.messaging()` below, which matters: listeners run in registration
 * order, so this one gets the event first and stops it there.
 *
 * It has to. The Firebase worker installs its own `push` listener, and that listener does not check
 * whether a push came from FCM — `getMessagePayloadInternal` accepts any JSON at all, and then
 * displays it if it has a `notification` field. Ours does. So every Web Push message was rendered
 * twice: once here and once by Firebase. Worse with the app open, where Firebase forwards the same
 * payload into the page as an `onMessage` and the foreground handler drew a third.
 *
 * Only our own messages are stopped. Anything without the `anuva` marker falls through to Firebase
 * untouched, so the FCM transport and the `both` migration mode keep working.
 *
 * iOS revokes a site's permission for a push that displays nothing, so anything of ours still shows
 * something rather than returning silently.
 */
self.addEventListener('push', (event) => {
  if (!event.data) return;

  let payload = null;
  try {
    payload = event.data.json();
  } catch (e) {
    payload = null;
  }

  // Not ours: Firebase's own handler will display it, or it is not something we can render.
  if (!payload || payload.anuva !== 1) return;

  // Ours, and displayed here — keep it away from Firebase's listener, which would show it again.
  event.stopImmediatePropagation();

  const notification = payload.notification || {};
  const data = payload.data || {};

  event.waitUntil(
    self.registration.showNotification(notification.title || 'Anuva Family', {
      body: notification.body || '',
      icon: notification.icon || '/pwa-192.png',
      badge: notification.badge || '/pwa-192.png',
      data,
    }),
  );
});

/**
 * Take over as soon as a new version of this worker is deployed.
 *
 * Without this, an updated worker sits in `waiting` until every window of the app is closed, so the
 * page keeps talking to the previous version. On iOS that mismatch is worse than stale code: the
 * push subscription belonging to the old worker is dropped, and re-subscribing fails with
 * "push service initialization failed" until the app is fully restarted. Activating straight away
 * keeps one version in play. Nothing is controlled by this scope but the push endpoint, so claiming
 * clients cannot disturb a page the workbox worker owns.
 */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

if (PUSH_PROVIDER !== 'webpush' && self.FIREBASE_WEB_CONFIG?.apiKey) {
  firebase.initializeApp(self.FIREBASE_WEB_CONFIG);
  const messaging = firebase.messaging();

  messaging.onBackgroundMessage((payload) => {
    // A push with a `notification` block is already displayed by the Firebase SDK before this
    // handler runs; showing it again produced two notifications per push. Only data-only pushes
    // need us to display them.
    if (payload.notification) return;
    self.registration.showNotification(payload.data?.title || 'Anuva Family', {
      body: payload.data?.body || '',
      icon: '/pwa-192.png',
      badge: '/pwa-192.png',
      data: payload.data || {},
    });
  });
}

/**
 * The deep link arrives in one of two shapes. When the push carries a `notification` block the
 * Firebase SDK displays it itself and nests the original message under `FCM_MSG`; when it is a
 * data-only push our own onBackgroundMessage shows it and `data` comes through flat.
 */
function resolveDeepLink(notification) {
  const data = notification.data || {};
  const nested = data.FCM_MSG || {};

  return (
    data.url ||
    nested.data?.url ||
    nested.notification?.click_action ||
    nested.fcmOptions?.link ||
    '/'
  );
}

/**
 * Hands the destination to the app through Cache Storage as well as posting it.
 *
 * A backgrounded web app on iOS is frozen, and a message posted to it is dropped rather than
 * queued — so the tap brought the app forward on the screen it was already on and the deep link was
 * lost. Cache Storage survives that freeze, and the app collects this when it wakes. See
 * `src/lib/pwa/pendingNavigation.ts`.
 */
async function rememberPendingLink(path) {
  try {
    const cache = await caches.open('anuva-pending-nav');
    await cache.put(
      '/__pending-navigation',
      new Response(JSON.stringify({ url: path, at: Date.now() }), {
        headers: { 'Content-Type': 'application/json' },
      }),
    );
  } catch (e) {
    // Storage unavailable: the posted message below is still the fast path.
  }
}

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = resolveDeepLink(event.notification);
  const target = new URL(url, self.location.origin).href;

  event.waitUntil(
    (async () => {
      const clientList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });

      const parsed = new URL(url, self.location.origin);
      const path =
        parsed.origin === self.location.origin
          ? parsed.pathname + parsed.search + parsed.hash
          : '/';

      // Reuse an open window rather than opening a second one. `client.navigate()` is unreliable
      // here — the page is controlled by the workbox SW, not this one — so focus it, and hand the
      // destination over both ways: stored for a frozen app that wakes up (iOS), posted for one
      // that is merely hidden and still running.
      for (const client of clientList) {
        if ('focus' in client) {
          try {
            await rememberPendingLink(path);
            await client.focus();
            client.postMessage({ type: 'family-navigate', url: path });
            return;
          } catch (e) {
            // focus() can be refused (iOS is strict about it). Fall through and open a window,
            // where the destination rides in the URL instead.
            break;
          }
        }
      }

      if (self.clients.openWindow) {
        await self.clients.openWindow(target);
      }
    })(),
  );
});
