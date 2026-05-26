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
