import { z } from 'zod';

/**
 * Sharing her reports with the doctor of one consultation — her detailed health assessment, her
 * 14-day assessment report, and her weekly and monthly reports.
 *
 * Works like notes: nothing is shared until she ticks it and agrees to a versioned notice
 * (`REPORT_SHARE_CONSENT_VERSION`), and each share freezes a copy of the report as it was at that
 * moment, so a log added later never changes what the doctor reads. She can take any share back
 * at any time — before, during or after the consultation. Taking it back removes the doctor's
 * access and deletes the frozen copy; a file the doctor already saved cannot be recalled, and the
 * notice says so.
 */

/** Consent to share the chosen reports with the doctor of one consultation. */
export const REPORT_SHARE_CONSENT_VERSION = 'reports-share-v1';

/** How many completed weeks and months back she is offered. */
export const REPORT_SHARE_WEEKS_OFFERED = 4;
export const REPORT_SHARE_MONTHS_OFFERED = 3;

export const reportShareKindSchema = z.enum([
  'detailed_assessment',
  'assessment_14day',
  'weekly',
  'monthly',
]);
export type ReportShareKind = z.infer<typeof reportShareKindSchema>;

const isoDay = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

/** A report she could share. `periodStart` and `periodEnd` are set for weekly and monthly only. */
export const shareableReportSchema = z.object({
  kind: reportShareKindSchema,
  periodStart: isoDay.nullable(),
  periodEnd: isoDay.nullable(),
});
export type ShareableReport = z.infer<typeof shareableReportSchema>;

/** A report she has shared with this consultation, as she sees it. */
export const consultationSharedReportSchema = shareableReportSchema.extend({
  shareId: z.string(),
  sharedAt: z.string(),
  /** She can take a report back at any time; false only on a cancelled consultation. */
  canRevoke: z.boolean(),
});
export type ConsultationSharedReport = z.infer<typeof consultationSharedReportSchema>;

export const consultationReportsResponseSchema = z.object({
  /** False once the consultation is over or cancelled: she can still take reports back, not add. */
  canShare: z.boolean(),
  shared: z.array(consultationSharedReportSchema),
  /** Reports she has that are not shared with this consultation yet. Empty when `canShare` is false. */
  available: z.array(shareableReportSchema),
});
export type ConsultationReportsResponse = z.infer<typeof consultationReportsResponseSchema>;

export const shareReportsBodySchema = z.object({
  reports: z
    .array(
      z.object({
        kind: reportShareKindSchema,
        /** Required for weekly and monthly: the first day of that week or month. */
        periodStart: isoDay.nullable().optional(),
      }),
    )
    .min(1)
    .max(REPORT_SHARE_WEEKS_OFFERED + REPORT_SHARE_MONTHS_OFFERED + 2),
  /** The version of the sharing notice she agreed to. */
  consentTextVersion: z.string().trim().min(1).max(40),
});
export type ShareReportsBody = z.infer<typeof shareReportsBodySchema>;

export const revokeReportShareResponseSchema = z.object({ ok: z.literal(true) });

/**
 * What the doctor sees in the list. The detailed assessment is not in it: it has its own view,
 * narrowed to the doctor's lens (`/doctor/consultations/:id/detailed-assessment`).
 */
export const doctorSharedReportSchema = z.object({
  shareId: z.string(),
  kind: reportShareKindSchema.exclude(['detailed_assessment']),
  periodStart: isoDay.nullable(),
  periodEnd: isoDay.nullable(),
  sharedAt: z.string(),
});
export type DoctorSharedReport = z.infer<typeof doctorSharedReportSchema>;

export const doctorSharedReportsResponseSchema = z.object({ reports: z.array(doctorSharedReportSchema) });
export type DoctorSharedReportsResponse = z.infer<typeof doctorSharedReportsResponseSchema>;
