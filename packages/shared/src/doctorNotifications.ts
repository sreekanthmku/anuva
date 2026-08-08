import { z } from 'zod';

export const doctorNotificationTypeSchema = z.enum([
  'consultation_booked',
  'consultation_cancelled',
  'consultation_rescheduled',
  'question_asked',
]);

export type DoctorNotificationType = z.infer<typeof doctorNotificationTypeSchema>;

export const doctorNotificationSchema = z.object({
  id: z.string(),
  type: doctorNotificationTypeSchema,
  title: z.string(),
  body: z.string(),
  url: z.string().nullable(),
  consultationId: z.string().nullable(),
  questionId: z.string().nullable(),
  readAt: z.string().nullable(),
  createdAt: z.string(),
});

export type DoctorNotification = z.infer<typeof doctorNotificationSchema>;

export const doctorNotificationsQuerySchema = z.object({
  /** Capped server-side; the portal only ever renders a recent window. */
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

export type DoctorNotificationsQuery = z.infer<typeof doctorNotificationsQuerySchema>;

export const doctorNotificationsResponseSchema = z.object({
  notifications: z.array(doctorNotificationSchema),
  unreadCount: z.number().int().nonnegative(),
});

export type DoctorNotificationsResponse = z.infer<typeof doctorNotificationsResponseSchema>;

/** No ids means "mark everything read", which is what opening the feed does. */
export const markDoctorNotificationsReadBodySchema = z.object({
  ids: z.array(z.string()).max(200).optional(),
});

export type MarkDoctorNotificationsReadBody = z.infer<typeof markDoctorNotificationsReadBodySchema>;

export const markDoctorNotificationsReadResponseSchema = z.object({
  ok: z.literal(true),
  unreadCount: z.number().int().nonnegative(),
});

export type MarkDoctorNotificationsReadResponse = z.infer<
  typeof markDoctorNotificationsReadResponseSchema
>;
