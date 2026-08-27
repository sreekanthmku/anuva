import { z } from 'zod';

/**
 * Joints & Stiffness — the one tracker with no nudge behind it.
 *
 * Every other daily metric is answered through the nudge engine, which owns the
 * question text and the slot it fires in. This one is only ever reached from the
 * Track page's Body section, so its questions, options and labels live here
 * instead of in the nudge registry — and nothing schedules or sends it.
 *
 * Labels are shared rather than left to the client because the weekly summary
 * names the most affected area and the most common symptom in prose, and the
 * report must not invent a second vocabulary for the same answers.
 */

export const jointSeveritySchema = z.enum(['none', 'mild', 'moderate', 'severe']);

export const jointAreaSchema = z.enum([
  'neck',
  'shoulders',
  'elbows',
  'hands_wrists_fingers',
  'lower_back',
  'hips',
  'knees',
  'ankles_feet',
  'multiple_areas',
  'other',
]);

export const jointSymptomSchema = z.enum([
  'aching',
  'pain',
  'stiffness',
  'swelling',
  'tenderness',
  'reduced_movement',
]);

export const jointImpactSchema = z.enum(['not_at_all', 'a_little', 'moderately', 'a_lot']);

export const jointTimeOfDaySchema = z.enum([
  'on_waking',
  'morning',
  'afternoon',
  'evening',
  'night',
  'throughout_day',
]);

export const jointTriggerSchema = z.enum([
  'poor_sleep',
  'stress',
  'long_sitting',
  'exercise',
  'cycle_changes',
  'cold_weather',
  'previous_injury',
  'not_sure',
  'other',
]);

export const JOINT_SEVERITY_LABELS: Record<z.infer<typeof jointSeveritySchema>, string> = {
  none: 'No discomfort',
  mild: 'Mild discomfort',
  moderate: 'Moderate discomfort',
  severe: 'Severe discomfort',
};

export const JOINT_AREA_LABELS: Record<z.infer<typeof jointAreaSchema>, string> = {
  neck: 'Neck',
  shoulders: 'Shoulders',
  elbows: 'Elbows',
  hands_wrists_fingers: 'Hands / Wrists / Fingers',
  lower_back: 'Lower back',
  hips: 'Hips',
  knees: 'Knees',
  ankles_feet: 'Ankles / Feet',
  multiple_areas: 'Multiple areas',
  other: 'Other',
};

export const JOINT_SYMPTOM_LABELS: Record<z.infer<typeof jointSymptomSchema>, string> = {
  aching: 'Aching',
  pain: 'Pain',
  stiffness: 'Stiffness',
  swelling: 'Swelling',
  tenderness: 'Tenderness',
  reduced_movement: 'Reduced movement',
};

export const JOINT_IMPACT_LABELS: Record<z.infer<typeof jointImpactSchema>, string> = {
  not_at_all: 'Not at all',
  a_little: 'A little',
  moderately: 'Moderately',
  a_lot: 'A lot',
};

export const JOINT_TIME_OF_DAY_LABELS: Record<z.infer<typeof jointTimeOfDaySchema>, string> = {
  on_waking: 'On waking',
  morning: 'Morning',
  afternoon: 'Afternoon',
  evening: 'Evening',
  night: 'Night',
  throughout_day: 'Throughout the day',
};

export const JOINT_TRIGGER_LABELS: Record<z.infer<typeof jointTriggerSchema>, string> = {
  poor_sleep: 'Poor sleep',
  stress: 'Stress',
  long_sitting: 'Long sitting',
  exercise: 'Exercise or physical activity',
  cycle_changes: 'Period or cycle changes',
  cold_weather: 'Cold weather',
  previous_injury: 'Previous injury',
  not_sure: 'Not sure',
  other: 'Other',
};

/** Q1 answer, 0..3. The severity half of the internal discomfort score. */
export const JOINT_SEVERITY_SCORES: Record<z.infer<typeof jointSeveritySchema>, number> = {
  none: 0,
  mild: 1,
  moderate: 2,
  severe: 3,
};

/** Q4 answer, 0..3. The impact half. */
export const JOINT_IMPACT_SCORES: Record<z.infer<typeof jointImpactSchema>, number> = {
  not_at_all: 0,
  a_little: 1,
  moderately: 2,
  a_lot: 3,
};

/** Weighting of the internal score. Severity leads; impact modifies. */
export const JOINT_SEVERITY_WEIGHT = 0.7;
export const JOINT_IMPACT_WEIGHT = 0.3;

/**
 * Internal 0-100 discomfort score: severity 70%, daily impact 30%, each
 * normalised from its 0..3 answer. Higher means worse — the opposite of the
 * report rings, which is why this score is never rendered as a ring.
 *
 * Impact is absent whenever Q1 was "No discomfort" (the tracker ends there) and
 * is treated as 0, not as missing: no discomfort cannot be affecting the day.
 */
export function jointDiscomfortScore(
  severity: z.infer<typeof jointSeveritySchema>,
  impact: z.infer<typeof jointImpactSchema> | null,
): number {
  const severityPart = (JOINT_SEVERITY_SCORES[severity] / 3) * 100 * JOINT_SEVERITY_WEIGHT;
  const impactPart =
    ((impact ? JOINT_IMPACT_SCORES[impact] : 0) / 3) * 100 * JOINT_IMPACT_WEIGHT;
  return Math.round(severityPart + impactPart);
}

/**
 * One day's answers.
 *
 * Only `severity` is required. "No discomfort" saves and ends the tracker, so
 * every other field is legitimately empty on a good day — the API rejects the
 * combination that is not legitimate (discomfort reported with no impact answer).
 */
export const logJointBodySchema = z.object({
  /** Defaults to today; supplied only when back-filling a day. */
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD')
    .optional(),
  severity: jointSeveritySchema,
  areas: z.array(jointAreaSchema).default([]),
  symptoms: z.array(jointSymptomSchema).default([]),
  impact: jointImpactSchema.nullable().default(null),
  timeOfDay: jointTimeOfDaySchema.nullable().default(null),
  triggers: z.array(jointTriggerSchema).default([]),
});

export const jointLogSchema = z.object({
  date: z.string(),
  severity: jointSeveritySchema,
  areas: z.array(jointAreaSchema),
  symptoms: z.array(jointSymptomSchema),
  impact: jointImpactSchema.nullable(),
  timeOfDay: jointTimeOfDaySchema.nullable(),
  triggers: z.array(jointTriggerSchema),
  /** Internal 0-100, higher is worse. Served for trends, not for display as a number. */
  score: z.number(),
  /** Pre-built for the daily card: "Moderate discomfort". */
  summary: z.string(),
});

export const jointStateResponseSchema = z.object({
  /** Today's entry, or null when nothing is logged yet. */
  today: jointLogSchema.nullable(),
  /** Most recent entries, newest first — 14 days' worth. */
  recent: z.array(jointLogSchema),
});

/**
 * The weekly summary block, in the shape the spec asks for. Plain-language
 * labels rather than percentages: the internal score is precise in a way the
 * underlying four-point answers are not.
 */
export const jointsSummarySchema = z.object({
  /** "Mild" | "Moderate" | … — the mean severity, named. */
  averageDiscomfort: z.string(),
  /** How the mean moved against the previous window; null with no history. */
  direction: z.enum(['improving', 'steady', 'worsening']).nullable(),
  daysWithDiscomfort: z.number().int(),
  /** Days of the window the user logged this tracker at all. */
  daysLogged: z.number().int(),
  /** Denominator for the copy: "4 of 7 days". */
  daysInWindow: z.number().int(),
  mostAffectedArea: z.string().nullable(),
  mostCommonSymptom: z.string().nullable(),
  /** "Mostly mild", "Not affecting your day", … */
  impact: z.string().nullable(),
  /** Per-day internal score, oldest first from `seriesStart`; null where unlogged. */
  trend: z.array(z.number().nullable()),
});

export type JointSeverity = z.infer<typeof jointSeveritySchema>;
export type JointArea = z.infer<typeof jointAreaSchema>;
export type JointSymptom = z.infer<typeof jointSymptomSchema>;
export type JointImpact = z.infer<typeof jointImpactSchema>;
export type JointTimeOfDay = z.infer<typeof jointTimeOfDaySchema>;
export type JointTrigger = z.infer<typeof jointTriggerSchema>;
export type LogJointBody = z.infer<typeof logJointBodySchema>;
export type JointLogEntry = z.infer<typeof jointLogSchema>;
export type JointStateResponse = z.infer<typeof jointStateResponseSchema>;
export type JointsSummary = z.infer<typeof jointsSummarySchema>;
