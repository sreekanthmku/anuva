import { z } from 'zod';

export const fcmPlatformSchema = z.enum(['WEB', 'ANDROID', 'IOS']);

export type FcmPlatform = z.infer<typeof fcmPlatformSchema>;

export const registerFcmBodySchema = z.object({
  fcmToken: z.string().trim().min(1),
  platform: fcmPlatformSchema.default('WEB'),
  deviceId: z.string().trim().min(1).max(128).optional(),
});

export type RegisterFcmBody = z.infer<typeof registerFcmBodySchema>;

export const registerFcmResponseSchema = z.object({
  ok: z.literal(true),
});

export type RegisterFcmResponse = z.infer<typeof registerFcmResponseSchema>;

export const unregisterFcmBodySchema = z.object({
  fcmToken: z.string().trim().min(1).optional(),
  deviceId: z.string().trim().min(1).max(128).optional(),
});

export type UnregisterFcmBody = z.infer<typeof unregisterFcmBodySchema>;

export const unregisterFcmResponseSchema = z.object({
  ok: z.literal(true),
});

export type UnregisterFcmResponse = z.infer<typeof unregisterFcmResponseSchema>;

export const pushBroadcastResponseSchema = z.object({
  ok: z.literal(true),
  title: z.string(),
  body: z.string(),
  targeted: z.number().int().nonnegative(),
  successCount: z.number().int().nonnegative(),
  failureCount: z.number().int().nonnegative(),
});

export type PushBroadcastResponse = z.infer<typeof pushBroadcastResponseSchema>;

// ─────────────────────────────────────────────
// Web Push (the transport that needs no Firebase SDK)
// ─────────────────────────────────────────────

/**
 * What a browser must be told before it can subscribe: which transport this deployment uses, and
 * the key to subscribe with. Served by `GET /push/config` so the choice can change without
 * releasing the apps — a device picks it up on its next launch.
 */
export const pushProviderSchema = z.enum(['fcm', 'webpush', 'both']);

export type PushProviderName = z.infer<typeof pushProviderSchema>;

export const pushConfigResponseSchema = z.object({
  provider: pushProviderSchema,
  /** The VAPID public key, base64url. Null when this deployment has none, i.e. FCM only. */
  vapidPublicKey: z.string().min(1).nullable(),
});

export type PushConfigResponse = z.infer<typeof pushConfigResponseSchema>;

/**
 * A `PushSubscription` as the browser produces it. `endpoint` is the push service URL and is the
 * identity of the subscription; the two keys encrypt the payload to this device alone.
 */
export const webPushSubscriptionSchema = z.object({
  endpoint: z.string().trim().url().max(2048),
  keys: z.object({
    p256dh: z.string().trim().min(1).max(256),
    auth: z.string().trim().min(1).max(256),
  }),
});

export type WebPushSubscriptionInput = z.infer<typeof webPushSubscriptionSchema>;

export const registerWebPushBodySchema = z.object({
  subscription: webPushSubscriptionSchema,
  platform: fcmPlatformSchema.default('WEB'),
  deviceId: z.string().trim().min(1).max(128).optional(),
});

export type RegisterWebPushBody = z.infer<typeof registerWebPushBodySchema>;

export const registerWebPushResponseSchema = z.object({ ok: z.literal(true) });

export type RegisterWebPushResponse = z.infer<typeof registerWebPushResponseSchema>;

/** Either identifier ends a subscription: the endpoint itself, or every one from a device. */
export const unregisterWebPushBodySchema = z.object({
  endpoint: z.string().trim().url().max(2048).optional(),
  deviceId: z.string().trim().min(1).max(128).optional(),
});

export type UnregisterWebPushBody = z.infer<typeof unregisterWebPushBodySchema>;

export const unregisterWebPushResponseSchema = z.object({ ok: z.literal(true) });

export type UnregisterWebPushResponse = z.infer<typeof unregisterWebPushResponseSchema>;
