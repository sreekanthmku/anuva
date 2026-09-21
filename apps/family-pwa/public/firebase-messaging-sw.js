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

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = resolveDeepLink(event.notification);
  const target = new URL(url, self.location.origin).href;

  event.waitUntil(
    (async () => {
      const clientList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });

      // Reuse an open window rather than opening a second one. `client.navigate()` is unreliable
      // here — the page is controlled by the workbox SW, not this one — so focus it and let the
      // router do the navigation from the posted message.
      for (const client of clientList) {
        if ('focus' in client) {
          await client.focus();
          const parsed = new URL(url, self.location.origin);
          const path =
            parsed.origin === self.location.origin
              ? parsed.pathname + parsed.search + parsed.hash
              : '/';
          client.postMessage({ type: 'family-navigate', url: path });
          return;
        }
      }

      if (self.clients.openWindow) {
        await self.clients.openWindow(target);
      }
    })(),
  );
});
