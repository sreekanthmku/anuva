/**
 * Sending over the standard Web Push protocol.
 *
 * The payload is ours end to end: encrypted with the subscription's own keys, delivered by whatever
 * push service the browser chose (Apple's, Google's, Mozilla's), and decrypted only on the device.
 * No Firebase in the path, on either side.
 *
 * A dead subscription is the one failure worth acting on. `404` and `410` from a push service mean
 * the browser threw it away — reinstalled, permission revoked, expired — and it will never work
 * again, so the row goes. Anything else (a 500 from the service, a timeout) is left alone: it may
 * well deliver next time, and deleting on a transient error silently unsubscribes people.
 */
import webpush, { type PushSubscription as WebPushSubscription } from 'web-push';
import { logger } from '../logger.js';
import { vapidKeys } from './config.js';

const log = logger.child({ module: 'web-push' });

/** A row from any of the three subscription tables, reduced to what sending needs. */
export type StoredSubscription = {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  deviceId?: string | null;
};

export type WebPushNotification = { title: string; body: string };

export type WebPushResult = {
  successCount: number;
  failureCount: number;
  /** Subscriptions the push service says are gone. The caller deletes them from its own table. */
  goneEndpoints: string[];
};

/** Notifications must stay displayable; iOS revokes permission for a push that shows nothing. */
const TTL_SECONDS = 4 * 60 * 60;

function toWebPushSubscription(row: StoredSubscription): WebPushSubscription {
  return { endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } };
}

/**
 * What the service worker receives. Deliberately the same shape the FCM path produces, so the
 * worker renders both identically and `data.url` keeps meaning what it means everywhere else.
 */
export function buildPayload(
  notification: WebPushNotification,
  data?: Record<string, string>,
): string {
  return JSON.stringify({
    // Marks this as ours, so the worker can tell it apart from anything Firebase delivers while
    // both transports are live.
    anuva: 1,
    notification: {
      title: notification.title,
      body: notification.body,
      icon: '/pwa-192.png',
      badge: '/pwa-192.png',
    },
    data: data ?? {},
  });
}

export async function sendWebPush(
  subscriptions: StoredSubscription[],
  notification: WebPushNotification,
  data?: Record<string, string>,
): Promise<WebPushResult> {
  const empty: WebPushResult = { successCount: 0, failureCount: 0, goneEndpoints: [] };
  if (subscriptions.length === 0) return empty;

  const keys = vapidKeys();
  if (!keys) {
    log.warn('VAPID keys are not configured — nothing sent');
    return { ...empty, failureCount: subscriptions.length };
  }

  const payload = buildPayload(notification, data);
  const options = {
    vapidDetails: { subject: keys.subject, publicKey: keys.publicKey, privateKey: keys.privateKey },
    TTL: TTL_SECONDS,
    headers: { Urgency: 'high' },
  };

  const results = await Promise.all(
    subscriptions.map(async (subscription) => {
      try {
        await webpush.sendNotification(toWebPushSubscription(subscription), payload, options);
        return { ok: true as const, endpoint: subscription.endpoint, gone: false };
      } catch (error) {
        const status = (error as { statusCode?: number }).statusCode;
        const gone = status === 404 || status === 410;
        if (!gone) {
          // Endpoints are device credentials, so the status is logged and the URL is not.
          log.warn({ status }, 'Web push delivery failed');
        }
        return { ok: false as const, endpoint: subscription.endpoint, gone };
      }
    }),
  );

  const goneEndpoints = results.filter((result) => result.gone).map((result) => result.endpoint);
  const successCount = results.filter((result) => result.ok).length;

  if (goneEndpoints.length > 0) {
    log.info({ gone: goneEndpoints.length }, 'Dropping subscriptions the push service has expired');
  }

  return { successCount, failureCount: results.length - successCount, goneEndpoints };
}

/**
 * Declarative Web Push — the payload Safari acts on by itself.
 *
 * `web_push: 8030` opts the message into declarative parsing (an homage to RFC 8030). Safari then
 * displays the notification without waking a service worker, and on a tap navigates to `navigate`
 * itself — skipping the `notificationclick` handler entirely. That matters because on iOS a tap
 * that reaches a backgrounded app leaves that handler unable to route it: `focus()` and
 * `postMessage()` on the window client silently do nothing (WebKit bug 268797, still open).
 *
 * Supported from iOS 18.4 and Safari 18.4. Browsers that do not understand it deliver the same
 * bytes to the service worker's `push` event instead, so the worker must be able to render this
 * shape as well — see the `push` listener in `firebase-messaging-sw.js`.
 *
 * Experimental: kept separate from `sendWebPush` until the behaviour when the app is already open
 * has been proved on a device.
 */
export function buildDeclarativePayload(
  notification: WebPushNotification,
  navigate: string,
): string {
  return JSON.stringify({
    web_push: 8030,
    notification: {
      title: notification.title,
      body: notification.body,
      navigate,
    },
    // Read by the service worker on platforms that do not act on the declarative shape.
    anuva: 1,
    data: { url: navigate },
  });
}

/** Sends a declarative push to one subscription. Used by the spike endpoint, not by features yet. */
export async function sendDeclarativeWebPush(
  subscriptions: StoredSubscription[],
  notification: WebPushNotification,
  navigate: string,
): Promise<WebPushResult> {
  const empty: WebPushResult = { successCount: 0, failureCount: 0, goneEndpoints: [] };
  if (subscriptions.length === 0) return empty;

  const keys = vapidKeys();
  if (!keys) {
    log.warn('VAPID keys are not configured — nothing sent');
    return { ...empty, failureCount: subscriptions.length };
  }

  const payload = buildDeclarativePayload(notification, navigate);
  const options = {
    vapidDetails: { subject: keys.subject, publicKey: keys.publicKey, privateKey: keys.privateKey },
    TTL: TTL_SECONDS,
    headers: { Urgency: 'high' },
  };

  const results = await Promise.all(
    subscriptions.map(async (subscription) => {
      try {
        await webpush.sendNotification(toWebPushSubscription(subscription), payload, options);
        return { ok: true as const, endpoint: subscription.endpoint, gone: false };
      } catch (error) {
        const status = (error as { statusCode?: number }).statusCode;
        log.warn({ status }, 'Declarative push delivery failed');
        return { ok: false as const, endpoint: subscription.endpoint, gone: status === 404 || status === 410 };
      }
    }),
  );

  return {
    successCount: results.filter((r) => r.ok).length,
    failureCount: results.filter((r) => !r.ok).length,
    goneEndpoints: results.filter((r) => r.gone).map((r) => r.endpoint),
  };
}
