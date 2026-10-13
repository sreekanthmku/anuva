import { z } from 'zod';

/**
 * Medication reminders — set up in Profile, sent as a push at the times she chose.
 *
 * There is deliberately no name field: what she takes is hers to know, and a reminder works without
 * it. Whether it is a medication or a supplement is the only thing asked, and that is optional.
 *
 * A reminder is ongoing until she pauses or deletes it; there is no end date.
 */

export const medicationKindSchema = z.enum(['medication', 'supplement']);

/** `daily`; `weekdays` — the days in `weekdays`; `alternate` — every other day from the day it was set up. */
export const medicationDaysSchema = z.enum(['daily', 'weekdays', 'alternate']);

/** "HH:mm", 24-hour, in the reminder's own time zone. */
export const medicationTimeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use HH:mm');

export const MEDICATION_MAX_TIMES = 4;

/** Snooze is fixed rather than chosen, so the dose card stays three taps. */
export const MEDICATION_SNOOZE_MINUTES = 15;

/** One gentle follow-up when a reminder goes unanswered this long. */
export const MEDICATION_FOLLOW_UP_MINUTES = 30;

const reminderFields = {
  kind: medicationKindSchema.nullable(),
  times: z
    .array(medicationTimeSchema)
    .min(1)
    .max(MEDICATION_MAX_TIMES)
    .refine((times) => new Set(times).size === times.length, 'Each time can only be added once'),
  days: medicationDaysSchema,
  /// 0 = Sunday … 6 = Saturday. Only read when `days` is `weekdays`.
  weekdays: z.array(z.number().int().min(0).max(6)).max(7),
  /// IANA zone from her phone (`Intl.DateTimeFormat().resolvedOptions().timeZone`).
  timeZone: z.string().min(1).max(64),
};

function weekdaysChosen(body: { days?: string; weekdays?: number[] }): boolean {
  return body.days !== 'weekdays' || (body.weekdays?.length ?? 0) > 0;
}

export const createMedicationReminderBodySchema = z
  .object({ ...reminderFields, weekdays: reminderFields.weekdays.default([]) })
  .refine(weekdaysChosen, { message: 'Choose at least one day', path: ['weekdays'] });

/** Any subset; `active` pauses or resumes it. Changing the schedule moves `days` and `weekdays` together. */
export const updateMedicationReminderBodySchema = z
  .object({ ...reminderFields, active: z.boolean() })
  .partial()
  .refine(weekdaysChosen, { message: 'Choose at least one day', path: ['weekdays'] });

export const medicationReminderSchema = z.object({
  id: z.string(),
  kind: medicationKindSchema.nullable(),
  times: z.array(medicationTimeSchema),
  days: medicationDaysSchema,
  weekdays: z.array(z.number().int()),
  timeZone: z.string(),
  active: z.boolean(),
  createdAt: z.string(),
});

export const medicationRemindersResponseSchema = z.object({
  reminders: z.array(medicationReminderSchema),
});

/** `missed` is never stored: it is a dose still pending once her day has ended. */
export const medicationDoseStatusSchema = z.enum(['pending', 'taken', 'skipped', 'missed']);

export const medicationDoseSchema = z.object({
  id: z.string(),
  reminderId: z.string(),
  kind: medicationKindSchema.nullable(),
  /// The time as she set it ("08:00"), in the reminder's time zone.
  time: medicationTimeSchema,
  /// Her local day, YYYY-MM-DD.
  date: z.string(),
  scheduledFor: z.string(),
  status: medicationDoseStatusSchema,
  snoozedUntil: z.string().nullable(),
  /// Whether she can still answer it — only on the day it was for.
  answerable: z.boolean(),
});

export const medicationDosesResponseSchema = z.object({
  doses: z.array(medicationDoseSchema),
});

export const medicationDoseActionSchema = z.enum(['taken', 'skipped', 'snooze']);

export const respondMedicationDoseBodySchema = z.object({
  action: medicationDoseActionSchema,
});

export type MedicationKind = z.infer<typeof medicationKindSchema>;
export type MedicationDays = z.infer<typeof medicationDaysSchema>;
export type CreateMedicationReminderBody = z.infer<typeof createMedicationReminderBodySchema>;
export type UpdateMedicationReminderBody = z.infer<typeof updateMedicationReminderBodySchema>;
export type MedicationReminder = z.infer<typeof medicationReminderSchema>;
export type MedicationRemindersResponse = z.infer<typeof medicationRemindersResponseSchema>;
export type MedicationDoseStatus = z.infer<typeof medicationDoseStatusSchema>;
export type MedicationDose = z.infer<typeof medicationDoseSchema>;
export type MedicationDosesResponse = z.infer<typeof medicationDosesResponseSchema>;
export type MedicationDoseAction = z.infer<typeof medicationDoseActionSchema>;
export type RespondMedicationDoseBody = z.infer<typeof respondMedicationDoseBodySchema>;
