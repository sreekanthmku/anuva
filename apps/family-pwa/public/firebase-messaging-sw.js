/* eslint-disable no-undef */
importScripts('https://www.gstatic.com/firebasejs/11.6.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/11.6.0/firebase-messaging-compat.js');
importScripts('/firebase-config.js');

if (self.FIREBASE_WEB_CONFIG?.apiKey) {
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
