import { z } from 'zod';

/**
 * DPDP data rights: erasure (§12) and access (§11).
 *
 * Two things worth knowing before changing anything here.
 *
 * First, §11 is a right to *information* — a summary of what is held, why, and who else received
 * it. It is not GDPR §20 portability; DPDP 2023 grants no machine-readable export right at all. The
 * disclosure below is therefore the obligation, and the downloadable copy is a product choice made
 * because the person most likely to want her symptom history is her own gynaecologist.
 *
 * Second, erasure and the NMC 2020 three-year record floor pull in opposite directions. The
 * resolution is in ERASURE_RETAINED_MODELS: the consultation record survives, and the audio does
 * not. No statute requires us to keep a recording of a call, so it is the first thing to go; the
 * prescription and the fact the consultation happened are what a regulator would ask for.
 */

// ─────────────────────────────────────────────
// Erasure model registry
// ─────────────────────────────────────────────
//
// A tombstone erasure keeps the User row, which means Prisma's `onDelete: Cascade` never fires and
// every child table has to be named. That inverts the safe default: a new model with a `userId`
// survives erasure unless someone remembers to add it here. `pnpm check:erasure` is what makes
// forgetting fail loudly — it parses schema.prisma, and any model with a `user User` relation that
// is missing from these lists breaks the build.
//
// Names are Prisma *delegate* names (camelCase), because that is how the erasure code indexes
// `prisma[model]`.

/** Symptom, cycle, mood and nudge history, plus everything derived from it. */
export const ERASURE_TRACKER_MODELS = [
  'periodLog',
  'periodDailyStatus',
  'moodLog',
  'sleepLog',
  'quickSymptomLog',
  'symptomLog',
  'energyLog',
  'stressLog',
  'hotFlashDailyLog',
  'planAdherenceLog',
  'hydrationLog',
  'cravingsLog',
  'movementLog',
  'meTimeLog',
  'foodRhythmLog',
  'familySupportLog',
  'weeklyMoodReviewLog',
  'brainFogLog',
  'bloatingLog',
  'painLog',
  // Derived, and deleted with the source rather than left behind: a weekly report whose logs are
  // gone is a claim about a week we can no longer support.
  'weeklyReport',
  'wellnessSnapshot',
  'nudgeDailyState',
  'nudgeSendLog',
  'l3TriggerLog',
] as const;

/** Conversations with Anu. `chatThread` cascades its messages. */
export const ERASURE_CHAT_MODELS = ['chatThread', 'anuChatTurn'] as const;

/**
 * Only reachable at account scope, because deleting any of these leaves a signed-in account that
 * cannot function — the assessment is what scoring, care path and nudge eligibility are built on.
 * Someone who wants these gone wants the account gone.
 */
export const ERASURE_ACCOUNT_MODELS = [
  'healthProfile',
  'assessment',
  'detailedAssessment',
  'cycleSettings',
  'userCarePath',
  'careJourneyStage',
  'subscription',
  // Family sharing dies with the account, and a tombstone user must not go on holding a relative's
  // phone number. `familySupportAction` first, then the invite, then the member: the invite points
  // at the member, so clearing it first saves the FK a SetNull pass. `familySession` is absent on
  // purpose — it has no `userId` and cascades from `familyMember`.
  'familySupportAction',
  'familyInvite',
  'familyMember',
  'fcmToken',
  'session',
] as const;

/**
 * Detached and scrubbed instead of deleted, each for its own reason: a support thread may be
 * mid-conversation with a human, a published Q&A answer is read by other women, and a consultation
 * is a medical record under the NMC floor.
 */
export const ERASURE_ANONYMIZED_MODELS = ['supportTicket', 'anonymousQuestion'] as const;

/**
 * Survives an account erasure by design. `otpChallenge` is the exception in this list — it is
 * deleted outright, but by phone as well as by `userId`, because the phone column is itself
 * personal data that a `userId` match would leave behind.
 */
export const ERASURE_RETAINED_MODELS = [
  'consultation',
  'consultationCallConsent',
  'otpChallenge',
  'dataDeletionRequest',
  'dataExportRequest',
] as const;

/** Every model the registry accounts for. `pnpm check:erasure` compares this against the schema. */
export const ERASURE_REGISTERED_MODELS = [
  ...ERASURE_TRACKER_MODELS,
  ...ERASURE_CHAT_MODELS,
  ...ERASURE_ACCOUNT_MODELS,
  ...ERASURE_ANONYMIZED_MODELS,
  ...ERASURE_RETAINED_MODELS,
] as const;

// ─────────────────────────────────────────────
// Policy constants
// ─────────────────────────────────────────────

/**
 * How long an account deletion waits before it runs. She stays signed in throughout and can cancel
 * from the same screen — the window exists for the person who tapped it in a bad hour, and for the
 * person who was pressured into tapping it.
 */
export const ACCOUNT_DELETION_GRACE_DAYS = 7;

/** Published in the UI as the outer limit, well inside DPDP's "reasonable time". */
export const ERASURE_SLA_DAYS = 30;

/** NMC Telemedicine Practice Guidelines 2020: consultation records kept three years. */
export const CLINICAL_RECORD_RETENTION_YEARS = 3;

/** A staged export is deleted after this, downloaded or not. */
export const DATA_EXPORT_TTL_HOURS = 24;

/** One export per rolling window. It is a complete copy of her health history — not a cheap read. */
export const DATA_EXPORT_COOLDOWN_HOURS = 24;

export const privacyOtpIntentSchema = z.enum(['account_deletion', 'data_export']);
export type PrivacyOtpIntent = z.infer<typeof privacyOtpIntentSchema>;

export const dataErasureScopeSchema = z.enum(['recordings', 'chat', 'tracker', 'account']);
export type DataErasureScope = z.infer<typeof dataErasureScopeSchema>;

export const dataDeletionStatusSchema = z.enum([
  'pending',
  'processing',
  'completed',
  'cancelled',
  'failed',
]);
export type DataDeletionStatus = z.infer<typeof dataDeletionStatusSchema>;

export const dataExportStatusSchema = z.enum([
  'pending',
  'ready',
  'downloaded',
  'failed',
  'expired',
]);
export type DataExportStatus = z.infer<typeof dataExportStatusSchema>;

/**
 * Copy for the four erasure options, shared so the confirmation screen and the summary endpoint
 * cannot describe the same action differently. `collateral` is the part that is easy to leave out
 * and the part she is most likely to be surprised by, so it is a required field.
 */
export const ERASURE_SCOPES: {
  id: DataErasureScope;
  label: string;
  description: string;
  collateral: string;
  requiresOtp: boolean;
  immediate: boolean;
}[] = [
  {
    id: 'recordings',
    label: 'Delete call recordings',
    description: 'Every audio recording of your consultations, and the files behind them.',
    collateral:
      'Your prescriptions, diet plans and the record that the consultation happened are kept — a doctor is required to hold those for three years.',
    requiresOtp: false,
    immediate: true,
  },
  {
    id: 'chat',
    label: 'Delete chat with Anu',
    description: 'Every message you and Anu exchanged.',
    collateral:
      'Anu starts fresh and will not remember earlier conversations. Answers Anu had cached from your wording are cleared too.',
    requiresOtp: false,
    immediate: true,
  },
  {
    id: 'tracker',
    label: 'Delete tracked health history',
    description:
      'Periods, mood, sleep, energy, hot flashes and every other daily entry you have logged.',
    collateral:
      'Weekly reports and wellness scores built from those entries go with them, and cycle predictions restart from your next log.',
    requiresOtp: false,
    immediate: true,
  },
  {
    id: 'account',
    label: 'Delete my account',
    description: 'Everything above, plus your profile, assessments, care plan and subscription.',
    collateral:
      'Consultation records and prescriptions are kept for three years because a doctor is required to hold them, then deleted automatically. Your name, phone number and email are removed from them straight away.',
    requiresOtp: true,
    immediate: false,
  },
];

export function erasureScopeLabel(scope: DataErasureScope): string {
  return ERASURE_SCOPES.find((entry) => entry.id === scope)?.label ?? 'Delete data';
}

// ─────────────────────────────────────────────
// §11 disclosure
// ─────────────────────────────────────────────

/**
 * Who else processes her data. This is the §11(b) obligation and the one part of a privacy screen
 * that cannot be written from the schema — it has to be maintained by hand when a vendor changes.
 * `reachesDeletion: false` is the honest admission that erasure here cannot reach their copy.
 */
export const DATA_RECIPIENTS: {
  name: string;
  purpose: string;
  dataShared: string;
  reachesDeletion: boolean;
}[] = [
  {
    name: 'OpenAI',
    purpose: 'Generating Anu’s answers to your questions',
    dataShared: 'The text of what you ask Anu. Not your name, phone number or account.',
    reachesDeletion: false,
  },
  {
    name: 'LiveKit',
    purpose: 'Carrying and recording consultation calls',
    dataShared: 'Call audio while the consultation is running.',
    reachesDeletion: true,
  },
  {
    name: 'Google (Firebase Cloud Messaging)',
    purpose: 'Delivering push notifications',
    dataShared: 'A device token. Not the content of the notification.',
    reachesDeletion: true,
  },
  {
    name: '2Factor',
    purpose: 'Sending the one-time codes you sign in with',
    dataShared: 'Your phone number.',
    reachesDeletion: false,
  },
];

export const privacyDataCategorySchema = z.object({
  key: z.string(),
  label: z.string(),
  /** Rows held. Shown to her, because a delete button with no number attached is a guess. */
  count: z.number().int().min(0),
  /** Plain-language reason this is held at all. */
  purpose: z.string(),
  /** Null where nothing forces us to keep it — that is the normal case. */
  retention: z.string().nullable(),
});
export type PrivacyDataCategory = z.infer<typeof privacyDataCategorySchema>;

export const privacyDeletionRequestSchema = z.object({
  id: z.string(),
  scope: dataErasureScopeSchema,
  status: dataDeletionStatusSchema,
  requestedAt: z.string(),
  scheduledFor: z.string(),
  completedAt: z.string().nullable(),
  /** Per-category counts destroyed. Null until it runs. */
  itemCounts: z.record(z.number().int().min(0)).nullable(),
});
export type PrivacyDeletionRequest = z.infer<typeof privacyDeletionRequestSchema>;

export const privacyExportSchema = z.object({
  id: z.string(),
  status: dataExportStatusSchema,
  createdAt: z.string(),
  expiresAt: z.string(),
  downloadedAt: z.string().nullable(),
  sizeBytes: z.number().int().min(0).nullable(),
});
export type PrivacyExport = z.infer<typeof privacyExportSchema>;

export const privacySummaryResponseSchema = z.object({
  /** What we hold, by category, with counts. */
  categories: z.array(privacyDataCategorySchema),
  /** The pending account deletion, if one is running. */
  pendingDeletion: privacyDeletionRequestSchema.nullable(),
  /** Completed and cancelled requests, newest first. Her receipt. */
  history: z.array(privacyDeletionRequestSchema),
  /** The most recent export, ready or not. */
  latestExport: privacyExportSchema.nullable(),
  /** Null when she may ask for an export now. */
  exportAvailableAt: z.string().nullable(),
  graceDays: z.number().int().min(0),
  slaDays: z.number().int().min(0),
});
export type PrivacySummaryResponse = z.infer<typeof privacySummaryResponseSchema>;

export const privacyOtpBodySchema = z.object({ intent: privacyOtpIntentSchema });
export type PrivacyOtpBody = z.infer<typeof privacyOtpBodySchema>;

export const privacyOtpResponseSchema = z.object({
  challengeId: z.string(),
  maskedPhone: z.string(),
  resendAfterSeconds: z.number().int().nonnegative(),
});
export type PrivacyOtpResponse = z.infer<typeof privacyOtpResponseSchema>;

export const createDeletionRequestBodySchema = z
  .object({
    scope: dataErasureScopeSchema,
    /** Required for `account` only — see ERASURE_SCOPES.requiresOtp. */
    challengeId: z.string().min(1).optional(),
    otp: z.string().trim().length(6).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.scope !== 'account') {
      return;
    }
    if (!value.challengeId || !value.otp) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['otp'],
        message: 'Confirm the code we sent to your phone.',
      });
    }
  });
export type CreateDeletionRequestBody = z.infer<typeof createDeletionRequestBodySchema>;

export const createDeletionRequestResponseSchema = z.object({
  request: privacyDeletionRequestSchema,
  /** True when the account is now scheduled and she has been signed out everywhere else. */
  accountScheduled: z.boolean(),
});
export type CreateDeletionRequestResponse = z.infer<typeof createDeletionRequestResponseSchema>;

export const cancelDeletionRequestResponseSchema = z.object({
  request: privacyDeletionRequestSchema,
});
export type CancelDeletionRequestResponse = z.infer<typeof cancelDeletionRequestResponseSchema>;

export const createDataExportBodySchema = z.object({
  challengeId: z.string().min(1),
  otp: z.string().trim().length(6),
});
export type CreateDataExportBody = z.infer<typeof createDataExportBodySchema>;

export const createDataExportResponseSchema = z.object({
  export: privacyExportSchema,
  /**
   * The one-time download URL, including its token. Returned exactly once — only a hash of the
   * token is stored, so it cannot be re-issued and a lost link means asking for a new export.
   */
  downloadUrl: z.string(),
});
export type CreateDataExportResponse = z.infer<typeof createDataExportResponseSchema>;
