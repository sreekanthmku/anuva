import { z } from 'zod';

/**
 * Family sharing — the contracts behind `apps/family-pwa` and the invite gate in `apps/pwa`.
 *
 * Two things about this file are deliberate.
 *
 * First, the server owns every user-visible string. The family client lays out what it is handed
 * and formats nothing: no thresholds, no arrows, no "she may need support" logic. That is not a
 * style preference — it is what keeps the disclosure boundary reviewable in one place
 * (apps/api/src/family/digest.ts) instead of spread across three screens.
 *
 * Second, what crosses into the family app is banded and directional only: "Sleep ↓" / "Lower this
 * week" / "Manageable". No 0-100 scores, no symptom names, no chat, no documents, no records. The
 * shapes below are the whole surface; anything not expressible here does not reach a family member.
 */

// ─────────────────────────────────────────────
// Vocabulary
// ─────────────────────────────────────────────

export const familyRelationshipSchema = z.enum([
  'partner',
  'child',
  'parent',
  'sibling',
  'friend',
  'other',
]);

export const familySupportActionKindSchema = z.enum(['message', 'call', 'flowers', 'chocolates']);

/** Which of the four tiles a metric line belongs to. Fixed set — the family app shows these four. */
export const familyMetricKeySchema = z.enum(['sleep', 'mood', 'stress', 'energy']);

/** How she shared the link. Recorded for support, and to know which channel actually gets used. */
export const familyShareChannelSchema = z.enum(['whatsapp', 'native', 'copy', 'sms']);

// ─────────────────────────────────────────────
// Patient side — the invite gate
// ─────────────────────────────────────────────

/**
 * The gate's whole decision, made on the server. `mustShare` true means the blocking dialog is
 * open; the client does not compute this, because the grace window is measured from
 * `FamilyInvite.sharedAt` in Postgres so that a reload or a second device cannot reset it.
 *
 * `repromptAfterSeconds` is set only while a share is inside its grace window: it is how long until
 * the gate re-opens, and what the client arms a timer for. Null means there is nothing to wait for
 * — either the gate is already open, or a family member has joined and it is done for good.
 */
export const familyGateSchema = z.object({
  mustShare: z.boolean(),
  repromptAfterSeconds: z.number().int().nonnegative().nullable(),
});

export const familyInviteSchema = z.object({
  id: z.string(),
  /** Full magic link, token in the fragment. Built server-side from FAMILY_PWA_BASE_URL. */
  shareUrl: z.string(),
  /** Ready-to-send message body for WhatsApp / the native share sheet, her first name included. */
  shareMessage: z.string(),
  expiresAt: z.string(),
  sharedAt: z.string().nullable(),
  shareCount: z.number().int().nonnegative(),
});

/** What she is shown about the person who claimed her link. Phone is masked, never full. */
export const familyMemberSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  relationship: familyRelationshipSchema,
  maskedPhone: z.string(),
  joinedAt: z.string(),
  lastSeenAt: z.string(),
});

export const familyStatusResponseSchema = z.object({
  gate: familyGateSchema,
  invite: familyInviteSchema.nullable(),
  member: familyMemberSummarySchema.nullable(),
  /**
   * `User.familyFeatureOptOut`. Not settable from the gate — it is an ops and support relief valve
   * for a woman with nobody to invite, and the gate honours it so that relief actually works.
   */
  optedOut: z.boolean(),
});

export const createFamilyInviteResponseSchema = z.object({
  invite: familyInviteSchema,
});

/**
 * Her side of the support loop: what her family actually did.
 *
 * This is the only thing that travels back toward her, and it is deliberately small — who is
 * connected, what they did today, and how much of the week they showed up for. No timestamps beyond
 * a day, because "he messaged you at 23:14" invites a conversation about the time rather than the
 * gesture.
 */
export const familyActivityResponseSchema = z.object({
  member: familyMemberSummarySchema.nullable(),
  /** Null when they have not done anything today. */
  today: z
    .object({
      /**
       * One entry per gesture, in the order they happened. The label is built server-side for the
       * same reason the headline is: the server owns how a gesture is described to her, and the
       * client only decides what it looks like.
       */
      items: z.array(
        z.object({
          kind: familySupportActionKindSchema,
          /** Phrased from her side, sentence-shaped: "Sent you flowers." */
          label: z.string(),
        }),
      ),
      headline: z.string(),
      body: z.string(),
    })
    .nullable(),
  /** Distinct days in the current week on which they did something. */
  daysThisWeek: z.number().int().nonnegative(),
  /** Pre-built copy for the week line, e.g. "3 of 4 days this week". Null before anything happens. */
  weekLine: z.string().nullable(),
});

export const markFamilyInviteSharedBodySchema = z.object({
  channel: familyShareChannelSchema,
});

export const markFamilyInviteSharedResponseSchema = z.object({
  gate: familyGateSchema,
  invite: familyInviteSchema,
});

export const revokeFamilyInviteResponseSchema = z.object({ revoked: z.literal(true) });

export const removeFamilyMemberResponseSchema = z.object({ removed: z.literal(true) });

// ─────────────────────────────────────────────
// Family side — joining
// ─────────────────────────────────────────────

/**
 * What an unauthenticated visitor holding the link may know: her first name, and whether the link
 * is still good. Nothing else — a forwarded link in a group chat must not disclose a phone number
 * or a word about her health before anyone has verified anything.
 */
export const familyJoinPreviewResponseSchema = z.object({
  patientFirstName: z.string(),
  status: z.enum(['pending', 'claimed', 'expired']),
});

export const familyJoinRequestOtpBodySchema = z.object({
  token: z.string().min(16),
  name: z.string().trim().min(1).max(80),
  relationship: familyRelationshipSchema,
  phone: z.string().min(6).max(20),
});

export const familyJoinRequestOtpResponseSchema = z.object({
  challengeId: z.string(),
  maskedPhone: z.string(),
  resendAfterSeconds: z.number().int().nonnegative(),
});

/**
 * `name` and `relationship` are re-sent here rather than remembered from the request-OTP step:
 * `OtpChallenge` has no metadata column, and creating the member row early would occupy the single
 * active-member slot before the phone was proven. Both fields are self-declared either way.
 */
export const familyJoinVerifyBodySchema = z.object({
  token: z.string().min(16),
  challengeId: z.string(),
  phone: z.string().min(6).max(20),
  otp: z.string().min(4).max(8),
  name: z.string().trim().min(1).max(80),
  relationship: familyRelationshipSchema,
});

export const familyMeResponseSchema = z.object({
  member: z.object({
    firstName: z.string(),
    initials: z.string(),
    relationship: familyRelationshipSchema,
  }),
  patientFirstName: z.string(),
  /** Plain labels for what this member can currently see, for the privacy tab. */
  sharedScopes: z.array(z.string()),
});

export const familyJoinVerifyResponseSchema = familyMeResponseSchema;

// ─────────────────────────────────────────────
// Family side — signing back in
// ─────────────────────────────────────────────

/**
 * A family session lasts 90 days and the invite link that opened it is single-use, so once it
 * lapses the member has no way back in without asking her for a new link. These two routes are that
 * way back: the phone they already proved at join is the credential, and an OTP against it re-opens
 * the session. No invite token is involved — the membership row is the standing grant, and it is
 * still checked for `active` on every request afterwards.
 */
export const familySignInRequestOtpBodySchema = z.object({
  phone: z.string().min(6).max(20),
});

export const familySignInRequestOtpResponseSchema = familyJoinRequestOtpResponseSchema;

export const familySignInVerifyBodySchema = z.object({
  challengeId: z.string(),
  phone: z.string().min(6).max(20),
  otp: z.string().min(4).max(8),
});

export const familySignInVerifyResponseSchema = familyMeResponseSchema;

export const familyLogoutResponseSchema = z.object({ ok: z.literal(true) });

// ─────────────────────────────────────────────
// Family side — content
// ─────────────────────────────────────────────

/**
 * A metric tile. `label` already carries its arrow ("Sleep ↓"), and the arrow means the *symptom's*
 * direction, not the score's: scores from `buildSummary` are higher-is-better on every metric
 * including stress, so a rising stress score is a falling stress symptom. Getting that backwards in
 * the family app would be a clinical misread, which is why the client never derives it.
 *
 * `value` is words, never a number — and reads "Nothing shared yet" when she has not logged.
 */
export const familyMetricSchema = z.object({
  key: familyMetricKeySchema,
  label: z.string(),
  value: z.string(),
});

export const familyCardSchema = z.object({
  label: z.string(),
  headline: z.string(),
  body: z.string(),
});

export const familySupportCardSchema = familyCardSchema.extend({
  cta: z.string(),
  completedCta: z.string(),
  completedToday: z.boolean(),
  /**
   * Which actions they have already taken today. Doing one thing does not use up the day — they may
   * message her and send flowers — so the client marks what is done rather than locking the button.
   */
  completedKinds: z.array(familySupportActionKindSchema),
});

export const familyProgressCardSchema = familyCardSchema.extend({
  loggedDays: z.number().int().nonnegative(),
  totalDays: z.number().int().positive(),
});

/**
 * Field-for-field the shape the static prototype already renders, so the copy contract the design
 * was built against is the wire contract.
 *
 * `progress` and `upcoming` are nullable: a woman on day one has no tracking history and may have
 * no booking, and those cards must not render rather than render an empty claim.
 */
export const familyTodayResponseSchema = z.object({
  eyebrow: z.string(),
  greeting: z.string(),
  dateLine: z.string(),
  status: familyCardSchema,
  support: familySupportCardSchema,
  metricsLabel: z.string(),
  metrics: z.array(familyMetricSchema),
  education: familyCardSchema,
  progress: familyProgressCardSchema.nullable(),
  upcoming: familyCardSchema.nullable(),
});

/**
 * Family reading — its own corpus, deliberately not the patient library.
 *
 * `apps/pwa`'s library is her reading: clinical explainers, nutrition, movement, written for the
 * woman living the transition. The family app's articles are written for the people around her, and
 * every one of them carries an action the reader is meant to take. Serving one from the other would
 * put her care content in a family member's hands, which is the wrong disclosure direction even
 * though the content itself is general. The two never share a schema, a store or an endpoint.
 */

/** Who an article is written for. Derived from the member's relationship, never sent by the client. */
export const familyArticleReaderSchema = z.enum(['partner', 'teen', 'adult']);

/**
 * Which readers may see an article at all. Most are `everyone`; two are not, and both exclusions
 * are editorial requirements rather than preferences: the teen article tells a child they are not
 * responsible for a parent's health, and the intimacy article is adult-partner content that must
 * never appear in a child's list.
 */
export const familyArticleAudienceSchema = z.enum(['everyone', 'teens', 'partners']);

export const familyArticleSummarySchema = z.object({
  slug: z.string(),
  /** Editorial number from the source document — shown as "Topic 03", stable across rotations. */
  number: z.number().int().positive(),
  title: z.string(),
  /** One-line list preview. */
  teaser: z.string(),
  audience: familyArticleAudienceSchema,
  /** "Partners and teens", "Teens only" — server-worded, because the client knows no audiences. */
  audienceLabel: z.string(),
  /** Computed from the copy this reader is actually served, so it is not a fixed claim. */
  readingMinutes: z.number().int().positive(),
});

/**
 * The reader's own action is the only role-specific part. The explanation is common to everyone, so
 * a partner and a teen read the same facts and are asked for different things.
 */
export const familyArticleActionSchema = z.object({
  label: z.string(),
  text: z.string(),
});

export const familyArticleSchema = familyArticleSummarySchema.extend({
  reader: familyArticleReaderSchema,
  body: z.array(z.string()).min(1),
  /** Absent only if an article has nothing to ask of this reader. */
  action: familyArticleActionSchema.nullable(),
  sayingLabel: z.string(),
  /** A sentence the reader can use as-is. */
  saying: z.string(),
  sourcesLabel: z.string(),
  sources: z.array(z.string()).min(1),
  /** The standing disclaimer. Server-owned so it cannot be dropped by a client redesign. */
  footer: z.string(),
});

/** Articles arrive grouped, because a flat list of eighteen reads as a backlog. */
export const familyArticleSectionSchema = z.object({
  label: z.string(),
  articles: z.array(familyArticleSummarySchema).min(1),
});

export const familyLearnResponseSchema = z.object({
  eyebrow: z.string(),
  title: z.string(),
  subline: z.string(),
  nudge: familyCardSchema,
  tip: familyCardSchema,
  articlesLabel: z.string(),
  sections: z.array(familyArticleSectionSchema),
});

export const familyArticleParamsSchema = z.object({
  slug: z.string().min(1).max(80),
});

export const familyArticleResponseSchema = z.object({
  article: familyArticleSchema,
  /** Two more from the same section, so the reader has somewhere to go next. */
  more: z.array(familyArticleSummarySchema),
});

/**
 * The privacy tab is derived from what the digest actually emits, not hardcoded in the client — a
 * hardcoded list is a promise that silently stops being true the first time a field is added.
 */
export const familyPrivacyResponseSchema = z.object({
  eyebrow: z.string(),
  title: z.string(),
  subline: z.string(),
  sharedLabel: z.string(),
  shared: z.array(z.string()),
  privateLabel: z.string(),
  privateItems: z.array(z.string()),
});

/**
 * A note from a family member, delivered as a push notification and never stored.
 *
 * The text lives only in the FCM payload and, for the cold-start case, in the URL *fragment* of the
 * deep link — fragments never reach a server, so it stays out of access logs the same way the invite
 * token does. Capped short: this is a "thinking of you", not correspondence, and the whole thing has
 * to fit in an FCM data payload and a notification body.
 */
export const familyMessageBodySchema = z.object({
  text: z.string().trim().min(1).max(280),
});

export const familyMessageResponseSchema = z.object({
  /** False when she has no active device registered — worth telling them rather than lying. */
  delivered: z.boolean(),
  toast: z.string(),
});

export const familySupportActionBodySchema = z.object({
  kind: familySupportActionKindSchema,
});

export const familySupportActionResponseSchema = z.object({
  completedToday: z.literal(true),
  toast: z.string(),
  /**
   * Only meaningful for the gift kinds (`flowers`, `chocolates`), which are pushed to her phone the
   * way a note is. Absent for `message` — that route has its own response — and for `call`, which
   * is a self-report about something that happened outside the app.
   */
  delivered: z.boolean().optional(),
});

export const familyRemindLaterResponseSchema = z.object({
  remindAt: z.string(),
  toast: z.string(),
});

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export type FamilyRelationship = z.infer<typeof familyRelationshipSchema>;
export type FamilySupportActionKind = z.infer<typeof familySupportActionKindSchema>;
export type FamilyMetricKey = z.infer<typeof familyMetricKeySchema>;
export type FamilyShareChannel = z.infer<typeof familyShareChannelSchema>;
export type FamilyGate = z.infer<typeof familyGateSchema>;
export type FamilyInvite = z.infer<typeof familyInviteSchema>;
export type FamilyMemberSummary = z.infer<typeof familyMemberSummarySchema>;
export type FamilyStatusResponse = z.infer<typeof familyStatusResponseSchema>;
export type CreateFamilyInviteResponse = z.infer<typeof createFamilyInviteResponseSchema>;
export type FamilyActivityResponse = z.infer<typeof familyActivityResponseSchema>;
export type MarkFamilyInviteSharedBody = z.infer<typeof markFamilyInviteSharedBodySchema>;
export type MarkFamilyInviteSharedResponse = z.infer<typeof markFamilyInviteSharedResponseSchema>;
export type RevokeFamilyInviteResponse = z.infer<typeof revokeFamilyInviteResponseSchema>;
export type RemoveFamilyMemberResponse = z.infer<typeof removeFamilyMemberResponseSchema>;
export type FamilyJoinPreviewResponse = z.infer<typeof familyJoinPreviewResponseSchema>;
export type FamilyJoinRequestOtpBody = z.infer<typeof familyJoinRequestOtpBodySchema>;
export type FamilyJoinRequestOtpResponse = z.infer<typeof familyJoinRequestOtpResponseSchema>;
export type FamilyJoinVerifyBody = z.infer<typeof familyJoinVerifyBodySchema>;
export type FamilyJoinVerifyResponse = z.infer<typeof familyJoinVerifyResponseSchema>;
export type FamilyMeResponse = z.infer<typeof familyMeResponseSchema>;
export type FamilySignInRequestOtpBody = z.infer<typeof familySignInRequestOtpBodySchema>;
export type FamilySignInRequestOtpResponse = z.infer<typeof familySignInRequestOtpResponseSchema>;
export type FamilySignInVerifyBody = z.infer<typeof familySignInVerifyBodySchema>;
export type FamilySignInVerifyResponse = z.infer<typeof familySignInVerifyResponseSchema>;
export type FamilyLogoutResponse = z.infer<typeof familyLogoutResponseSchema>;
export type FamilyMetric = z.infer<typeof familyMetricSchema>;
export type FamilyCard = z.infer<typeof familyCardSchema>;
export type FamilySupportCard = z.infer<typeof familySupportCardSchema>;
export type FamilyProgressCard = z.infer<typeof familyProgressCardSchema>;
export type FamilyTodayResponse = z.infer<typeof familyTodayResponseSchema>;
export type FamilyArticleReader = z.infer<typeof familyArticleReaderSchema>;
export type FamilyArticleAudience = z.infer<typeof familyArticleAudienceSchema>;
export type FamilyArticleSummary = z.infer<typeof familyArticleSummarySchema>;
export type FamilyArticleAction = z.infer<typeof familyArticleActionSchema>;
export type FamilyArticle = z.infer<typeof familyArticleSchema>;
export type FamilyArticleSection = z.infer<typeof familyArticleSectionSchema>;
export type FamilyLearnResponse = z.infer<typeof familyLearnResponseSchema>;
export type FamilyArticleParams = z.infer<typeof familyArticleParamsSchema>;
export type FamilyArticleResponse = z.infer<typeof familyArticleResponseSchema>;
export type FamilyPrivacyResponse = z.infer<typeof familyPrivacyResponseSchema>;
export type FamilyMessageBody = z.infer<typeof familyMessageBodySchema>;
export type FamilyMessageResponse = z.infer<typeof familyMessageResponseSchema>;
export type FamilySupportActionBody = z.infer<typeof familySupportActionBodySchema>;
export type FamilySupportActionResponse = z.infer<typeof familySupportActionResponseSchema>;
export type FamilyRemindLaterResponse = z.infer<typeof familyRemindLaterResponseSchema>;
