/* eslint-disable no-undef */
importScripts('https://www.gstatic.com/firebasejs/11.6.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/11.6.0/firebase-messaging-compat.js');
importScripts('/firebase-config.js');

if (self.FIREBASE_WEB_CONFIG?.apiKey) {
  firebase.initializeApp(self.FIREBASE_WEB_CONFIG);
  const messaging = firebase.messaging();

  messaging.onBackgroundMessage((payload) => {
    const title = payload.notification?.title || 'Anuva';
    const options = {
      body: payload.notification?.body || '',
      icon: '/pwa-192.png',
      badge: '/pwa-192.png',
      data: payload.data || {},
    };
    self.registration.showNotification(title, options);
  });
}

/**
 * The deep link arrives in one of two shapes. When the push carries a `notification` block the
 * Firebase SDK displays it itself and nests the original message under `FCM_MSG`; when it is a
 * data-only push our own onBackgroundMessage shows it and `data` is passed through untouched.
 * Reading only the flat shape is why clicks used to land on /home.
 */
function resolveDeepLink(notification) {
  const data = notification.data || {};
  const nested = data.FCM_MSG || {};

  return (
    data.url ||
    nested.data?.url ||
    nested.notification?.click_action ||
    nested.fcmOptions?.link ||
    '/home'
  );
}

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = resolveDeepLink(event.notification);
  const target = new URL(url, self.location.origin).href;

  event.waitUntil(
    (async () => {
      const clientList = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      });

      // Reuse an open PWA window: focus it, then let the app router do the navigation.
      //
      // client.navigate() is not reliable here — the page is controlled by the workbox
      // `sw.js`, not by this one, and navigate() only works on clients this worker
      // controls. Nudges never hit this branch (they fire while the app is closed and take
      // the openWindow path below), so the failure only ever showed up on call pushes,
      // which arrive with the patient tab already open. Post to the router instead, which
      // routes in-app and avoids a full reload.
      for (const client of clientList) {
        if ('focus' in client) {
          await client.focus();
          client.postMessage({ type: 'nudge-navigate', url });
          return;
        }
      }

      if (self.clients.openWindow) {
        await self.clients.openWindow(target);
      }
    })(),
  );
});
