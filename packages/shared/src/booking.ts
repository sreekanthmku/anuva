import { z } from 'zod';

export const consultationStatusSchema = z.enum(['pending', 'confirmed', 'completed', 'cancelled']);

export type ConsultationStatus = z.infer<typeof consultationStatusSchema>;

export const consultationCallStatusSchema = z.enum(['waiting', 'active', 'ended', 'failed']);

export type ConsultationCallStatus = z.infer<typeof consultationCallStatusSchema>;

export const consultationRecordingStatusSchema = z.enum([
  'starting',
  'recording',
  'processing',
  'ready',
  'failed',
]);

export type ConsultationRecordingStatus = z.infer<typeof consultationRecordingStatusSchema>;

export const consultationSpecialistSchema = z.object({
  key: z.string().min(1),
  name: z.string().min(1),
  subtitle: z.string().nullable(),
  role: z.string().nullable(),
  specialization: z.string().nullable(),
  summary: z.string().nullable(),
  experience: z.string().nullable(),
  tag: z.string().nullable(),
  imageUrl: z.string().nullable(),
  qualifications: z.array(z.string()),
  bookable: z.boolean(),
  bookingDisabledReason: z.string().nullable(),
});

export type ConsultationSpecialist = z.infer<typeof consultationSpecialistSchema>;

export const consultationSpecialistsResponseSchema = z.array(consultationSpecialistSchema);

export type ConsultationSpecialistsResponse = z.infer<typeof consultationSpecialistsResponseSchema>;

export const consultationSlotsQuerySchema = z.object({
  specialistKey: z.string().trim().min(1),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  days: z.coerce.number().int().min(1).max(31),
});

export type ConsultationSlotsQuery = z.infer<typeof consultationSlotsQuerySchema>;

export const consultationSlotSchema = z.object({
  id: z.string(),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
});

export type ConsultationSlot = z.infer<typeof consultationSlotSchema>;

export const consultationSlotDateGroupSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  slots: z.array(consultationSlotSchema),
});

export type ConsultationSlotDateGroup = z.infer<typeof consultationSlotDateGroupSchema>;

export const consultationSlotsResponseSchema = z.object({
  specialistKey: z.string(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  days: z.number().int().min(1),
  dates: z.array(consultationSlotDateGroupSchema),
});

export type ConsultationSlotsResponse = z.infer<typeof consultationSlotsResponseSchema>;

export const createConsultationBookingBodySchema = z.object({
  slotId: z.string().min(1),
});

export type CreateConsultationBookingBody = z.infer<typeof createConsultationBookingBodySchema>;

export const consultationBookingResponseSchema = z.object({
  consultationId: z.string(),
  specialistKey: z.string(),
  specialistName: z.string(),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
});

export type ConsultationBookingResponse = z.infer<typeof consultationBookingResponseSchema>;

export const doctorConsultationBookingSchema = z.object({
  consultationId: z.string(),
  specialistKey: z.string(),
  specialistName: z.string(),
  patientId: z.string(),
  patientName: z.string().nullable(),
  patientPhone: z.string(),
  scheduledAt: z.string().datetime(),
  endsAt: z.string().datetime().nullable(),
  status: consultationStatusSchema,
  isFree: z.boolean(),
  createdAt: z.string().datetime(),
  callStatus: consultationCallStatusSchema.nullable(),
  recordingStatus: consultationRecordingStatusSchema.nullable(),
});

export type DoctorConsultationBooking = z.infer<typeof doctorConsultationBookingSchema>;

export const doctorConsultationBookingsResponseSchema = z.object({
  bookings: z.array(doctorConsultationBookingSchema),
});

export type DoctorConsultationBookingsResponse = z.infer<
  typeof doctorConsultationBookingsResponseSchema
>;

export const consultationCallRecordingSchema = z.object({
  status: consultationRecordingStatusSchema,
  storagePath: z.string().nullable(),
  startedAt: z.string().datetime().nullable(),
  completedAt: z.string().datetime().nullable(),
  durationSeconds: z.number().int().nonnegative().nullable(),
  errorMessage: z.string().nullable(),
});

export type ConsultationCallRecording = z.infer<typeof consultationCallRecordingSchema>;

export const consultationCallStateSchema = z.object({
  consultationId: z.string(),
  roomName: z.string().nullable(),
  status: consultationCallStatusSchema.nullable(),
  doctorStartedAt: z.string().datetime().nullable(),
  patientJoinedAt: z.string().datetime().nullable(),
  recordingStartedAt: z.string().datetime().nullable(),
  endedAt: z.string().datetime().nullable(),
  patientConsentRequired: z.boolean(),
  patientConsented: z.boolean(),
  recording: consultationCallRecordingSchema.nullable(),
});

export type ConsultationCallState = z.infer<typeof consultationCallStateSchema>;

export const consultationCallJoinResponseSchema = z.object({
  livekitUrl: z.string().url(),
  token: z.string().min(1),
  call: consultationCallStateSchema,
});

export type ConsultationCallJoinResponse = z.infer<typeof consultationCallJoinResponseSchema>;

export const consultationCallStateResponseSchema = z.object({
  call: consultationCallStateSchema,
});

export type ConsultationCallStateResponse = z.infer<typeof consultationCallStateResponseSchema>;

export const consultationCallConsentBodySchema = z.object({
  consentTextVersion: z.string().trim().min(1).default('recording-consent-v1'),
});

export type ConsultationCallConsentBody = z.infer<typeof consultationCallConsentBodySchema>;

export const consultationCallConsentResponseSchema = z.object({
  ok: z.literal(true),
  call: consultationCallStateSchema,
});

export type ConsultationCallConsentResponse = z.infer<
  typeof consultationCallConsentResponseSchema
>;

export const consultationCallEndResponseSchema = z.object({
  ok: z.literal(true),
  call: consultationCallStateSchema,
});

export type ConsultationCallEndResponse = z.infer<typeof consultationCallEndResponseSchema>;

export const createConsultationSlotsBodySchema = z.object({
  specialistKey: z.string().trim().min(1),
  slots: z
    .array(
      z.object({
        startsAt: z.string().datetime(),
        endsAt: z.string().datetime(),
      }),
    )
    .min(1),
});

export type CreateConsultationSlotsBody = z.infer<typeof createConsultationSlotsBodySchema>;

export const createConsultationSlotsResponseSchema = z.object({
  ok: z.literal(true),
  createdCount: z.number().int().nonnegative(),
});

export type CreateConsultationSlotsResponse = z.infer<typeof createConsultationSlotsResponseSchema>;

export const deleteConsultationSlotParamsSchema = z.object({
  id: z.string().min(1),
});

export type DeleteConsultationSlotParams = z.infer<typeof deleteConsultationSlotParamsSchema>;

export const deleteConsultationSlotResponseSchema = z.object({
  ok: z.literal(true),
});

export type DeleteConsultationSlotResponse = z.infer<typeof deleteConsultationSlotResponseSchema>;
