import { execFile } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { config } from 'dotenv';

const execFileAsync = promisify(execFile);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.join(__dirname, '../../../.env') });

import cors from 'cors';
import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import { MulterError } from 'multer';
import { prisma } from '@anuva/database';
import {
  AccessToken,
  DirectFileOutput,
  EgressClient,
  EgressStatus,
  EncodedFileOutput,
  EncodedFileType,
  RoomServiceClient,
  TrackType,
  WebhookReceiver,
} from 'livekit-server-sdk';
import {
  activateOneDaySubscriptionResponseSchema,
  authSessionResponseSchema,
  authUserSchema,
  consultationBookingResponseSchema,
  consultationCallConsentBodySchema,
  consultationCallConsentResponseSchema,
  consultationCallEndResponseSchema,
  consultationCallJoinResponseSchema,
  consultationCallStateResponseSchema,
  consultationCallStateSchema,
  consultationDocumentSchema,
  consultationDocumentsResponseSchema,
  deleteConsultationDocumentResponseSchema,
  uploadConsultationDocumentBodySchema,
  uploadConsultationDocumentResponseSchema,
  doctorConsultationBookingsResponseSchema,
  doctorIdentityResponseSchema,
  doctorLoginRequestSchema,
  doctorPasswordChangeRequestSchema,
  consultationSlotsQuerySchema,
  consultationSlotsResponseSchema,
  consultationSpecialistsResponseSchema,
  createConsultationBookingBodySchema,
  createConsultationSlotsBodySchema,
  createConsultationSlotsResponseSchema,
  cancelConsultationResponseSchema,
  deleteConsultationSlotParamsSchema,
  deleteConsultationSlotResponseSchema,
  myConsultationsResponseSchema,
  myConsultationSchema,
  rescheduleConsultationBodySchema,
  rescheduleConsultationResponseSchema,
  logoutResponseSchema,
  registerFcmBodySchema,
  registerFcmResponseSchema,
  requestOtpBodySchema,
  pushBroadcastResponseSchema,
  startTrialResponseSchema,
  unregisterFcmBodySchema,
  unregisterFcmResponseSchema,
  requestOtpResponseSchema,
  verifyOtpBodySchema,
  cycleSetupBodySchema,
  cycleSettingsBodySchema,
  logPeriodFlowBodySchema,
  logPeriodBodySchema,
  endPeriodBodySchema,
  cycleStateResponseSchema,
  logMoodBodySchema,
  moodLogSchema,
  moodStateResponseSchema,
  logSleepBodySchema,
  sleepLogSchema,
  sleepStateResponseSchema,
  logQuickSymptomBodySchema,
  quickLogStateResponseSchema,
  summaryCalendarQuerySchema,
  summaryCalendarResponseSchema,
  logQuickSymptomResponseSchema,
  type QuickSymptom,
  submitNudgeResponseBodySchema,
  nudgeRespondResponseSchema,
  nudgeTodayResponseSchema,
  nudgeStateResponseSchema,
  nudgeDayResponseSchema,
  nudgeSlotSchema,
  saveDetailedAssessmentBodySchema,
  submitDetailedAssessmentBodySchema,
  detailedAssessmentStateResponseSchema,
  detailedAssessmentQuestionKeys,
  findMissingDetailedAnswers,
  detailedSectionsForLenses,
  doctorDetailedAssessmentResponseSchema,
  anuChatBodySchema,
  anuChatResponseSchema,
  anuChatHistoryResponseSchema,
  libraryFeedQuerySchema,
  libraryFeedResponseSchema,
  libraryArticleParamsSchema,
  libraryArticleResponseSchema,
  anonymousQuestionTopicSchema,
  createAnonymousQuestionBodySchema,
  createAnonymousQuestionResponseSchema,
  myAnonymousQuestionsResponseSchema,
  anonymousQuestionFeedQuerySchema,
  anonymousQuestionFeedResponseSchema,
  doctorQuestionsQuerySchema,
  doctorQuestionsResponseSchema,
  doctorNotificationsQuerySchema,
  doctorNotificationsResponseSchema,
  markDoctorNotificationsReadBodySchema,
  markDoctorNotificationsReadResponseSchema,
  anonymousQuestionTopicLabel,
  answerAnonymousQuestionBodySchema,
  answerAnonymousQuestionResponseSchema,
  weeklyReportQuerySchema,
  weeklyReportResponseSchema,
  SUPPORT_TICKET_DAILY_LIMIT,
  supportTicketSchema,
  createSupportTicketBodySchema,
  createSupportTicketResponseSchema,
  mySupportTicketsResponseSchema,
  ACCOUNT_DELETION_GRACE_DAYS,
  DATA_EXPORT_COOLDOWN_HOURS,
  DATA_EXPORT_TTL_HOURS,
  ERASURE_SLA_DAYS,
  cancelDeletionRequestResponseSchema,
  createDataExportBodySchema,
  createDataExportResponseSchema,
  createDeletionRequestBodySchema,
  createDeletionRequestResponseSchema,
  privacyOtpBodySchema,
  privacyOtpResponseSchema,
  privacySummaryResponseSchema,
  type AnonymousQuestionTopic,
  type AuthUser,
  type ConsultationCallState,
} from '@anuva/shared';
import { ZodError } from 'zod';
import { BOOKABLE_DOCTOR_KEYS, ensureBookingCatalog, lensesForSpecialist } from './bookingCatalog.js';
import {
  CONSULTATION_DOC_DIR,
  UnsupportedDocumentTypeError,
  resolveConsultationDocumentPath,
  safeDownloadName,
  sniffDocumentMimeType,
  uploadConsultationDocument,
  writeConsultationDocument,
} from './consultationDocuments.js';
import { sendPushToAllTokens } from './fcm.js';
import {
  notifyDoctorConsultationBooked,
  notifyDoctorConsultationCancelled,
  notifyDoctorsConsultationRescheduled,
  notifyDoctorsQuestionAsked,
} from './doctorNotifications.js';
import { notifyAskerQuestionAnswered } from './qaNotifications.js';
import {
  PERIOD_LENGTH_MAX,
  bleedingDays,
  buildCycleStateResponse,
  isBleedingDay,
  pendingFlowDates,
} from './cycleCalc.js';
import { startNudgeScheduler, dispatchSlot } from './nudge/scheduler.js';
import { startSupportRetentionJob } from './supportRetention.js';
import { eraseScope } from './privacy/erasure.js';
import { createDataExport, resolveExportPath, unlinkExportFile } from './privacy/export.js';
import { startPrivacyRetentionJobs } from './privacy/retention.js';
import { buildPrivacyCategories } from './privacy/summary.js';
import {
  buildDispatch,
  storeResponse,
  currentSlot,
  startOfDay,
  getDaySheet,
  markTrackerEngagement,
} from './nudge/engine.js';
import { runNudgeSelfTest } from './nudge/selfTest.js';
import { buildSummary } from './report/build.js';
import { buildSummaryCalendar, summaryAnchor } from './report/calendar.js';
import { randomQuickLogMessage } from './quickLogMessages.js';
import { recordQuickSymptom } from './logging/writeThrough.js';
import { dayKey } from './dayKey.js';
import { answer as anuAnswer } from './anu/engine.js';
import { getLibraryArticle, getLibraryFeed } from './library.js';
import { isAnuChatConfigured } from './anu/openai.js';
import { loadCache, cacheStats } from './anu/cache.js';
import { httpLogger, logger } from './logger.js';
import { createAdminRouter } from './admin/index.js';
import { createReport14Router } from './report14/index.js';
import { createFamilyRouter } from './family/index.js';
import { AdminError } from './admin/errors.js';
import {
  CLEARED_LOCK_STATE,
  DUMMY_DOCTOR_PASSWORD_HASH,
  hashDoctorPassword,
  lockoutSecondsRemaining,
  nextFailureState,
  normaliseDoctorUsername,
  verifyDoctorPassword,
} from './doctorAuth.js';

const app = express();
const port = Number(process.env.PORT) || 3001;

const SESSION_COOKIE_NAME = process.env.SESSION_COOKIE_NAME || 'anuva_session';
const SESSION_TTL_DAYS = Number(process.env.SESSION_TTL_DAYS || 30);
const OTP_EXPIRY_MINUTES = Number(process.env.OTP_EXPIRY_MINUTES || 10);
const OTP_RESEND_COOLDOWN_SECONDS = Number(process.env.OTP_RESEND_COOLDOWN_SECONDS || 30);
const OTP_MAX_SENDS_PER_15_MINUTES = Number(process.env.OTP_MAX_SENDS_PER_15_MINUTES || 3);
const OTP_MAX_VERIFY_ATTEMPTS = Number(process.env.OTP_MAX_VERIFY_ATTEMPTS || 5);
const TWOFACTOR_BASE_URL = process.env.TWOFACTOR_BASE_URL || 'https://2factor.in/API/V1';
const TWOFACTOR_OTP_TEMPLATE_NAME = process.env.TWOFACTOR_OTP_TEMPLATE_NAME?.trim() || '';
const FREE_TRIAL_DAYS = Math.max(1, Number(process.env.FREE_TRIAL_DAYS || 14));
const SESSION_COOKIE_SECURE = process.env.SESSION_COOKIE_SECURE === 'true';
const SESSION_COOKIE_DOMAIN = process.env.SESSION_COOKIE_DOMAIN?.trim() || undefined;
const SESSION_COOKIE_SAME_SITE = (process.env.SESSION_COOKIE_SAME_SITE?.trim().toLowerCase() || 'lax') as
  | 'lax'
  | 'strict'
  | 'none';
const PUSH_BROADCAST_SECRET = process.env.PUSH_BROADCAST_SECRET?.trim() || '';
const LIVEKIT_URL = process.env.LIVEKIT_URL?.trim() || '';
const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY?.trim() || '';
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET?.trim() || '';
const LIVEKIT_TOKEN_TTL = process.env.LIVEKIT_TOKEN_TTL?.trim() || '2h';
const LIVEKIT_RECORDING_FILE_PREFIX =
  process.env.LIVEKIT_RECORDING_FILE_PREFIX?.trim().replace(/\/+$/, '') || 'consultation-recordings';
const LIVEKIT_RECORDING_ENABLED = process.env.LIVEKIT_RECORDING_ENABLED !== 'false';
const LIVEKIT_RECORDING_AUDIO_ONLY = process.env.LIVEKIT_RECORDING_AUDIO_ONLY !== 'false';
const CALL_CONSENT_TEXT_VERSION =
  process.env.CALL_CONSENT_TEXT_VERSION?.trim() || 'recording-consent-v1';
const DOCTOR_COOKIE_NAME = process.env.DOCTOR_SESSION_COOKIE_NAME || 'anuva_doctor_session';
// Doctors handle patient PII on shared clinic devices, so their sessions are far shorter-lived
// than a patient's 30 days.
const DOCTOR_SESSION_TTL_HOURS = Math.max(1, Number(process.env.DOCTOR_SESSION_TTL_HOURS || 12));
// Questions land in one shared specialist queue, so a single account is capped per rolling day.
const ANONYMOUS_QA_DAILY_LIMIT = Math.max(1, Number(process.env.ANONYMOUS_QA_DAILY_LIMIT || 5));
// How long a support ticket is kept after it is opened. Stamped onto each row as `purgeAfter`, and
// stated in the consent notice she agrees to — the two must be changed together.
const SUPPORT_TICKET_RETENTION_DAYS = Math.max(
  30,
  Number(process.env.SUPPORT_TICKET_RETENTION_DAYS || 180),
);
// Where the egress recording volume is mounted on the API's own filesystem. Required to mix the
// per-speaker files into a combined track; without it recording still works, mixdown is skipped.
const RECORDING_LOCAL_DIR = process.env.RECORDING_LOCAL_DIR?.trim() || '';

app.use(cors({ origin: true, credentials: true }));

// Mounted ahead of every route, including the raw-body LiveKit webhook below, so nothing
// reaches a handler unlogged. Gives each request `req.log` with a reqId already attached.
app.use(httpLogger);

/**
 * LiveKit signs the raw request body, so this route has to see the unparsed bytes and must
 * therefore be registered ahead of express.json().
 *
 * Recording cannot be kicked off when the patient hits /join: the token has only just been
 * issued, so the patient is not in the room and has no audio track for egress to attach to.
 * LiveKit tells us when tracks actually appear, and that is the moment to start.
 */
app.post('/livekit/webhook', express.raw({ type: '*/*', limit: '1mb' }), async (req, res) => {
  if (!LIVEKIT_API_KEY || !LIVEKIT_API_SECRET) {
    res.status(503).end();
    return;
  }

  let event;
  try {
    const receiver = new WebhookReceiver(LIVEKIT_API_KEY, LIVEKIT_API_SECRET);
    event = await receiver.receive(req.body.toString('utf8'), req.get('Authorization'));
  } catch (error) {
    req.log.warn({ err: error }, 'Rejected LiveKit webhook: signature verification failed');
    res.status(401).end();
    return;
  }

  // Ack first: LiveKit retries on non-2xx, and none of this work is worth a retry storm.
  res.status(200).end();

  try {
    if (event.event === 'track_published' && event.room?.name) {
      await reconcileCallRecordings(event.room.name);
      return;
    }

    if (event.event === 'egress_updated' || event.event === 'egress_ended') {
      const egressId = event.egressInfo?.egressId;
      if (!egressId) {
        return;
      }

      const recording = await prisma.consultationRecording.findUnique({ where: { egressId } });
      if (recording) {
        await syncRecordingStatus(recording);
        // Runs only once both sides are ready, so whichever egress finishes last triggers it.
        await maybeMixCallRecording(recording.consultationCallId);
      }
    }
  } catch (error) {
    req.log.error(
      { err: error, event: event.event, room: event.room?.name, egressId: event.egressInfo?.egressId },
      'Failed handling LiveKit webhook',
    );
  }
});

// 512kb rather than the 100kb default: the detailed assessment posts every answer in one body,
// and one of them is a drawn signature carried as a PNG data URL. Zod still caps that single value
// at DETAILED_SIGNATURE_VALUE_MAX and requires it to parse as a PNG data URL.
app.use(express.json({ limit: '512kb' }));

// Dedicated Admin API — completely separate from patient and doctor routes.
// Auth, validation, and CRUD live under apps/api/src/admin/.
app.use('/admin', createAdminRouter({ prisma }));

// 14-Day Assessment Report — self-contained module under apps/api/src/report14/.
// Auth is injected rather than imported so the module carries no dependency on
// this file; it also handles its own errors, so nothing else here changes.
app.use(
  '/report14',
  createReport14Router({
    resolveUserId: async (req) => (await requireCurrentUser(req)).id,
  }),
);

// Family sharing — self-contained module under apps/api/src/family/. Same injected-auth,
// own-error-handler shape as report14, so nothing in this file changes when its routes grow.
app.use(
  '/family',
  createFamilyRouter({
    resolveUserId: async (req) => (await requireCurrentUser(req)).id,
    normalizePhone,
    sessionCookieOptions: getSessionCookieOptions,
    otp: {
      send: sendOtpWithTwoFactor,
      verify: verifyOtpWithTwoFactor,
      expiryMinutes: OTP_EXPIRY_MINUTES,
      resendCooldownSeconds: OTP_RESEND_COOLDOWN_SECONDS,
      maxSendsPer15Minutes: OTP_MAX_SENDS_PER_15_MINUTES,
      maxVerifyAttempts: OTP_MAX_VERIFY_ATTEMPTS,
    },
  }),
);

// Guards every /doctor route, including any added later. Express 4 does not forward rejected
// promises from middleware, so the async guard is wrapped and reports through next() itself.
app.use('/doctor', (req, res, next) => {
  void requireDoctorAccess(req, res, next);
});

class HttpError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function normalizePhone(phone: string): string {
  const trimmed = phone.trim();
  const hasPlus = trimmed.startsWith('+');
  const digitsOnly = trimmed.replace(/\D/g, '');

  if (hasPlus) {
    if (digitsOnly.length < 10 || digitsOnly.length > 15) {
      throw new HttpError(400, 'Enter a valid phone number.');
    }
    return `+${digitsOnly}`;
  }

  if (digitsOnly.length === 10) {
    return `+91${digitsOnly}`;
  }

  if (digitsOnly.length === 12 && digitsOnly.startsWith('91')) {
    return `+${digitsOnly}`;
  }

  throw new HttpError(400, 'Enter a valid Indian phone number.');
}

function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length <= 4) {
    return phone;
  }

  return `${phone.slice(0, Math.max(0, phone.length - 6))}${'*'.repeat(Math.max(0, phone.length - 6))}${phone.slice(-2)}`;
}

function addSeconds(date: Date, seconds: number): Date {
  return new Date(date.getTime() + seconds * 1000);
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

function localYmd(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseYmdAtLocalMidnight(ymd: string): Date {
  const [year, month, day] = ymd.split('-').map(Number);
  if (!year || !month || !day) {
    throw new HttpError(400, 'Invalid date.');
  }
  return new Date(year, month - 1, day, 0, 0, 0, 0);
}

function sha256(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function parseCookies(header: string | undefined): Record<string, string> {
  if (!header) {
    return {};
  }

  return header.split(';').reduce<Record<string, string>>((acc, part) => {
    const [rawName, ...rawValue] = part.trim().split('=');
    if (!rawName) {
      return acc;
    }
    acc[rawName] = decodeURIComponent(rawValue.join('='));
    return acc;
  }, {});
}

function getSessionToken(req: Request): string | null {
  const cookies = parseCookies(req.headers.cookie);
  return cookies[SESSION_COOKIE_NAME] || null;
}

function getSessionCookieOptions(expiresAt?: Date) {
  const secure = SESSION_COOKIE_SAME_SITE === 'none' ? true : SESSION_COOKIE_SECURE;

  return {
    httpOnly: true,
    sameSite: SESSION_COOKIE_SAME_SITE,
    secure,
    ...(SESSION_COOKIE_DOMAIN ? { domain: SESSION_COOKIE_DOMAIN } : {}),
    ...(expiresAt ? { expires: expiresAt } : {}),
    path: '/',
  } as const;
}

function setSessionCookie(res: Response, token: string, expiresAt: Date): void {
  res.cookie(SESSION_COOKIE_NAME, token, getSessionCookieOptions(expiresAt));
}

function clearSessionCookie(res: Response): void {
  res.clearCookie(SESSION_COOKIE_NAME, getSessionCookieOptions());
}

/**
 * The doctor portal is a separate origin from the API in production, so its cookie needs the same
 * SameSite/domain treatment as the patient one and reuses that configuration wholesale. Only the
 * name differs, which keeps a doctor session and a patient session independent on one browser.
 */
function getDoctorSessionToken(req: Request): string | null {
  const cookies = parseCookies(req.headers.cookie);
  return cookies[DOCTOR_COOKIE_NAME] || null;
}

function setDoctorSessionCookie(res: Response, token: string, expiresAt: Date): void {
  res.cookie(DOCTOR_COOKIE_NAME, token, getSessionCookieOptions(expiresAt));
}

function clearDoctorSessionCookie(res: Response): void {
  res.clearCookie(DOCTOR_COOKIE_NAME, getSessionCookieOptions());
}

function setNoStoreHeaders(res: Response): void {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
}

type UserWithSubscription = {
  id: string;
  phone: string;
  name: string | null;
  email: string | null;
  onboardingCompleted: boolean;
  phoneVerifiedAt: Date | null;
  createdAt: Date;
  subscription?: {
    plan: 'monthly' | 'annual' | null;
    status: 'trialing' | 'active' | 'past_due' | 'canceled';
    startedAt: Date;
    trialEndsAt: Date | null;
    renewsAt: Date | null;
  } | null;
  detailedAssessment?: {
    status: 'in_progress' | 'completed';
  } | null;
};

function getSubscriptionAccessState(subscription: UserWithSubscription['subscription']) {
  const now = new Date();

  if (!subscription) {
    return {
      hasActiveAccess: false,
      trialAvailable: true,
      requiresPayment: false,
    };
  }

  if (subscription.status === 'active') {
    return {
      hasActiveAccess: true,
      trialAvailable: false,
      requiresPayment: false,
    };
  }

  if (subscription.status === 'trialing') {
    const hasActiveTrial = !!subscription.trialEndsAt && subscription.trialEndsAt > now;
    return {
      hasActiveAccess: hasActiveTrial,
      trialAvailable: false,
      requiresPayment: !hasActiveTrial,
    };
  }

  return {
    hasActiveAccess: false,
    trialAvailable: false,
    requiresPayment: true,
  };
}

function serializeUser(user: {
  id: string;
  phone: string;
  name: string | null;
  email: string | null;
  onboardingCompleted: boolean;
  phoneVerifiedAt: Date | null;
  createdAt: Date;
  subscription?: UserWithSubscription['subscription'];
  detailedAssessment?: UserWithSubscription['detailedAssessment'];
}): AuthUser {
  const access = getSubscriptionAccessState(user.subscription ?? null);

  return authUserSchema.parse({
    id: user.id,
    phone: user.phone,
    name: user.name,
    email: user.email,
    onboardingCompleted: user.onboardingCompleted,
    detailedAssessmentStatus: user.detailedAssessment?.status ?? 'not_started',
    subscriptionPlan: user.subscription?.plan ?? null,
    subscriptionStatus: user.subscription?.status ?? null,
    subscriptionStartedAt: user.subscription?.startedAt.toISOString() ?? null,
    trialEndsAt: user.subscription?.trialEndsAt?.toISOString() ?? null,
    renewsAt: user.subscription?.renewsAt?.toISOString() ?? null,
    hasActiveAccess: access.hasActiveAccess,
    trialAvailable: access.trialAvailable,
    requiresPayment: access.requiresPayment,
    phoneVerifiedAt: user.phoneVerifiedAt?.toISOString() ?? null,
    createdAt: user.createdAt.toISOString(),
  });
}

async function loadUserWithSubscription(userId: string): Promise<UserWithSubscription> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      subscription: {
        select: {
          plan: true,
          status: true,
          startedAt: true,
          trialEndsAt: true,
          renewsAt: true,
        },
      },
      detailedAssessment: {
        select: {
          status: true,
        },
      },
    },
  });

  if (!user) {
    throw new HttpError(404, 'User not found.');
  }

  // A tombstone from a completed erasure. Its sessions are deleted with everything else, so nothing
  // should reach here — this is the guard that holds if a session ever survives, and it covers every
  // authenticated route at once rather than one at a time.
  if (user.erasedAt) {
    throw new HttpError(401, 'This account has been deleted.');
  }

  return user;
}

function getTwoFactorApiKey(): string {
  const apiKey = process.env.TWOFACTOR_API_KEY;
  if (!apiKey) {
    throw new HttpError(500, '2Factor is not configured on the server.');
  }
  return apiKey;
}

type TwoFactorResponse = {
  Status?: string;
  Details?: string;
};

async function callTwoFactor(url: string, init?: RequestInit): Promise<TwoFactorResponse> {
  const response = await fetch(url, init);
  let payload: TwoFactorResponse | null = null;

  try {
    payload = (await response.json()) as TwoFactorResponse;
  } catch {
    payload = null;
  }

  if (!response.ok || !payload) {
    throw new HttpError(502, 'Unable to reach the OTP provider right now.');
  }

  return payload;
}

async function sendOtpWithTwoFactor(phone: string): Promise<string> {
  const apiKey = getTwoFactorApiKey();
  const encodedPhone = encodeURIComponent(phone);
  const templateSegment = TWOFACTOR_OTP_TEMPLATE_NAME ? `/${encodeURIComponent(TWOFACTOR_OTP_TEMPLATE_NAME)}` : '';
  const url = `${TWOFACTOR_BASE_URL}/${apiKey}/SMS/${encodedPhone}/AUTOGEN${templateSegment}`;
  const payload = await callTwoFactor(url, { method: 'GET' });

  if (payload.Status?.toLowerCase() !== 'success' || !payload.Details) {
    throw new HttpError(502, payload.Details || 'Unable to send OTP right now.');
  }

  return payload.Details;
}

async function verifyOtpWithTwoFactor(providerSessionId: string, otp: string): Promise<void> {
  const apiKey = getTwoFactorApiKey();
  const url = `${TWOFACTOR_BASE_URL}/${apiKey}/SMS/VERIFY/${providerSessionId}/${otp}`;
  const payload = await callTwoFactor(url);

  if (payload.Status?.toLowerCase() !== 'success') {
    throw new HttpError(400, payload.Details || 'Incorrect OTP.');
  }
}

async function requireCurrentUser(req: Request) {
  const sessionToken = getSessionToken(req);
  if (!sessionToken) {
    throw new HttpError(401, 'You are not signed in.');
  }

  const session = await prisma.session.findUnique({
    where: { tokenHash: sha256(sessionToken) },
    select: {
      id: true,
      userId: true,
      expiresAt: true,
    },
  });

  if (!session || session.expiresAt <= new Date()) {
    throw new HttpError(401, 'Your session has expired. Please sign in again.');
  }

  await prisma.session.update({
    where: { id: session.id },
    data: { lastSeenAt: new Date() },
  });

  // Every later log line on this request — including the completion line and any error —
  // carries the user it belonged to.
  req.log = req.log.child({ userId: session.userId });

  return loadUserWithSubscription(session.userId);
}

function requireBroadcastSecret(req: Request) {
  if (!PUSH_BROADCAST_SECRET) {
    throw new HttpError(503, 'PUSH_BROADCAST_SECRET is not configured.');
  }

  const provided = typeof req.query.secret === 'string' ? req.query.secret : '';
  if (provided !== PUSH_BROADCAST_SECRET) {
    throw new HttpError(401, 'Invalid or missing secret query parameter.');
  }
}

/**
 * Who is behind an authenticated /doctor request. `doctor` is a practitioner and only ever sees
 * their own consultations; `admin` is an ops login — a Specialist row with `portalRole = admin`,
 * kept out of every patient-facing query — and sees every booking. Both are named rows, so either
 * is attributable in logs.
 */
type DoctorIdentity = {
  /** The Specialist row behind the session — the same row for both scopes. */
  specialistRowId: string;
  username: string;
} & (
  | { scope: 'admin'; specialistId: null; specialistKey: null; specialistName: null }
  | { scope: 'doctor'; specialistId: string; specialistKey: string; specialistName: string }
);

// Keyed by request object rather than a global Express type augmentation, so the identity cannot
// be read on a request that never went through the guard.
const doctorIdentities = new WeakMap<Request, DoctorIdentity>();

function requireDoctorIdentity(req: Request): DoctorIdentity {
  const identity = doctorIdentities.get(req);
  if (!identity) {
    throw new HttpError(401, 'Sign in to continue.');
  }

  return identity;
}

/** Only the doctor's own consultations, or every one of them for the admin key. */
function doctorConsultationScope(identity: DoctorIdentity): { specialistId?: string } {
  return identity.scope === 'doctor' ? { specialistId: identity.specialistId } : {};
}

/**
 * Resolves the session cookie to the account behind it, or null when there is no usable session.
 * A `doctor` account whose specialist row has been deactivated resolves to null: deactivating the
 * specialist is how a doctor is taken off the portal, and it must not silently keep working.
 */
async function resolveDoctorIdentity(token: string): Promise<DoctorIdentity | null> {
  const session = await prisma.specialistSession.findUnique({
    where: { tokenHash: sha256(token) },
    include: {
      specialist: {
        select: {
          id: true,
          key: true,
          name: true,
          username: true,
          portalRole: true,
          active: true,
        },
      },
    },
  });

  if (!session) {
    return null;
  }

  if (session.expiresAt.getTime() <= Date.now()) {
    await prisma.specialistSession.delete({ where: { id: session.id } }).catch(() => undefined);
    return null;
  }

  const specialist = session.specialist;
  if (!specialist.active) {
    return null;
  }

  // lastSeenAt is best-effort telemetry; a failed write must not fail the request.
  void prisma.specialistSession
    .update({ where: { id: session.id }, data: { lastSeenAt: new Date() } })
    .catch(() => undefined);

  return toDoctorIdentity(specialist);
}

/** The one place a Specialist row becomes an identity, so login and the guard cannot disagree. */
function toDoctorIdentity(specialist: {
  id: string;
  key: string;
  name: string;
  username: string | null;
  portalRole: 'doctor' | 'admin';
}): DoctorIdentity {
  const username = specialist.username ?? '';

  return specialist.portalRole === 'admin'
    ? {
        specialistRowId: specialist.id,
        username,
        scope: 'admin',
        specialistId: null,
        specialistKey: null,
        specialistName: null,
      }
    : {
        specialistRowId: specialist.id,
        username,
        scope: 'doctor',
        specialistId: specialist.id,
        specialistKey: specialist.key,
        specialistName: specialist.name,
      };
}

/**
 * Every /doctor route exposes patient names, phone numbers, and the ability to mint a LiveKit
 * token, so they are gated behind a signed-in session. The login and logout routes are the only
 * exceptions — they are what creates and destroys the session in the first place.
 *
 * Fails closed: a missing cookie, an expired or unknown session, a deactivated account, or a
 * deactivated specialist is a 401.
 */
const DOCTOR_PUBLIC_PATHS = new Set(['/auth/login', '/auth/logout']);

async function requireDoctorAccess(req: Request, _res: Response, next: NextFunction) {
  try {
    if (DOCTOR_PUBLIC_PATHS.has(req.path)) {
      next();
      return;
    }

    const token = getDoctorSessionToken(req);
    const identity = token ? await resolveDoctorIdentity(token) : null;
    if (!identity) {
      throw new HttpError(401, 'Sign in to continue.');
    }

    doctorIdentities.set(req, identity);
    req.log = req.log.child({
      doctorScope: identity.scope,
      doctorUsername: identity.username,
      ...(identity.specialistKey ? { specialistKey: identity.specialistKey } : {}),
    });

    next();
  } catch (error) {
    next(error);
  }
}

function isBookableDoctorKey(key: string): boolean {
  return BOOKABLE_DOCTOR_KEYS.has(key);
}

async function readyBookingCatalog() {
  await ensureBookingCatalog(prisma);
}

function getLiveKitConfig() {
  if (!LIVEKIT_URL || !LIVEKIT_API_KEY || !LIVEKIT_API_SECRET) {
    throw new HttpError(503, 'LiveKit is not configured on the server.');
  }

  return {
    url: LIVEKIT_URL,
    apiKey: LIVEKIT_API_KEY,
    apiSecret: LIVEKIT_API_SECRET,
  };
}

function getRoomServiceClient() {
  const config = getLiveKitConfig();
  return new RoomServiceClient(config.url, config.apiKey, config.apiSecret);
}

function getEgressClient() {
  const config = getLiveKitConfig();
  return new EgressClient(config.url, config.apiKey, config.apiSecret);
}

function consultationRoomName(consultationId: string): string {
  return `consultation_${consultationId.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
}

type ConsultationCallRecord = {
  id: string;
  consultationId: string;
  roomName: string;
  status: 'waiting' | 'active' | 'ended' | 'failed';
  doctorStartedAt: Date | null;
  patientJoinedAt: Date | null;
  recordingStartedAt: Date | null;
  endedAt: Date | null;
  recordings?: ConsultationRecordingRecord[];
  consents?: {
    userId: string;
  }[];
};

type ConsultationRecordingRecord = {
  id: string;
  consultationCallId: string;
  participantRole: 'doctor' | 'patient' | 'mixed';
  participantIdentity: string;
  egressId: string | null;
  status: 'starting' | 'recording' | 'processing' | 'ready' | 'failed';
  storagePath: string | null;
  startedAt: Date | null;
  completedAt: Date | null;
  durationSeconds: number | null;
  errorMessage: string | null;
};

type DoctorConsultationRow = {
  id: string;
  specialist: {
    key: string;
    name: string;
  };
  user: {
    id: string;
    name: string | null;
  };
  slot: {
    endsAt: Date;
  } | null;
  documents: { id: string }[];
  call: {
    status: 'waiting' | 'active' | 'ended' | 'failed';
    recordings: ConsultationRecordingRecord[];
  } | null;
  scheduledAt: Date;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled';
  isFree: boolean;
  createdAt: Date;
};

const RECORDING_STATUS_PRECEDENCE = [
  'failed',
  'recording',
  'starting',
  'processing',
  'ready',
] as const;

/**
 * Each participant is recorded to its own file, but clients only care whether the
 * consultation as a whole is being captured. Collapse the per-participant rows into
 * the single recording view both PWAs already render.
 */
function aggregateRecording(allRecordings: ConsultationRecordingRecord[] | undefined) {
  // The mixed track is a derived artifact, not a capture. Clients ask "is this consultation being
  // recorded", so a still-running ffmpeg must not hold the status at `processing`, and a failed
  // mixdown must not report `failed` while both real recordings are safely on disk.
  const recordings = allRecordings?.filter((r) => r.participantRole !== 'mixed');

  if (!recordings?.length) {
    return null;
  }

  const status =
    RECORDING_STATUS_PRECEDENCE.find((candidate) =>
      recordings.some((recording) => recording.status === candidate),
    ) ?? 'starting';

  const startedAt = recordings
    .map((recording) => recording.startedAt)
    .filter((value): value is Date => value !== null)
    .sort((a, b) => a.getTime() - b.getTime())[0];

  const allSettled = recordings.every(
    (recording) => recording.status === 'ready' || recording.status === 'failed',
  );
  const completedAt = allSettled
    ? recordings
        .map((recording) => recording.completedAt)
        .filter((value): value is Date => value !== null)
        .sort((a, b) => b.getTime() - a.getTime())[0]
    : undefined;

  const durations = recordings
    .map((recording) => recording.durationSeconds)
    .filter((value): value is number => value !== null);

  return {
    status,
    // Recordings are per participant now, so there is no single storage path to expose.
    storagePath: null,
    startedAt: startedAt?.toISOString() ?? null,
    completedAt: completedAt?.toISOString() ?? null,
    durationSeconds: durations.length ? Math.max(...durations) : null,
    errorMessage: recordings.find((recording) => recording.errorMessage)?.errorMessage ?? null,
  };
}

function serializeConsultationCallState(
  consultationId: string,
  call: ConsultationCallRecord | null,
  patientConsented: boolean,
): ConsultationCallState {
  return consultationCallStateSchema.parse({
    consultationId,
    roomName: call?.roomName ?? null,
    status: call?.status ?? null,
    doctorStartedAt: call?.doctorStartedAt?.toISOString() ?? null,
    patientJoinedAt: call?.patientJoinedAt?.toISOString() ?? null,
    recordingStartedAt: call?.recordingStartedAt?.toISOString() ?? null,
    endedAt: call?.endedAt?.toISOString() ?? null,
    patientConsentRequired: LIVEKIT_RECORDING_ENABLED,
    patientConsented: !LIVEKIT_RECORDING_ENABLED || patientConsented,
    recording: aggregateRecording(call?.recordings),
  });
}

async function createJoinToken(args: {
  roomName: string;
  consultationId: string;
  role: 'doctor' | 'patient';
  identity: string;
  name: string;
}): Promise<string> {
  const config = getLiveKitConfig();
  const token = new AccessToken(config.apiKey, config.apiSecret, {
    identity: args.identity,
    name: args.name,
    ttl: LIVEKIT_TOKEN_TTL,
    metadata: JSON.stringify({
      consultationId: args.consultationId,
      role: args.role,
    }),
  });

  token.addGrant({
    roomJoin: true,
    room: args.roomName,
    canPublish: true,
    canSubscribe: true,
    canPublishData: true,
  });

  return token.toJwt();
}

async function ensureLiveKitRoom(roomName: string, consultationId: string): Promise<void> {
  const roomClient = getRoomServiceClient();

  try {
    await roomClient.createRoom({
      name: roomName,
      emptyTimeout: 10 * 60,
      departureTimeout: 2 * 60,
      maxParticipants: 2,
      metadata: JSON.stringify({ consultationId }),
    });
  } catch (error) {
    if (error instanceof Error && /already exists|exists|already/i.test(error.message)) {
      return;
    }
    throw error;
  }
}

/**
 * Scoped by identity: a doctor asking for someone else's consultation gets the same 404 as one
 * that does not exist, so the portal cannot be used to enumerate other doctors' bookings.
 */
async function getDoctorConsultation(consultationId: string, identity: DoctorIdentity) {
  const consultation = await prisma.consultation.findFirst({
    where: { id: consultationId, ...doctorConsultationScope(identity) },
    include: {
      specialist: { select: { name: true } },
      // No phone: the doctor portal never shows patient contact details.
      user: { select: { id: true, name: true } },
      call: {
        include: {
          recordings: true,
          consents: { select: { userId: true } },
        },
      },
    },
  });

  if (!consultation) {
    throw new HttpError(404, 'Consultation not found.');
  }

  if (consultation.status === 'cancelled') {
    throw new HttpError(400, 'This consultation cannot be called.');
  }

  return consultation;
}

async function getPatientConsultation(consultationId: string, userId: string) {
  const consultation = await prisma.consultation.findFirst({
    where: {
      id: consultationId,
      userId,
    },
    include: {
      specialist: { select: { name: true } },
      call: {
        include: {
          recordings: true,
          consents: { select: { userId: true } },
        },
      },
    },
  });

  if (!consultation) {
    throw new HttpError(404, 'Consultation not found.');
  }

  return consultation;
}

function hasPatientConsent(call: ConsultationCallRecord | null | undefined, userId: string): boolean {
  return call?.consents?.some((consent) => consent.userId === userId) ?? false;
}

async function ensureConsultationCall(consultationId: string): Promise<ConsultationCallRecord> {
  const roomName = consultationRoomName(consultationId);
  const now = new Date();

  const existing = await prisma.consultationCall.findUnique({
    where: { consultationId },
    include: {
      recordings: true,
      consents: { select: { userId: true } },
    },
  });

  if (existing) {
    if (existing.status === 'ended') {
      throw new HttpError(400, 'This consultation call has already ended.');
    }

    const call = await prisma.consultationCall.update({
      where: { id: existing.id },
      data: { doctorStartedAt: now },
      include: {
        recordings: true,
        consents: { select: { userId: true } },
      },
    });

    await ensureLiveKitRoom(call.roomName, consultationId);
    return call;
  }

  const call = await prisma.consultationCall.create({
    data: {
      consultationId,
      roomName,
      status: 'waiting',
      doctorStartedAt: now,
    },
    include: {
      recordings: true,
      consents: { select: { userId: true } },
    },
  });

  await ensureLiveKitRoom(roomName, consultationId);
  return call;
}

function recordingStoragePath(roomName: string, role: 'doctor' | 'patient'): string {
  const extension = LIVEKIT_RECORDING_AUDIO_ONLY ? 'ogg' : 'mp4';
  return `${LIVEKIT_RECORDING_FILE_PREFIX}/${roomName}-${role}-{time}.${extension}`;
}

/**
 * Participant identities are minted in createJoinToken as `doctor:<consultationId>`
 * and `patient:<userId>:<consultationId>`.
 */
function roleFromIdentity(identity: string): 'doctor' | 'patient' | null {
  if (identity.startsWith('doctor:')) {
    return 'doctor';
  }
  if (identity.startsWith('patient:')) {
    return 'patient';
  }
  return null;
}

function durationFromEgress(startedAt: bigint, endedAt: bigint): number | null {
  if (startedAt <= 0n || endedAt <= startedAt) {
    return null;
  }

  return Number((endedAt - startedAt) / 1_000_000_000n);
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === 'object' && error !== null && (error as { code?: string }).code === 'P2002'
  );
}

async function syncRecordingStatus(recording: ConsultationRecordingRecord) {
  if (!recording.egressId) {
    return recording;
  }

  if (recording.status === 'ready' || recording.status === 'failed') {
    return recording;
  }

  const [egress] = await getEgressClient().listEgress({ egressId: recording.egressId });
  if (!egress) {
    return recording;
  }

  if (egress.status === EgressStatus.EGRESS_COMPLETE) {
    // storagePath was written with LiveKit's `{time}` placeholder still in it, so it does not
    // name a real file. Egress reports the resolved filename once it finishes — record that,
    // otherwise nothing downstream (mixdown, archival, playback) can find the recording.
    const filename = egress.fileResults?.[0]?.filename;

    return prisma.consultationRecording.update({
      where: { id: recording.id },
      data: {
        status: 'ready',
        completedAt: new Date(),
        durationSeconds: durationFromEgress(egress.startedAt, egress.endedAt),
        ...(filename ? { storagePath: filename } : {}),
      },
    });
  }

  if (
    egress.status === EgressStatus.EGRESS_FAILED ||
    egress.status === EgressStatus.EGRESS_ABORTED
  ) {
    return prisma.consultationRecording.update({
      where: { id: recording.id },
      data: {
        status: 'failed',
        completedAt: new Date(),
        errorMessage: egress.error || 'Recording failed.',
      },
    });
  }

  if (egress.status === EgressStatus.EGRESS_ENDING && recording.status !== 'processing') {
    return prisma.consultationRecording.update({
      where: { id: recording.id },
      data: { status: 'processing' },
    });
  }

  return recording;
}

async function syncCallRecordings(recordings: ConsultationRecordingRecord[]): Promise<void> {
  await Promise.all(recordings.map((recording) => syncRecordingStatus(recording)));
}

/**
 * Egress writes to a path that is only meaningful inside its own container (LIVEKIT_RECORDING_FILE_PREFIX,
 * e.g. `/out`). RECORDING_LOCAL_DIR is where that volume actually lands on the API's filesystem,
 * which is the only way this process can open the files to mix them.
 */
function localRecordingPath(storagePath: string): string | null {
  if (!RECORDING_LOCAL_DIR) {
    return null;
  }

  return path.join(RECORDING_LOCAL_DIR, path.basename(storagePath));
}

/**
 * Mixes the two per-speaker files into one combined track.
 *
 * No egress type can do this for us: track composite takes a single audio track, and room
 * composite — the only one that mixes a whole room — is the headless-Chrome path we moved off.
 * So the participant files are mixed after the fact, which keeps recording cheap and preserves
 * the speaker-separated originals for transcription.
 *
 * Idempotent: the unique (consultationCallId, participantRole) index makes the `mixed` row the
 * lock, so concurrent egress_ended webhooks cannot start two ffmpeg runs for one call.
 */
async function maybeMixCallRecording(consultationCallId: string): Promise<void> {
  if (!RECORDING_LOCAL_DIR) {
    return;
  }

  const call = await prisma.consultationCall.findUnique({
    where: { id: consultationCallId },
    include: { recordings: true },
  });

  if (!call) {
    return;
  }

  const doctor = call.recordings.find((r) => r.participantRole === 'doctor');
  const patient = call.recordings.find((r) => r.participantRole === 'patient');
  const alreadyMixed = call.recordings.some((r) => r.participantRole === 'mixed');

  // Both sides have to be finished; a mix of a half-written file is worthless.
  if (alreadyMixed || !doctor?.storagePath || !patient?.storagePath) {
    return;
  }
  if (doctor.status !== 'ready' || patient.status !== 'ready') {
    return;
  }

  const doctorFile = localRecordingPath(doctor.storagePath);
  const patientFile = localRecordingPath(patient.storagePath);
  if (!doctorFile || !patientFile) {
    return;
  }

  const outputName = `${call.roomName}-mixed.ogg`;
  const outputFile = path.join(RECORDING_LOCAL_DIR, outputName);

  try {
    await Promise.all([fs.access(doctorFile), fs.access(patientFile)]);
  } catch {
    logger.warn(
      { room: call.roomName, doctorFile, patientFile },
      'Cannot mix recording: participant files are not readable from the API',
    );
    return;
  }

  try {
    await prisma.consultationRecording.create({
      data: {
        consultationCallId: call.id,
        participantRole: 'mixed',
        participantIdentity: 'mixed',
        status: 'processing',
        storagePath: path.join(LIVEKIT_RECORDING_FILE_PREFIX, outputName),
      },
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return;
    }
    throw error;
  }

  const where = {
    consultationCallId_participantRole: {
      consultationCallId: call.id,
      participantRole: 'mixed' as const,
    },
  };

  try {
    // normalize=0 keeps each speaker at their original level; amix otherwise attenuates every
    // input, which makes a two-person consultation noticeably quiet.
    await execFileAsync('ffmpeg', [
      '-y',
      '-i',
      doctorFile,
      '-i',
      patientFile,
      '-filter_complex',
      'amix=inputs=2:duration=longest:normalize=0',
      '-c:a',
      'libopus',
      outputFile,
    ]);

    await prisma.consultationRecording.update({
      where,
      data: {
        status: 'ready',
        completedAt: new Date(),
        durationSeconds: Math.max(doctor.durationSeconds ?? 0, patient.durationSeconds ?? 0) || null,
      },
    });

    logger.info({ room: call.roomName, file: outputName }, 'Recording mixdown complete');
  } catch (error) {
    logger.error({ err: error, room: call.roomName }, 'ffmpeg mixdown failed');
    await prisma.consultationRecording.update({
      where,
      data: {
        status: 'failed',
        completedAt: new Date(),
        errorMessage: error instanceof Error ? error.message : 'ffmpeg mixdown failed.',
      },
    });
  }
}

async function stopCallRecordings(recordings: ConsultationRecordingRecord[]): Promise<void> {
  const live = recordings.filter(
    (recording) =>
      recording.egressId && ['starting', 'recording', 'processing'].includes(recording.status),
  );

  await Promise.all(
    live.map(async (recording) => {
      try {
        await getEgressClient().stopEgress(recording.egressId as string);
        await prisma.consultationRecording.update({
          where: { id: recording.id },
          data: { status: 'processing' },
        });
      } catch (error) {
        logger.error(
          { err: error, role: recording.participantRole, egressId: recording.egressId },
          'Unable to stop recording',
        );
      }
    }),
  );
}

async function startParticipantRecording(
  call: { id: string; roomName: string },
  identity: string,
  role: 'doctor' | 'patient',
  audioTrackSid: string,
): Promise<void> {
  const filepath = recordingStoragePath(call.roomName, role);
  const where = {
    consultationCallId_participantRole: {
      consultationCallId: call.id,
      participantRole: role,
    },
  };

  // The unique (consultationCallId, participantRole) index is the lock. Concurrent
  // webhooks for the same participant race here, and the loser bails out.
  try {
    await prisma.consultationRecording.create({
      data: {
        consultationCallId: call.id,
        participantRole: role,
        participantIdentity: identity,
        status: 'starting',
        storagePath: filepath,
      },
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return;
    }
    throw error;
  }

  try {
    let egress;

    if (LIVEKIT_RECORDING_AUDIO_ONLY) {
      // Track egress on the mic track alone. Participant egress cannot do this: it has no
      // audio-only flag, so it always plans for video too, and then fails with "no
      // supported codec is compatible with all outputs" against an audio container.
      //
      // A DirectFileOutput writes the publisher's Opus straight to disk with no transcode
      // and no Chrome, which is both the cheapest option available and natively ingestible
      // by speech-to-text.
      egress = await getEgressClient().startTrackEgress(
        call.roomName,
        new DirectFileOutput({ filepath }),
        audioTrackSid,
      );
    } else {
      egress = await getEgressClient().startParticipantEgress(call.roomName, identity, {
        file: new EncodedFileOutput({ fileType: EncodedFileType.MP4, filepath }),
      });
    }

    const startedAt = new Date();

    await prisma.$transaction([
      prisma.consultationCall.updateMany({
        where: { id: call.id, recordingStartedAt: null },
        data: { recordingStartedAt: startedAt },
      }),
      prisma.consultationRecording.update({
        where,
        data: {
          egressId: egress.egressId,
          status: 'recording',
          startedAt,
          errorMessage: null,
        },
      }),
    ]);

    logger.info(
      { room: call.roomName, role, egressId: egress.egressId, audioOnly: LIVEKIT_RECORDING_AUDIO_ONLY },
      'Recording started',
    );
  } catch (error) {
    // One participant failing to record must not tear down the call or the request that
    // triggered this. The failure surfaces through the aggregated recording status.
    logger.error({ err: error, role, room: call.roomName }, 'Unable to start recording');
    await prisma.consultationRecording.update({
      where,
      data: {
        status: 'failed',
        errorMessage: error instanceof Error ? error.message : 'Unable to start recording.',
      },
    });
  }
}

/**
 * Tears a consultation call down. Either side can end the call, so this runs for both the
 * doctor's End and the patient's Leave, and is idempotent for an already-ended call.
 *
 * Deleting the room is what disconnects whoever is still in it — that is how the other side
 * learns the call is over. Recordings are stopped first so egress finalises its files rather
 * than being cut off mid-write.
 */
async function endConsultationCall(
  call: ConsultationCallRecord,
): Promise<ConsultationCallRecord | null> {
  await stopCallRecordings(call.recordings ?? []);

  try {
    await getRoomServiceClient().deleteRoom(call.roomName);
  } catch (error) {
    logger.error({ err: error, room: call.roomName }, 'Unable to delete LiveKit room on call end');
  }

  const endedCall = await prisma.consultationCall.update({
    where: { id: call.id },
    data: {
      status: 'ended',
      endedAt: call.endedAt ?? new Date(),
    },
    include: {
      recordings: true,
      consents: { select: { userId: true } },
    },
  });

  await syncCallRecordings(endedCall.recordings);

  logger.info(
    {
      room: endedCall.roomName,
      callId: endedCall.id,
      recordings: endedCall.recordings.length,
    },
    'Consultation call ended',
  );

  // Usually a no-op here — egress is still finalising, so the mix is normally kicked off by the
  // egress_ended webhook instead. This covers the case where both files were already complete.
  await maybeMixCallRecording(endedCall.id);

  return prisma.consultationCall.findUnique({
    where: { id: endedCall.id },
    include: {
      recordings: true,
      consents: { select: { userId: true } },
    },
  });
}

/**
 * Starts participant egress for everyone in the room who is publishing audio and is not
 * recorded yet. Idempotent, so it is safe to call from both the join route and the LiveKit
 * webhook — whoever gets there first wins, and late publishers are picked up on their
 * track_published event.
 */
async function reconcileCallRecordings(roomName: string): Promise<void> {
  if (!LIVEKIT_RECORDING_ENABLED) {
    return;
  }

  const call = await prisma.consultationCall.findUnique({
    where: { roomName },
    include: {
      recordings: true,
      consents: { select: { userId: true } },
      consultation: { select: { userId: true } },
    },
  });

  if (!call || call.status === 'ended') {
    return;
  }

  // Consent gates every recording in the room, the doctor's included.
  if (!hasPatientConsent(call, call.consultation.userId)) {
    return;
  }

  let participants;
  try {
    participants = await getRoomServiceClient().listParticipants(roomName);
  } catch (error) {
    logger.error(
      { err: error, room: roomName },
      'Unable to list participants while reconciling recordings',
    );
    return;
  }

  for (const participant of participants) {
    const role = roleFromIdentity(participant.identity);
    if (!role || call.recordings.some((recording) => recording.participantRole === role)) {
      continue;
    }

    // Egress attaches to a live audio track, so anyone who has joined but not yet published
    // a mic is skipped here and picked up on their track_published webhook instead.
    const audioTrack = participant.tracks.find((track) => track.type === TrackType.AUDIO);
    if (!audioTrack) {
      continue;
    }

    await startParticipantRecording(call, participant.identity, role, audioTrack.sid);
  }
}

async function notifyPatientCallStarted(consultationId: string, patientId: string, doctorName: string) {
  const rows: Array<{ token: string }> = await prisma.fcmToken.findMany({
    where: {
      userId: patientId,
      status: 'ACTIVE',
    },
    select: {
      token: true,
    },
  });
  const tokens: string[] = [...new Set(rows.map((row) => row.token))];

  if (tokens.length === 0) {
    return;
  }

  try {
    await sendPushToAllTokens(
      tokens,
      {
        title: 'Doctor is ready',
        body: `${doctorName} has started your consultation call.`,
      },
      {
        url: `/consultations/${consultationId}/call`,
        type: 'consultation-call',
        consultationId,
      },
    );
    logger.info(
      { consultationId, userId: patientId, tokens: tokens.length, type: 'consultation-call' },
      'Push sent',
    );
  } catch (error) {
    logger.error(
      { err: error, consultationId, userId: patientId, tokens: tokens.length },
      'Unable to send consultation call push notification',
    );
  }
}

// notifyAskerQuestionAnswered lives in ./qaNotifications.js — the admin panel's Expert Answers
// create needs the same push, and it cannot import this file.

function serializeSpecialist(specialist: {
  key: string;
  name: string;
  subtitle: string | null;
  role: string | null;
  specialization: string | null;
  summary: string | null;
  experience: string | null;
  tag: string | null;
  imageUrl: string | null;
  qualifications: { label: string }[];
}) {
  const bookable = isBookableDoctorKey(specialist.key);

  return {
    key: specialist.key,
    name: specialist.name,
    subtitle: specialist.subtitle,
    role: specialist.role,
    specialization: specialist.specialization,
    summary: specialist.summary,
    experience: specialist.experience,
    tag: specialist.tag,
    imageUrl: specialist.imageUrl,
    qualifications: specialist.qualifications.map((qualification) => qualification.label),
    bookable,
    bookingDisabledReason: bookable ? null : 'Booking for this specialist is coming soon.',
  };
}

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

// ─────────────────────────────────────────────
// Patient's own bookings
// ─────────────────────────────────────────────

type DoctorNotificationRow = {
  id: string;
  type: 'consultation_booked' | 'consultation_cancelled' | 'consultation_rescheduled' | 'question_asked';
  title: string;
  body: string;
  url: string | null;
  consultationId: string | null;
  questionId: string | null;
  readAt: Date | null;
  createdAt: Date;
};

type MyConsultationRow = {
  id: string;
  specialistId: string;
  scheduledAt: Date;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled';
  isFree: boolean;
  specialist: { key: string; name: string; role: string | null; imageUrl: string | null };
  slot: { endsAt: Date } | null;
  documents: { id: string }[];
  call:
    | {
        status: 'waiting' | 'active' | 'ended' | 'failed';
        recordings: { participantRole: string; status: string; durationSeconds: number | null }[];
      }
    | null;
};

/**
 * A booking can only be changed while it is still confirmed, still in the future, and the call
 * has not started. Once the doctor opens the room the appointment is effectively underway, so
 * letting the patient move or cancel it would strand the doctor in a live call.
 */
function isConsultationMutable(row: MyConsultationRow, now: Date): boolean {
  if (row.status !== 'confirmed' && row.status !== 'pending') {
    return false;
  }
  if (row.scheduledAt <= now) {
    return false;
  }
  return row.call === null || row.call.status === 'waiting';
}

function serializeMyConsultation(row: MyConsultationRow, now: Date) {
  // Only the combined track is offered to the patient. The per-speaker files exist for
  // transcription, and handing them out separately would expose more than the consultation.
  const mixed = row.call?.recordings.find((r) => r.participantRole === 'mixed') ?? null;
  const mutable = isConsultationMutable(row, now);
  const joinWindowOpen = row.scheduledAt > new Date(now.getTime() - 2 * 60 * 60 * 1000);

  return myConsultationSchema.parse({
    consultationId: row.id,
    specialistKey: row.specialist.key,
    specialistName: row.specialist.name,
    specialistRole: row.specialist.role,
    specialistImageUrl: row.specialist.imageUrl,
    scheduledAt: row.scheduledAt.toISOString(),
    endsAt: row.slot?.endsAt.toISOString() ?? null,
    status: row.status,
    isFree: row.isFree,
    callStatus: row.call?.status ?? null,
    canCancel: mutable,
    canReschedule: mutable,
    canJoin:
      row.status === 'confirmed' &&
      joinWindowOpen &&
      (row.call?.status === 'waiting' || row.call?.status === 'active'),
    recordingAvailable: mixed?.status === 'ready',
    recordingStatus: (mixed?.status as never) ?? null,
    recordingDurationSeconds: mixed?.durationSeconds ?? null,
    documentCount: row.documents.length,
  });
}

/** The client handed to an interactive transaction: the full client minus the top-level-only calls. */
type BookingTx = Omit<
  typeof prisma,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;

/**
 * Serializes one patient's concurrent booking attempts. The overlap check below is a
 * read-then-write race on its own: two requests firing at once both see a clear calendar and both
 * insert. Locking the patient's own row is enough — bookings for different patients never contend,
 * and every booking path takes this lock before touching a slot, so the lock order is consistent.
 */
async function lockUserForBooking(tx: BookingTx, userId: string): Promise<void> {
  await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${userId} FOR UPDATE`;
}

/**
 * Stops a patient holding two appointments at the same time. The slot guard only prevents two
 * patients claiming one slot — nothing stopped one patient claiming overlapping slots from two
 * different doctors.
 *
 * Overlap is measured against the slot each existing booking holds; rows booked outside the slot
 * flow (seeds, admin fixtures) carry no slot, so their scheduledAt is treated as a point in time.
 * `excludeConsultationId` lets a reschedule ignore the booking it is about to move.
 */
async function assertNoOverlappingBooking(
  tx: BookingTx,
  args: { userId: string; startsAt: Date; endsAt: Date; excludeConsultationId?: string },
): Promise<void> {
  const clash = await tx.consultation.findFirst({
    where: {
      userId: args.userId,
      status: { in: ['pending', 'confirmed'] },
      ...(args.excludeConsultationId ? { id: { not: args.excludeConsultationId } } : {}),
      OR: [
        { slot: { is: { startsAt: { lt: args.endsAt }, endsAt: { gt: args.startsAt } } } },
        { slot: { is: null }, scheduledAt: { gte: args.startsAt, lt: args.endsAt } },
      ],
    },
    select: { id: true },
  });

  if (clash) {
    throw new HttpError(409, 'You already have an appointment at this time.');
  }
}

const MY_CONSULTATION_INCLUDE = {
  specialist: { select: { key: true, name: true, role: true, imageUrl: true } },
  slot: { select: { endsAt: true } },
  documents: { where: { deletedAt: null }, select: { id: true } },
  call: {
    select: {
      status: true,
      recordings: {
        select: { participantRole: true, status: true, durationSeconds: true },
      },
    },
  },
} as const;

app.get('/consultations/mine', async (req, res, next) => {
  try {
    await readyBookingCatalog();
    const user = await requireCurrentUser(req);
    const now = new Date();

    const rows = (await prisma.consultation.findMany({
      where: { userId: user.id },
      include: MY_CONSULTATION_INCLUDE,
      orderBy: { scheduledAt: 'desc' },
    })) as MyConsultationRow[];

    // A cancelled booking is history no matter when it was scheduled — showing it under
    // "upcoming" would imply it is still going to happen.
    const isPast = (row: MyConsultationRow) =>
      row.scheduledAt <= now || row.status === 'completed' || row.status === 'cancelled';

    res.json(
      myConsultationsResponseSchema.parse({
        upcoming: rows
          .filter((row) => !isPast(row))
          .sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime())
          .map((row) => serializeMyConsultation(row, now)),
        past: rows.filter(isPast).map((row) => serializeMyConsultation(row, now)),
      }),
    );
  } catch (e) {
    next(e);
  }
});

app.post('/consultations/:id/cancel', async (req, res, next) => {
  try {
    const user = await requireCurrentUser(req);
    const now = new Date();

    const existing = (await prisma.consultation.findFirst({
      where: { id: req.params.id, userId: user.id },
      include: MY_CONSULTATION_INCLUDE,
    })) as MyConsultationRow | null;

    if (!existing) {
      throw new HttpError(404, 'Consultation not found.');
    }
    if (!isConsultationMutable(existing, now)) {
      throw new HttpError(400, 'This consultation can no longer be cancelled.');
    }

    const updated = (await prisma.$transaction(async (tx: any) => {
      // Releasing the slot is the point of cancelling — it has to go back on sale.
      await tx.consultationSlot.updateMany({
        where: { consultationId: existing.id },
        data: { isBooked: false, consultationId: null },
      });

      return tx.consultation.update({
        where: { id: existing.id },
        data: { status: 'cancelled' },
        include: MY_CONSULTATION_INCLUDE,
      });
    })) as MyConsultationRow;

    void notifyDoctorConsultationCancelled({
      specialistId: existing.specialistId,
      consultationId: existing.id,
      patientName: user.name,
      scheduledAt: existing.scheduledAt,
    });

    res.json(
      cancelConsultationResponseSchema.parse({
        ok: true,
        consultation: serializeMyConsultation(updated, now),
      }),
    );
  } catch (e) {
    next(e);
  }
});

/**
 * Rescheduling and changing doctor are the same operation: the patient picks a different slot,
 * and the slot carries its own specialist.
 */
app.post('/consultations/:id/reschedule', async (req, res, next) => {
  try {
    await readyBookingCatalog();
    const user = await requireCurrentUser(req);
    const parsed = rescheduleConsultationBodySchema.parse(req.body);
    const now = new Date();

    const existing = (await prisma.consultation.findFirst({
      where: { id: req.params.id, userId: user.id },
      include: MY_CONSULTATION_INCLUDE,
    })) as MyConsultationRow | null;

    if (!existing) {
      throw new HttpError(404, 'Consultation not found.');
    }
    if (!isConsultationMutable(existing, now)) {
      throw new HttpError(400, 'This consultation can no longer be rescheduled.');
    }

    const updated = (await prisma.$transaction(async (tx: any) => {
      await lockUserForBooking(tx, user.id);

      const slot = await tx.consultationSlot.findUnique({
        where: { id: parsed.slotId },
        include: { specialist: true },
      });

      if (!slot) {
        throw new HttpError(404, 'Slot not found.');
      }
      if (slot.consultationId === existing.id) {
        throw new HttpError(400, 'This is already your booked slot.');
      }
      if (!isBookableDoctorKey(slot.specialist.key)) {
        throw new HttpError(400, 'Booking is not available for this specialist yet.');
      }
      if (slot.isBooked || slot.consultationId) {
        throw new HttpError(409, 'This slot has already been booked.');
      }
      if (slot.startsAt <= now) {
        throw new HttpError(400, 'This slot is no longer available.');
      }

      // The booking being moved is excluded — its own old window is not a clash.
      await assertNoOverlappingBooking(tx, {
        userId: user.id,
        startsAt: slot.startsAt,
        endsAt: slot.endsAt,
        excludeConsultationId: existing.id,
      });

      // Free the old slot first so it becomes bookable again.
      await tx.consultationSlot.updateMany({
        where: { consultationId: existing.id },
        data: { isBooked: false, consultationId: null },
      });

      // Guarded update: if another patient claimed this slot in the meantime the count is 0
      // and the whole transaction rolls back, leaving the original booking untouched.
      const claimed = await tx.consultationSlot.updateMany({
        where: { id: slot.id, isBooked: false, consultationId: null },
        data: { isBooked: true, consultationId: existing.id },
      });

      if (claimed.count !== 1) {
        throw new HttpError(409, 'This slot has already been booked.');
      }

      return tx.consultation.update({
        where: { id: existing.id },
        data: {
          specialistId: slot.specialistId,
          scheduledAt: slot.startsAt,
          status: 'confirmed',
        },
        include: MY_CONSULTATION_INCLUDE,
      });
    })) as MyConsultationRow;

    void notifyDoctorsConsultationRescheduled({
      previousSpecialistId: existing.specialistId,
      nextSpecialistId: updated.specialistId,
      consultationId: existing.id,
      patientName: user.name,
      previousScheduledAt: existing.scheduledAt,
      nextScheduledAt: updated.scheduledAt,
    });

    res.json(
      rescheduleConsultationResponseSchema.parse({
        ok: true,
        consultation: serializeMyConsultation(updated, now),
      }),
    );
  } catch (e) {
    next(e);
  }
});

/**
 * Streams the combined consultation audio to the patient who owns it.
 *
 * The file is served through this route rather than as a static path so ownership is checked on
 * every request — these are medical recordings, and storagePath is never exposed to clients.
 * res.sendFile handles Range requests, which is what lets the browser seek.
 */
app.get('/consultations/:id/recording', async (req, res, next) => {
  try {
    const user = await requireCurrentUser(req);

    const consultation = await prisma.consultation.findFirst({
      where: { id: req.params.id, userId: user.id },
      select: { id: true, call: { select: { recordings: true } } },
    });

    if (!consultation) {
      throw new HttpError(404, 'Consultation not found.');
    }

    const mixed = consultation.call?.recordings.find(
      (r: { participantRole: string }) => r.participantRole === 'mixed',
    );

    if (!mixed || mixed.status !== 'ready' || !mixed.storagePath) {
      throw new HttpError(404, 'No recording is available for this consultation.');
    }

    const localPath = localRecordingPath(mixed.storagePath);
    if (!localPath) {
      throw new HttpError(503, 'Recording storage is not configured on this server.');
    }

    try {
      await fs.access(localPath);
    } catch {
      throw new HttpError(404, 'The recording file is missing from storage.');
    }

    res.type('audio/ogg');
    res.sendFile(localPath, (error?: Error) => {
      if (error && !res.headersSent) {
        next(error);
      }
    });
  } catch (e) {
    next(e);
  }
});

// ─────────────────────────────────────────────
// Consultation documents (prescriptions, diet plans)
// ─────────────────────────────────────────────

/**
 * A cap per consultation, not per upload: a prescription is a page or two, and an unbounded list
 * would let a compromised doctor key fill the volume.
 */
const CONSULTATION_DOCUMENT_MAX_PER_CONSULTATION = 20;

const CONSULTATION_DOCUMENT_SELECT = {
  id: true,
  consultationId: true,
  kind: true,
  title: true,
  originalName: true,
  mimeType: true,
  sizeBytes: true,
  storagePath: true,
  createdAt: true,
  uploadedBy: { select: { name: true } },
} as const;

type ConsultationDocumentRow = {
  id: string;
  consultationId: string;
  kind: 'prescription' | 'diet_plan' | 'care_plan' | 'suggestion';
  title: string | null;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  storagePath: string;
  createdAt: Date;
  uploadedBy: { name: string } | null;
};

function serializeConsultationDocument(row: ConsultationDocumentRow) {
  // storagePath is deliberately dropped — clients address the file by document id only.
  return consultationDocumentSchema.parse({
    id: row.id,
    consultationId: row.consultationId,
    kind: row.kind,
    title: row.title,
    originalName: row.originalName,
    mimeType: row.mimeType,
    sizeBytes: row.sizeBytes,
    uploadedByName: row.uploadedBy?.name ?? null,
    createdAt: row.createdAt.toISOString(),
  });
}

/**
 * Streams one document once the caller's claim to it has been checked. Served through a route
 * rather than a static mount for the same reason as the recordings: these are medical records, and
 * the on-disk layout must never become guessable.
 */
async function sendConsultationDocumentFile(
  res: Response,
  next: NextFunction,
  doc: Pick<ConsultationDocumentRow, 'storagePath' | 'mimeType' | 'originalName'>,
) {
  const absolutePath = resolveConsultationDocumentPath(doc.storagePath);
  if (!absolutePath) {
    throw new HttpError(500, 'This document is stored outside the configured directory.');
  }

  try {
    await fs.access(absolutePath);
  } catch {
    throw new HttpError(404, 'The document file is missing from storage.');
  }

  res.type(doc.mimeType);
  // Inline so an image or PDF opens in place; the filename is rebuilt from a sanitized base.
  res.setHeader(
    'Content-Disposition',
    `inline; filename="${safeDownloadName(doc.originalName, doc.mimeType)}"`,
  );
  // The PWAs fetch this as a blob, which strips every header unless CORS exposes it — without
  // this the filename is lost and a shared file arrives as "unknown".
  res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');
  // A prescription must not sit in a shared cache.
  res.setHeader('Cache-Control', 'private, no-store');
  res.sendFile(absolutePath, (error?: Error) => {
    if (error && !res.headersSent) {
      next(error);
    }
  });
}

/** Display text only, but it still goes into a header, so control characters come out. */
function sanitizeOriginalName(value: string | undefined): string {
  const cleaned = (value ?? '')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f"\\]/g, '')
    .trim()
    .slice(0, 160);

  return cleaned || 'document';
}

async function notifyPatientDocumentShared(args: {
  consultationId: string;
  patientId: string;
  doctorName: string;
  kind: 'prescription' | 'diet_plan' | 'care_plan' | 'suggestion';
}) {
  const rows: Array<{ token: string }> = await prisma.fcmToken.findMany({
    where: { userId: args.patientId, status: 'ACTIVE' },
    select: { token: true },
  });
  const tokens: string[] = [...new Set(rows.map((row) => row.token))];

  if (tokens.length === 0) {
    return;
  }

  // Warm, plain-language copy: this lands on a phone right after a consultation, so it says what
  // arrived and who sent it without sounding like a system alert.
  const copyByKind: Record<
    typeof args.kind,
    { title: string; body: string }
  > = {
    prescription: {
      title: 'Your prescription is ready 💜',
      body: `${args.doctorName} has shared your prescription. Tap to view it whenever you're ready.`,
    },
    diet_plan: {
      title: 'Your diet plan is here 🌿',
      body: `${args.doctorName} has shared your diet plan. Have a look when you have a moment.`,
    },
    care_plan: {
      title: 'Your care plan is ready 💜',
      body: `${args.doctorName} has shared your care plan. Tap to view it whenever you're ready.`,
    },
    suggestion: {
      title: 'A suggestion from your consultation',
      body: `${args.doctorName} has shared a suggestion with you. Have a look when you have a moment.`,
    },
  };
  const copy = copyByKind[args.kind];

  try {
    await sendPushToAllTokens(
      tokens,
      copy,
      {
        url: '/my-bookings',
        type: 'consultation-document',
        consultationId: args.consultationId,
      },
    );
    logger.info(
      {
        consultationId: args.consultationId,
        userId: args.patientId,
        tokens: tokens.length,
        type: 'consultation-document',
      },
      'Push sent',
    );
  } catch (error) {
    logger.error(
      { err: error, consultationId: args.consultationId, userId: args.patientId },
      'Unable to send consultation document push notification',
    );
  }
}

/** The patient's own prescriptions and plans for one consultation. */
app.get('/consultations/:id/documents', async (req, res, next) => {
  try {
    const user = await requireCurrentUser(req);

    const consultation = await prisma.consultation.findFirst({
      where: { id: req.params.id, userId: user.id },
      select: { id: true },
    });

    if (!consultation) {
      throw new HttpError(404, 'Consultation not found.');
    }

    // Newest first — the prescription from the consultation that just ended is the one being
    // looked for, not the one from three visits ago.
    const documents = (await prisma.consultationDocument.findMany({
      where: { consultationId: consultation.id, deletedAt: null },
      select: CONSULTATION_DOCUMENT_SELECT,
      orderBy: { createdAt: 'desc' },
    })) as ConsultationDocumentRow[];

    res.json(
      consultationDocumentsResponseSchema.parse({
        documents: documents.map(serializeConsultationDocument),
      }),
    );
  } catch (e) {
    next(e);
  }
});

app.get('/consultations/:id/documents/:docId/file', async (req, res, next) => {
  try {
    const user = await requireCurrentUser(req);

    // Ownership is asserted through the consultation relation, so a valid document id belonging to
    // someone else is a 404 rather than a leak.
    const doc = (await prisma.consultationDocument.findFirst({
      where: {
        id: req.params.docId,
        consultationId: req.params.id,
        deletedAt: null,
        consultation: { userId: user.id },
      },
      select: CONSULTATION_DOCUMENT_SELECT,
    })) as ConsultationDocumentRow | null;

    if (!doc) {
      throw new HttpError(404, 'Document not found.');
    }

    await sendConsultationDocumentFile(res, next, doc);
  } catch (e) {
    next(e);
  }
});

app.get('/doctor/consultations/:id/documents', async (req, res, next) => {
  try {
    const identity = requireDoctorIdentity(req);

    const consultation = await prisma.consultation.findFirst({
      where: { id: req.params.id, ...doctorConsultationScope(identity) },
      select: { id: true },
    });

    if (!consultation) {
      throw new HttpError(404, 'Consultation not found.');
    }

    const documents = (await prisma.consultationDocument.findMany({
      where: { consultationId: consultation.id, deletedAt: null },
      select: CONSULTATION_DOCUMENT_SELECT,
      orderBy: { createdAt: 'asc' },
    })) as ConsultationDocumentRow[];

    res.json(
      consultationDocumentsResponseSchema.parse({
        documents: documents.map(serializeConsultationDocument),
      }),
    );
  } catch (e) {
    next(e);
  }
});

/**
 * Uploads one prescription or diet plan. The file is held in memory by multer and only written once
 * this doctor's claim to the consultation has been checked, so an unauthorized id never touches the
 * filesystem. The declared Content-Type is re-derived from the leading bytes before anything is
 * stored — that sniffed type, not the client's claim, is what the file is later served as.
 */
app.post(
  '/doctor/consultations/:id/documents',
  uploadConsultationDocument,
  async (req, res, next) => {
    try {
      const identity = requireDoctorIdentity(req);
      const file = req.file;

      if (!file) {
        throw new HttpError(400, 'Attach a file to upload.');
      }

      const rawTitle = typeof req.body?.title === 'string' ? req.body.title.trim() : '';
      const body = uploadConsultationDocumentBodySchema.parse({
        kind: req.body?.kind,
        ...(rawTitle ? { title: rawTitle } : {}),
      });

      const consultation = await prisma.consultation.findFirst({
        where: { id: req.params.id, ...doctorConsultationScope(identity) },
        select: {
          id: true,
          userId: true,
          specialistId: true,
          status: true,
          specialist: { select: { name: true } },
        },
      });

      if (!consultation) {
        throw new HttpError(404, 'Consultation not found.');
      }

      if (consultation.status === 'cancelled') {
        throw new HttpError(400, 'This consultation was cancelled.');
      }

      const existing = await prisma.consultationDocument.count({
        where: { consultationId: consultation.id, deletedAt: null },
      });

      if (existing >= CONSULTATION_DOCUMENT_MAX_PER_CONSULTATION) {
        throw new HttpError(
          409,
          `This consultation already has ${CONSULTATION_DOCUMENT_MAX_PER_CONSULTATION} documents. Remove one first.`,
        );
      }

      const sniffed = sniffDocumentMimeType(file.buffer);
      if (!sniffed) {
        throw new HttpError(415, 'That file is not a readable image or PDF.');
      }

      const storagePath = await writeConsultationDocument({
        consultationId: consultation.id,
        mimeType: sniffed,
        buffer: file.buffer,
      });

      // The admin key is not a specialist, so uploads made with it are attributed to the doctor
      // the consultation belongs to.
      const uploadedById = identity.specialistId ?? consultation.specialistId;

      const document = (await prisma.consultationDocument.create({
        data: {
          consultationId: consultation.id,
          kind: body.kind,
          title: body.title ?? null,
          originalName: sanitizeOriginalName(file.originalname),
          mimeType: sniffed,
          sizeBytes: file.size,
          storagePath,
          uploadedById,
        },
        select: CONSULTATION_DOCUMENT_SELECT,
      })) as ConsultationDocumentRow;

      req.log.info(
        { consultationId: consultation.id, documentId: document.id, kind: body.kind },
        'Consultation document uploaded',
      );

      void notifyPatientDocumentShared({
        consultationId: consultation.id,
        patientId: consultation.userId,
        doctorName: consultation.specialist.name,
        kind: body.kind,
      });

      res.status(201).json(
        uploadConsultationDocumentResponseSchema.parse({
          ok: true,
          document: serializeConsultationDocument(document),
        }),
      );
    } catch (e) {
      next(e);
    }
  },
);

app.get('/doctor/consultations/:id/documents/:docId/file', async (req, res, next) => {
  try {
    const identity = requireDoctorIdentity(req);

    const doc = (await prisma.consultationDocument.findFirst({
      where: {
        id: req.params.docId,
        consultationId: req.params.id,
        deletedAt: null,
        consultation: doctorConsultationScope(identity),
      },
      select: CONSULTATION_DOCUMENT_SELECT,
    })) as ConsultationDocumentRow | null;

    if (!doc) {
      throw new HttpError(404, 'Document not found.');
    }

    await sendConsultationDocumentFile(res, next, doc);
  } catch (e) {
    next(e);
  }
});

/**
 * Withdraws a document. Soft delete: the row is hidden from both portals but the file and the
 * record of who uploaded it stay, because a prescription that was briefly visible to a patient is
 * part of the medico-legal trail.
 */
app.delete('/doctor/consultations/:id/documents/:docId', async (req, res, next) => {
  try {
    const identity = requireDoctorIdentity(req);

    const removed = await prisma.consultationDocument.updateMany({
      where: {
        id: req.params.docId,
        consultationId: req.params.id,
        deletedAt: null,
        consultation: doctorConsultationScope(identity),
      },
      data: { deletedAt: new Date() },
    });

    if (removed.count === 0) {
      throw new HttpError(404, 'Document not found.');
    }

    req.log.info(
      { consultationId: req.params.id, documentId: req.params.docId },
      'Consultation document withdrawn',
    );

    res.json(deleteConsultationDocumentResponseSchema.parse({ ok: true }));
  } catch (e) {
    next(e);
  }
});

app.get('/consultations/specialists', async (_req, res, next) => {
  try {
    await readyBookingCatalog();

    const specialists = await prisma.specialist.findMany({
      // portalRole 'admin' rows are ops logins, not practitioners — they have no profile worth
      // showing and must never appear in the booking catalog.
      where: { active: true, portalRole: 'doctor' },
      include: {
        qualifications: {
          orderBy: { label: 'asc' },
        },
      },
      orderBy: { name: 'asc' },
    });

    res.json(
      consultationSpecialistsResponseSchema.parse(
        specialists.map((specialist: Parameters<typeof serializeSpecialist>[0]) =>
          serializeSpecialist(specialist),
        ),
      ),
    );
  } catch (e) {
    next(e);
  }
});

app.get('/consultations/slots', async (req, res, next) => {
  try {
    await readyBookingCatalog();

    const parsed = consultationSlotsQuerySchema.parse(req.query);
    const specialist = await prisma.specialist.findUnique({
      where: { key: parsed.specialistKey },
      select: { id: true, key: true, active: true },
    });

    if (!specialist || !specialist.active) {
      throw new HttpError(404, 'Specialist not found.');
    }

    if (!isBookableDoctorKey(specialist.key)) {
      throw new HttpError(400, 'Booking is not available for this specialist yet.');
    }

    const rangeStart = parseYmdAtLocalMidnight(parsed.from);
    const rangeEnd = addDays(rangeStart, parsed.days);
    const now = new Date();
    const slotLowerBound = rangeStart.getTime() > now.getTime() ? rangeStart : now;

    const slots = await prisma.consultationSlot.findMany({
      where: {
        specialistId: specialist.id,
        isBooked: false,
        startsAt: { gte: slotLowerBound, lt: rangeEnd },
      },
      orderBy: { startsAt: 'asc' },
    });

    const groups = new Map<string, { date: string; slots: { id: string; startsAt: string; endsAt: string }[] }>();

    for (const slot of slots) {
      const date = localYmd(slot.startsAt);
      const current = groups.get(date) ?? { date, slots: [] };
      current.slots.push({
        id: slot.id,
        startsAt: slot.startsAt.toISOString(),
        endsAt: slot.endsAt.toISOString(),
      });
      groups.set(date, current);
    }

    res.json(
      consultationSlotsResponseSchema.parse({
        specialistKey: specialist.key,
        from: parsed.from,
        days: parsed.days,
        dates: Array.from(groups.values()),
      }),
    );
  } catch (e) {
    next(e);
  }
});

app.post('/consultations/book', async (req, res, next) => {
  try {
    await readyBookingCatalog();

    const user = await requireCurrentUser(req);
    const parsed = createConsultationBookingBodySchema.parse(req.body);

    const booked = await prisma.$transaction(async (tx: any) => {
      await lockUserForBooking(tx, user.id);

      const slot = await tx.consultationSlot.findUnique({
        where: { id: parsed.slotId },
        include: { specialist: true },
      });

      if (!slot) {
        throw new HttpError(404, 'Slot not found.');
      }

      if (!isBookableDoctorKey(slot.specialist.key)) {
        throw new HttpError(400, 'Booking is not available for this specialist yet.');
      }

      if (slot.isBooked || slot.consultationId) {
        throw new HttpError(409, 'This slot has already been booked.');
      }

      if (slot.startsAt <= new Date()) {
        throw new HttpError(400, 'This slot is no longer available.');
      }

      await assertNoOverlappingBooking(tx, {
        userId: user.id,
        startsAt: slot.startsAt,
        endsAt: slot.endsAt,
      });

      const consultation = await tx.consultation.create({
        data: {
          userId: user.id,
          specialistId: slot.specialistId,
          scheduledAt: slot.startsAt,
          status: 'confirmed',
          isFree: true,
        },
      });

      const updated = await tx.consultationSlot.updateMany({
        where: {
          id: slot.id,
          isBooked: false,
          consultationId: null,
        },
        data: {
          isBooked: true,
          consultationId: consultation.id,
        },
      });

      if (updated.count !== 1) {
        throw new HttpError(409, 'This slot has already been booked.');
      }

      return {
        consultationId: consultation.id,
        specialistId: slot.specialistId,
        specialistKey: slot.specialist.key,
        specialistName: slot.specialist.name,
        scheduledAt: slot.startsAt,
        startsAt: slot.startsAt.toISOString(),
        endsAt: slot.endsAt.toISOString(),
      };
    });

    // The doctor is told after the slot is safely claimed, and out of band: a push problem must
    // never turn a successful booking into an error for the patient.
    void notifyDoctorConsultationBooked({
      specialistId: booked.specialistId,
      consultationId: booked.consultationId,
      patientName: user.name,
      scheduledAt: booked.scheduledAt,
    });

    res.json(consultationBookingResponseSchema.parse(booked));
  } catch (e) {
    next(e);
  }
});

function doctorIdentityPayload(identity: DoctorIdentity) {
  return doctorIdentityResponseSchema.parse({
    scope: identity.scope,
    username: identity.username,
    specialistKey: identity.specialistKey,
    specialistName: identity.specialistName,
  });
}

/**
 * Username + password sign-in for the doctor portal. The same 401 covers an unknown username, a
 * wrong password, and a deactivated specialist, so the response never confirms which usernames
 * exist. Repeated failures lock the account for a while; the counters live on the row.
 */
app.post('/doctor/auth/login', async (req, res, next) => {
  try {
    setNoStoreHeaders(res);
    const body = doctorLoginRequestSchema.parse(req.body);
    const username = normaliseDoctorUsername(body.username);

    const specialist = await prisma.specialist.findUnique({
      where: { username },
      select: {
        id: true,
        key: true,
        name: true,
        username: true,
        portalRole: true,
        active: true,
        passwordHash: true,
        failedLoginCount: true,
        lockedUntil: true,
      },
    });

    if (specialist) {
      const lockedFor = lockoutSecondsRemaining(specialist);
      if (lockedFor > 0) {
        res.set('Retry-After', String(lockedFor));
        req.log.warn({ doctorUsername: username }, 'Doctor sign-in rejected while locked out');
        throw new HttpError(429, 'Too many failed sign-in attempts. Try again later.');
      }
    }

    // Verified even when the row is missing or inactive, so a wrong username and a wrong password
    // take the same amount of time and cannot be told apart by timing.
    const passwordOk = await verifyDoctorPassword(
      body.password,
      specialist?.passwordHash ?? DUMMY_DOCTOR_PASSWORD_HASH,
    );

    if (!specialist || !specialist.active || !specialist.passwordHash || !passwordOk) {
      if (specialist) {
        await prisma.specialist.update({
          where: { id: specialist.id },
          data: nextFailureState(specialist),
        });
      }
      req.log.warn({ doctorUsername: username }, 'Doctor sign-in rejected');
      throw new HttpError(401, 'Incorrect username or password.');
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + DOCTOR_SESSION_TTL_HOURS * 60 * 60 * 1000);

    await prisma.$transaction([
      prisma.specialistSession.create({
        data: { tokenHash: sha256(token), specialistId: specialist.id, expiresAt },
      }),
      prisma.specialist.update({
        where: { id: specialist.id },
        data: { lastLoginAt: new Date(), ...CLEARED_LOCK_STATE },
      }),
      // Housekeeping: expired rows for this account would otherwise accumulate forever.
      prisma.specialistSession.deleteMany({
        where: { specialistId: specialist.id, expiresAt: { lte: new Date() } },
      }),
    ]);

    setDoctorSessionCookie(res, token, expiresAt);
    req.log.info(
      { doctorUsername: username, doctorScope: specialist.portalRole },
      'Doctor signed in',
    );

    res.json(doctorIdentityPayload(toDoctorIdentity(specialist)));
  } catch (e) {
    next(e);
  }
});

/** Idempotent: signing out without a session is still a 204, so the client can always clear up. */
app.post('/doctor/auth/logout', async (req, res, next) => {
  try {
    setNoStoreHeaders(res);
    const token = getDoctorSessionToken(req);
    if (token) {
      await prisma.specialistSession.deleteMany({ where: { tokenHash: sha256(token) } });
    }

    clearDoctorSessionCookie(res);
    res.status(204).end();
  } catch (e) {
    next(e);
  }
});

/**
 * Changing a password invalidates every other session for that person — a password is usually
 * changed because the old one leaked, so leaving other devices signed in would defeat the point.
 * The current session survives so the doctor is not thrown out of the screen they are on.
 */
app.post('/doctor/auth/password', async (req, res, next) => {
  try {
    setNoStoreHeaders(res);
    const identity = requireDoctorIdentity(req);
    const body = doctorPasswordChangeRequestSchema.parse(req.body);

    const specialist = await prisma.specialist.findUnique({
      where: { id: identity.specialistRowId },
      select: { id: true, passwordHash: true },
    });

    if (
      !specialist?.passwordHash ||
      !(await verifyDoctorPassword(body.currentPassword, specialist.passwordHash))
    ) {
      throw new HttpError(401, 'Current password is incorrect.');
    }

    if (await verifyDoctorPassword(body.newPassword, specialist.passwordHash)) {
      throw new HttpError(400, 'Choose a password you have not used here before.');
    }

    const currentToken = getDoctorSessionToken(req);
    const passwordHash = await hashDoctorPassword(body.newPassword);

    await prisma.$transaction([
      prisma.specialist.update({
        where: { id: specialist.id },
        data: { passwordHash, passwordUpdatedAt: new Date(), ...CLEARED_LOCK_STATE },
      }),
      prisma.specialistSession.deleteMany({
        where: {
          specialistId: specialist.id,
          ...(currentToken ? { tokenHash: { not: sha256(currentToken) } } : {}),
        },
      }),
    ]);

    req.log.info({ doctorUsername: identity.username }, 'Doctor password changed');
    res.status(204).end();
  } catch (e) {
    next(e);
  }
});

/**
 * A device registering for doctor push. The token is bound to the Specialist row behind the
 * session, so signing out on a shared device and signing in as someone else re-points it rather
 * than leaving one doctor's bookings pushing to another's phone.
 */
app.post('/doctor/push/register', async (req, res, next) => {
  try {
    const identity = requireDoctorIdentity(req);
    const parsed = registerFcmBodySchema.parse(req.body);

    await prisma.specialistFcmToken.upsert({
      where: { token: parsed.fcmToken },
      update: {
        specialistId: identity.specialistRowId,
        platform: parsed.platform,
        status: 'ACTIVE',
        deviceId: parsed.deviceId ?? null,
      },
      create: {
        specialistId: identity.specialistRowId,
        token: parsed.fcmToken,
        platform: parsed.platform,
        status: 'ACTIVE',
        deviceId: parsed.deviceId ?? null,
      },
    });

    res.json(registerFcmResponseSchema.parse({ ok: true }));
  } catch (e) {
    next(e);
  }
});

app.post('/doctor/push/unregister', async (req, res, next) => {
  try {
    const identity = requireDoctorIdentity(req);
    const parsed = unregisterFcmBodySchema.parse(req.body);

    if (!parsed.fcmToken && !parsed.deviceId) {
      throw new HttpError(400, 'Provide fcmToken or deviceId.');
    }

    await prisma.specialistFcmToken.updateMany({
      where: {
        specialistId: identity.specialistRowId,
        ...(parsed.fcmToken ? { token: parsed.fcmToken } : {}),
        ...(parsed.deviceId ? { deviceId: parsed.deviceId } : {}),
      },
      data: { status: 'INACTIVE' },
    });

    res.json(unregisterFcmResponseSchema.parse({ ok: true }));
  } catch (e) {
    next(e);
  }
});

/** The doctor's own feed. Scoped to the session's Specialist row for admin logins too. */
app.get('/doctor/notifications', async (req, res, next) => {
  try {
    const identity = requireDoctorIdentity(req);
    const { limit } = doctorNotificationsQuerySchema.parse(req.query);
    setNoStoreHeaders(res);

    const [rows, unreadCount] = await Promise.all([
      prisma.doctorNotification.findMany({
        where: { specialistId: identity.specialistRowId },
        orderBy: { createdAt: 'desc' },
        take: limit ?? 40,
      }),
      prisma.doctorNotification.count({
        where: { specialistId: identity.specialistRowId, readAt: null },
      }),
    ]);

    res.json(
      doctorNotificationsResponseSchema.parse({
        notifications: (rows as DoctorNotificationRow[]).map((row) => ({
          id: row.id,
          type: row.type,
          title: row.title,
          body: row.body,
          url: row.url,
          consultationId: row.consultationId,
          questionId: row.questionId,
          readAt: row.readAt?.toISOString() ?? null,
          createdAt: row.createdAt.toISOString(),
        })),
        unreadCount,
      }),
    );
  } catch (e) {
    next(e);
  }
});

/** No ids marks the whole feed read — which is what opening the notifications tab does. */
app.post('/doctor/notifications/read', async (req, res, next) => {
  try {
    const identity = requireDoctorIdentity(req);
    const parsed = markDoctorNotificationsReadBodySchema.parse(req.body ?? {});

    await prisma.doctorNotification.updateMany({
      where: {
        specialistId: identity.specialistRowId,
        readAt: null,
        ...(parsed.ids?.length ? { id: { in: parsed.ids } } : {}),
      },
      data: { readAt: new Date() },
    });

    const unreadCount = await prisma.doctorNotification.count({
      where: { specialistId: identity.specialistRowId, readAt: null },
    });

    res.json(markDoctorNotificationsReadResponseSchema.parse({ ok: true, unreadCount }));
  } catch (e) {
    next(e);
  }
});

/** Tells the portal whose bookings it is about to show, and whether the session is still valid. */
app.get('/doctor/me', (req, res, next) => {
  try {
    setNoStoreHeaders(res);
    res.json(doctorIdentityPayload(requireDoctorIdentity(req)));
  } catch (e) {
    next(e);
  }
});

app.get('/doctor/consultations', async (req, res, next) => {
  try {
    const identity = requireDoctorIdentity(req);
    await readyBookingCatalog();

    const bookings = await prisma.consultation.findMany({
      where: doctorConsultationScope(identity),
      include: {
        specialist: {
          select: {
            key: true,
            name: true,
          },
        },
        // Deliberately no phone: a patient's contact number stays out of the doctor portal.
        user: {
          select: {
            id: true,
            name: true,
          },
        },
        slot: {
          select: {
            endsAt: true,
          },
        },
        documents: {
          where: { deletedAt: null },
          select: { id: true },
        },
        call: {
          select: {
            status: true,
            recordings: true,
          },
        },
      },
      orderBy: [{ scheduledAt: 'asc' }, { createdAt: 'desc' }],
    });

    res.json(
      doctorConsultationBookingsResponseSchema.parse({
        bookings: (bookings as DoctorConsultationRow[]).map((booking) => ({
          consultationId: booking.id,
          specialistKey: booking.specialist.key,
          specialistName: booking.specialist.name,
          patientId: booking.user.id,
          patientName: booking.user.name,
          scheduledAt: booking.scheduledAt.toISOString(),
          endsAt: booking.slot?.endsAt.toISOString() ?? null,
          status: booking.status,
          isFree: booking.isFree,
          createdAt: booking.createdAt.toISOString(),
          callStatus: booking.call?.status ?? null,
          recordingStatus: aggregateRecording(booking.call?.recordings)?.status ?? null,
          documentCount: booking.documents.length,
        })),
      }),
    );
  } catch (e) {
    next(e);
  }
});

app.post('/doctor/consultations/:id/call/start', async (req, res, next) => {
  try {
    await readyBookingCatalog();

    const consultationId = req.params.id;
    const consultation = await getDoctorConsultation(consultationId, requireDoctorIdentity(req));

    if (consultation.status !== 'confirmed') {
      throw new HttpError(400, 'Only confirmed consultations can be started.');
    }

    const call = await ensureConsultationCall(consultation.id);
    const token = await createJoinToken({
      roomName: call.roomName,
      consultationId: consultation.id,
      role: 'doctor',
      identity: `doctor:${consultation.id}`,
      name: consultation.specialist.name,
    });

    await notifyPatientCallStarted(consultation.id, consultation.user.id, consultation.specialist.name);

    res.json(
      consultationCallJoinResponseSchema.parse({
        livekitUrl: LIVEKIT_URL,
        token,
        call: serializeConsultationCallState(
          consultation.id,
          call,
          hasPatientConsent(call, consultation.user.id),
        ),
      }),
    );
  } catch (e) {
    next(e);
  }
});

app.get('/doctor/consultations/:id/call', async (req, res, next) => {
  try {
    const consultation = await getDoctorConsultation(req.params.id, requireDoctorIdentity(req));
    if (!consultation.call) {
      throw new HttpError(404, 'Call has not been started yet.');
    }

    const token = await createJoinToken({
      roomName: consultation.call.roomName,
      consultationId: consultation.id,
      role: 'doctor',
      identity: `doctor:${consultation.id}`,
      name: consultation.specialist.name,
    });

    res.json(
      consultationCallJoinResponseSchema.parse({
        livekitUrl: LIVEKIT_URL,
        token,
        call: serializeConsultationCallState(
          consultation.id,
          consultation.call,
          hasPatientConsent(consultation.call, consultation.user.id),
        ),
      }),
    );
  } catch (e) {
    next(e);
  }
});

app.post('/doctor/consultations/:id/call/end', async (req, res, next) => {
  try {
    const consultation = await getDoctorConsultation(req.params.id, requireDoctorIdentity(req));
    if (!consultation.call) {
      throw new HttpError(404, 'Call has not been started yet.');
    }

    const refreshed = await endConsultationCall(consultation.call);

    res.json(
      consultationCallEndResponseSchema.parse({
        ok: true,
        call: serializeConsultationCallState(
          consultation.id,
          refreshed,
          hasPatientConsent(refreshed, consultation.user.id),
        ),
      }),
    );
  } catch (e) {
    next(e);
  }
});

/**
 * The patient leaving ends the consultation for both sides. A 1:1 call with one party gone is
 * over, and leaving it open would keep egress recording an empty room.
 */
app.post('/consultations/:id/call/end', async (req, res, next) => {
  try {
    const user = await requireCurrentUser(req);
    const consultation = await getPatientConsultation(req.params.id, user.id);

    if (!consultation.call) {
      throw new HttpError(404, 'Call has not been started yet.');
    }

    const refreshed = await endConsultationCall(consultation.call);

    res.json(
      consultationCallEndResponseSchema.parse({
        ok: true,
        call: serializeConsultationCallState(consultation.id, refreshed, true),
      }),
    );
  } catch (e) {
    next(e);
  }
});

app.get('/consultations/:id/call', async (req, res, next) => {
  try {
    const user = await requireCurrentUser(req);
    const consultation = await getPatientConsultation(req.params.id, user.id);

    res.json(
      consultationCallStateResponseSchema.parse({
        call: serializeConsultationCallState(
          consultation.id,
          consultation.call,
          hasPatientConsent(consultation.call, user.id),
        ),
      }),
    );
  } catch (e) {
    next(e);
  }
});

app.post('/consultations/:id/call/consent', async (req, res, next) => {
  try {
    const user = await requireCurrentUser(req);
    const parsed = consultationCallConsentBodySchema.parse({
      consentTextVersion: CALL_CONSENT_TEXT_VERSION,
      ...(req.body ?? {}),
    });
    const consultation = await getPatientConsultation(req.params.id, user.id);

    if (!consultation.call || consultation.call.status === 'ended') {
      throw new HttpError(404, 'Call has not been started yet.');
    }

    await prisma.consultationCallConsent.upsert({
      where: {
        consultationCallId_userId: {
          consultationCallId: consultation.call.id,
          userId: user.id,
        },
      },
      create: {
        consultationCallId: consultation.call.id,
        userId: user.id,
        consentTextVersion: parsed.consentTextVersion,
      },
      update: {
        consentTextVersion: parsed.consentTextVersion,
        consentedAt: new Date(),
      },
    });

    const refreshed = await prisma.consultationCall.findUnique({
      where: { id: consultation.call.id },
      include: {
        recordings: true,
        consents: { select: { userId: true } },
      },
    });

    res.json(
      consultationCallConsentResponseSchema.parse({
        ok: true,
        call: serializeConsultationCallState(consultation.id, refreshed, true),
      }),
    );
  } catch (e) {
    next(e);
  }
});

app.post('/consultations/:id/call/join', async (req, res, next) => {
  try {
    const user = await requireCurrentUser(req);
    const consultation = await getPatientConsultation(req.params.id, user.id);

    if (!consultation.call || consultation.call.status === 'ended') {
      throw new HttpError(404, 'Call has not been started yet.');
    }

    if (LIVEKIT_RECORDING_ENABLED && !hasPatientConsent(consultation.call, user.id)) {
      throw new HttpError(403, 'Recording consent is required before joining.');
    }

    await ensureLiveKitRoom(consultation.call.roomName, consultation.id);

    const joinedCall = await prisma.consultationCall.update({
      where: { id: consultation.call.id },
      data: {
        status: 'active',
        patientJoinedAt: consultation.call.patientJoinedAt ?? new Date(),
      },
      include: {
        recordings: true,
        consents: { select: { userId: true } },
      },
    });

    // Best effort: the doctor may already be publishing, so start their egress now. The
    // patient has not connected yet — their track_published webhook picks them up.
    await reconcileCallRecordings(joinedCall.roomName);

    const refreshed = await prisma.consultationCall.findUnique({
      where: { id: joinedCall.id },
      include: {
        recordings: true,
        consents: { select: { userId: true } },
      },
    });

    const token = await createJoinToken({
      roomName: consultation.call.roomName,
      consultationId: consultation.id,
      role: 'patient',
      identity: `patient:${user.id}:${consultation.id}`,
      // The doctor's client receives this as the participant label, so an unnamed patient falls
      // back to a generic word rather than to their phone number.
      name: user.name || 'Patient',
    });

    res.json(
      consultationCallJoinResponseSchema.parse({
        livekitUrl: LIVEKIT_URL,
        token,
        call: serializeConsultationCallState(consultation.id, refreshed, true),
      }),
    );
  } catch (e) {
    next(e);
  }
});

app.post('/consultations/slots', async (req, res, next) => {
  try {
    await readyBookingCatalog();

    const parsed = createConsultationSlotsBodySchema.parse(req.body);
    const specialist = await prisma.specialist.findUnique({
      where: { key: parsed.specialistKey },
      select: { id: true, key: true, active: true },
    });

    if (!specialist || !specialist.active) {
      throw new HttpError(404, 'Specialist not found.');
    }

    if (!isBookableDoctorKey(specialist.key)) {
      throw new HttpError(400, 'Slots can only be created for doctor specialists.');
    }

    const now = new Date();
    const data = parsed.slots.map((slot) => {
      const startsAt = new Date(slot.startsAt);
      const endsAt = new Date(slot.endsAt);

      if (!(startsAt < endsAt)) {
        throw new HttpError(400, 'Each slot must end after it starts.');
      }

      if (startsAt <= now) {
        throw new HttpError(400, 'Slots must be in the future.');
      }

      return {
        specialistId: specialist.id,
        startsAt,
        endsAt,
      };
    });

    // An exact repeat inside one request stays idempotent, the way skipDuplicates already made it.
    const seen = new Set<string>();
    const unique = data.filter((slot) => {
      const key = `${slot.startsAt.toISOString()}|${slot.endsAt.toISOString()}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // @@unique([specialistId, startsAt]) only rejects an exact repeat, so 10:00-10:30 and
    // 10:15-10:45 would both go on sale for the same doctor and the same quarter hour.
    const ordered = [...unique].sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
    let windowStart: Date | null = null;
    let windowEnd: Date | null = null;

    for (const slot of ordered) {
      if (windowEnd && slot.startsAt < windowEnd) {
        throw new HttpError(400, 'Slots in this request overlap each other.');
      }
      windowStart ??= slot.startsAt;
      windowEnd = slot.endsAt;
    }

    if (!windowStart || !windowEnd) {
      throw new HttpError(400, 'At least one slot is required.');
    }

    const rangeStartAt = windowStart;
    const rangeEndAt = windowEnd;

    const created = await prisma.$transaction(async (tx: BookingTx) => {
      const neighbours: { startsAt: Date; endsAt: Date }[] = await tx.consultationSlot.findMany({
        where: {
          specialistId: specialist.id,
          startsAt: { lt: rangeEndAt },
          endsAt: { gt: rangeStartAt },
        },
        select: { startsAt: true, endsAt: true },
      });

      const clash = ordered.find((slot) =>
        neighbours.some(
          (existing) =>
            existing.startsAt < slot.endsAt &&
            existing.endsAt > slot.startsAt &&
            // An exact repeat of an existing slot is skipped below, not an error.
            !(
              existing.startsAt.getTime() === slot.startsAt.getTime() &&
              existing.endsAt.getTime() === slot.endsAt.getTime()
            ),
        ),
      );

      if (clash) {
        throw new HttpError(
          409,
          `Slot ${clash.startsAt.toISOString()} overlaps an existing slot for this specialist.`,
        );
      }

      return tx.consultationSlot.createMany({
        data: unique,
        skipDuplicates: true,
      });
    });

    res.json(
      createConsultationSlotsResponseSchema.parse({
        ok: true,
        createdCount: created.count,
      }),
    );
  } catch (e) {
    next(e);
  }
});

app.delete('/consultations/slots/:id', async (req, res, next) => {
  try {
    await readyBookingCatalog();

    const parsed = deleteConsultationSlotParamsSchema.parse(req.params);
    const slot = await prisma.consultationSlot.findUnique({
      where: { id: parsed.id },
      select: {
        id: true,
        isBooked: true,
        consultationId: true,
        startsAt: true,
      },
    });

    if (!slot) {
      throw new HttpError(404, 'Slot not found.');
    }

    if (slot.isBooked || slot.consultationId) {
      throw new HttpError(400, 'Booked slots cannot be deleted.');
    }

    if (slot.startsAt <= new Date()) {
      throw new HttpError(400, 'Past slots cannot be deleted.');
    }

    await prisma.consultationSlot.delete({
      where: { id: slot.id },
    });

    res.json(deleteConsultationSlotResponseSchema.parse({ ok: true }));
  } catch (e) {
    next(e);
  }
});

app.post('/auth/request-otp', async (req, res, next) => {
  try {
    setNoStoreHeaders(res);
    const parsed = requestOtpBodySchema.parse(req.body);
    const phone = normalizePhone(parsed.phone);
    const now = new Date();
    const cooldownStart = addSeconds(now, -OTP_RESEND_COOLDOWN_SECONDS);
    const fifteenMinutesAgo = addSeconds(now, -(15 * 60));

    const [user, recentSendCount, recentChallenge] = await Promise.all([
      prisma.user.findUnique({ where: { phone } }),
      prisma.otpChallenge.count({
        where: {
          phone,
          createdAt: { gte: fifteenMinutesAgo },
        },
      }),
      prisma.otpChallenge.findFirst({
        where: {
          phone,
          purpose: parsed.purpose,
          createdAt: { gte: cooldownStart },
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    if (parsed.purpose === 'login' && !user) {
      throw new HttpError(404, 'No account found for this phone number.');
    }

    if (parsed.purpose === 'signup' && user) {
      throw new HttpError(409, 'An account already exists for this phone number.');
    }

    if (recentSendCount >= OTP_MAX_SENDS_PER_15_MINUTES) {
      throw new HttpError(429, 'Too many OTP requests. Please wait a few minutes and try again.');
    }

    if (recentChallenge) {
      const availableAt = addSeconds(recentChallenge.createdAt, OTP_RESEND_COOLDOWN_SECONDS);
      const retryInSeconds = Math.max(0, Math.ceil((availableAt.getTime() - now.getTime()) / 1000));

      if (retryInSeconds > 0) {
        throw new HttpError(429, `Please wait ${retryInSeconds} seconds before requesting another OTP.`);
      }
    }

    const providerSessionId = await sendOtpWithTwoFactor(phone);
    const challenge = await prisma.otpChallenge.create({
      data: {
        phone,
        userId: user?.id,
        purpose: parsed.purpose,
        provider: '2factor',
        providerSessionId,
        expiresAt: addSeconds(now, OTP_EXPIRY_MINUTES * 60),
      },
    });

    // Phone numbers are masked in logs — an OTP flow is traceable without the log becoming a
    // list of user phone numbers.
    req.log.info(
      { purpose: parsed.purpose, phone: maskPhone(phone), challengeId: challenge.id },
      'OTP sent',
    );

    res.json(
      requestOtpResponseSchema.parse({
        challengeId: challenge.id,
        phone,
        maskedPhone: maskPhone(phone),
        resendAfterSeconds: OTP_RESEND_COOLDOWN_SECONDS,
      })
    );
  } catch (e) {
    next(e);
  }
});

app.post('/auth/verify-otp', async (req, res, next) => {
  try {
    setNoStoreHeaders(res);
    const validated = verifyOtpBodySchema.parse(req.body);
    const phone = normalizePhone(validated.phone);

    const challenge = await prisma.otpChallenge.findUnique({
      where: { id: validated.challengeId },
    });

    if (!challenge || challenge.phone !== phone || challenge.purpose !== validated.purpose) {
      throw new HttpError(404, 'OTP challenge not found.');
    }

    const now = new Date();
    if (challenge.status !== 'pending') {
      throw new HttpError(400, 'This OTP has already been used. Please request a new one.');
    }

    if (challenge.expiresAt <= now) {
      await prisma.otpChallenge.update({
        where: { id: challenge.id },
        data: { status: 'expired' },
      });
      throw new HttpError(400, 'This OTP has expired. Please request a new one.');
    }

    if (challenge.attemptCount >= OTP_MAX_VERIFY_ATTEMPTS) {
      await prisma.otpChallenge.update({
        where: { id: challenge.id },
        data: { status: 'failed' },
      });
      throw new HttpError(429, 'Too many incorrect OTP attempts. Please request a new OTP.');
    }

    let user = await prisma.user.findUnique({ where: { phone } });
    if (validated.purpose === 'login' && !user) {
      throw new HttpError(404, 'No account found for this phone number.');
    }

    if (validated.purpose === 'signup' && user) {
      throw new HttpError(409, 'An account already exists for this phone number.');
    }

    try {
      await verifyOtpWithTwoFactor(challenge.providerSessionId, validated.otp);
    } catch (error) {
      await prisma.otpChallenge.update({
        where: { id: challenge.id },
        data: {
          attemptCount: { increment: 1 },
          status: challenge.attemptCount + 1 >= OTP_MAX_VERIFY_ATTEMPTS ? 'failed' : 'pending',
        },
      });
      throw error;
    }

    const isNewUser = !user;

    if (!user) {
      user = await prisma.user.create({
        data: {
          phone,
          name: validated.name?.trim(),
          phoneVerifiedAt: now,
        },
      });
    } else if (!user.phoneVerifiedAt) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { phoneVerifiedAt: now },
      });
    }

    await prisma.otpChallenge.update({
      where: { id: challenge.id },
      data: {
        status: 'verified',
        verifiedAt: now,
      },
    });

    const sessionToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = addDays(now, SESSION_TTL_DAYS);

    await prisma.session.create({
      data: {
        tokenHash: sha256(sessionToken),
        userId: user.id,
        expiresAt,
      },
    });

    req.log = req.log.child({ userId: user.id });
    req.log.info({ isNewUser, phone: maskPhone(phone) }, 'Session created');

    setSessionCookie(res, sessionToken, expiresAt);
    res.json(
      authSessionResponseSchema.parse({
        user: serializeUser(user),
        isNewUser,
      })
    );
  } catch (e) {
    next(e);
  }
});

app.get('/auth/me', async (req, res, next) => {
  try {
    setNoStoreHeaders(res);
    const user = await requireCurrentUser(req);
    res.json(authUserSchema.parse(serializeUser(user)));
  } catch (e) {
    next(e);
  }
});

app.post('/onboarding/complete', async (req, res, next) => {
  try {
    const user = await requireCurrentUser(req);

    if (user.onboardingCompleted) {
      res.json(authUserSchema.parse(serializeUser(user)));
      return;
    }

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: { onboardingCompleted: true },
    });

    res.json(authUserSchema.parse(serializeUser(await loadUserWithSubscription(updated.id))));
  } catch (e) {
    next(e);
  }
});

app.post('/subscription/start-trial', async (req, res, next) => {
  try {
    setNoStoreHeaders(res);
    const user = await requireCurrentUser(req);

    if (!user.onboardingCompleted) {
      throw new HttpError(400, 'Complete onboarding before starting your trial.');
    }

    if (!user.subscription) {
      const now = new Date();
      await prisma.subscription.create({
        data: {
          userId: user.id,
          status: 'trialing',
          startedAt: now,
          trialEndsAt: addDays(now, FREE_TRIAL_DAYS),
        },
      });

      res.json(startTrialResponseSchema.parse(serializeUser(await loadUserWithSubscription(user.id))));
      return;
    }

    if (user.subscription.status === 'trialing') {
      res.json(startTrialResponseSchema.parse(serializeUser(user)));
      return;
    }

    if (user.subscription.status === 'active') {
      res.json(startTrialResponseSchema.parse(serializeUser(user)));
      return;
    }

    throw new HttpError(409, 'Your free trial has already ended. Please choose a plan to continue.');
  } catch (e) {
    next(e);
  }
});

app.post('/subscription/activate-one-day', async (req, res, next) => {
  try {
    setNoStoreHeaders(res);
    const user = await requireCurrentUser(req);

    if (!user.onboardingCompleted) {
      throw new HttpError(400, 'Complete onboarding before activating access.');
    }

    const now = new Date();
    const trialEndsAt = addDays(now, 1);

    await prisma.subscription.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        status: 'trialing',
        startedAt: now,
        trialEndsAt,
      },
      update: {
        status: 'trialing',
        startedAt: now,
        trialEndsAt,
      },
    });

    res.json(
      activateOneDaySubscriptionResponseSchema.parse(
        serializeUser(await loadUserWithSubscription(user.id)),
      ),
    );
  } catch (e) {
    next(e);
  }
});

app.post('/auth/logout', async (req, res, next) => {
  try {
    setNoStoreHeaders(res);
    const sessionToken = getSessionToken(req);
    let userId: string | null = null;

    if (sessionToken) {
      const session = await prisma.session.findUnique({
        where: { tokenHash: sha256(sessionToken) },
        select: { userId: true },
      });
      userId = session?.userId ?? null;

      await prisma.session.deleteMany({
        where: { tokenHash: sha256(sessionToken) },
      });
    }

    if (userId) {
      const parsed = unregisterFcmBodySchema.safeParse(req.body);
      if (parsed.success) {
        const { fcmToken, deviceId } = parsed.data;
        if (fcmToken) {
          await prisma.fcmToken.updateMany({
            where: { userId, token: fcmToken },
            data: { status: 'INACTIVE' },
          });
        } else if (deviceId) {
          await prisma.fcmToken.updateMany({
            where: { userId, deviceId },
            data: { status: 'INACTIVE' },
          });
        }
      }
    }

    clearSessionCookie(res);
    res.json(logoutResponseSchema.parse({ ok: true }));
  } catch (e) {
    next(e);
  }
});

app.post('/register-fcm', async (req, res, next) => {
  try {
    const user = await requireCurrentUser(req);
    const parsed = registerFcmBodySchema.parse(req.body);

    await prisma.fcmToken.upsert({
      where: { token: parsed.fcmToken },
      create: {
        userId: user.id,
        token: parsed.fcmToken,
        platform: parsed.platform,
        status: 'ACTIVE',
        deviceId: parsed.deviceId ?? null,
      },
      update: {
        userId: user.id,
        platform: parsed.platform,
        status: 'ACTIVE',
        deviceId: parsed.deviceId ?? null,
      },
    });

    res.json(registerFcmResponseSchema.parse({ ok: true }));
  } catch (e) {
    next(e);
  }
});

app.post('/unregister-fcm', async (req, res, next) => {
  try {
    const user = await requireCurrentUser(req);
    const parsed = unregisterFcmBodySchema.parse(req.body);

    if (!parsed.fcmToken && !parsed.deviceId) {
      throw new HttpError(400, 'Provide fcmToken or deviceId.');
    }

    await prisma.fcmToken.updateMany({
      where: {
        userId: user.id,
        ...(parsed.fcmToken ? { token: parsed.fcmToken } : {}),
        ...(parsed.deviceId ? { deviceId: parsed.deviceId } : {}),
      },
      data: { status: 'INACTIVE' },
    });

    res.json(unregisterFcmResponseSchema.parse({ ok: true }));
  } catch (e) {
    next(e);
  }
});

app.get('/push/hello-world', async (req, res, next) => {
  try {
    requireBroadcastSecret(req);

    const rows: Array<{ token: string }> = await prisma.fcmToken.findMany({
      where: { status: 'ACTIVE' },
      select: { token: true },
    });
    const tokens: string[] = [...new Set(rows.map((row) => row.token))];

    const title = 'Anuva';
    const body = 'Hello world';
    const { successCount, failureCount } = await sendPushToAllTokens(tokens, { title, body }, { url: '/home' });

    res.json(
      pushBroadcastResponseSchema.parse({
        ok: true,
        title,
        body,
        targeted: tokens.length,
        successCount,
        failureCount,
      }),
    );
  } catch (e) {
    if (e instanceof Error && e.message.includes('FIREBASE_SERVICE_ACCOUNT')) {
      next(new HttpError(503, e.message));
      return;
    }
    next(e);
  }
});

// ─────────────────────────────────────────────
// Nudge engine
// ─────────────────────────────────────────────

// What the client should surface right now (current slot's card bundle).
app.get('/nudge/today', async (req, res, next) => {
  try {
    const user = await requireCurrentUser(req);
    const now = new Date();
    const requestedSlot =
      req.query.slot === undefined ? undefined : nudgeSlotSchema.parse(req.query.slot);
    const slot = requestedSlot ?? currentSlot(now);
    const dispatch = await buildDispatch(user.id, slot, now, { purpose: 'render' });

    const todayState = await prisma.nudgeDailyState.findUnique({
      where: { userId_date: { userId: user.id, date: dayKey(now) } },
    });
    const budgetRemaining = Math.max(0, 3 - (todayState?.nudgeCount ?? 0));

    res.json(
      nudgeTodayResponseSchema.parse({
        slot: dispatch.cards.length ? slot : null,
        bundleTitle: dispatch.cards.length ? dispatch.bundleTitle : null,
        budgetRemaining,
        cards: dispatch.cards,
      }),
    );
  } catch (e) {
    next(e);
  }
});

// Store an answer to a nudge card and return ANU's tone reply.
app.post('/nudge/respond', async (req, res, next) => {
  try {
    const user = await requireCurrentUser(req);
    const { nudgeId, answer, loggedAt } = submitNudgeResponseBodySchema.parse(req.body);
    const now = new Date();
    const when = loggedAt ? new Date(loggedAt) : now;
    const result = await storeResponse(user.id, nudgeId, answer, when, now);
    res.status(201).json(
      nudgeRespondResponseSchema.parse({
        ok: true,
        toneTemplateId: result.toneTemplateId,
        message: result.message,
        distressFlag: result.distressFlag,
      }),
    );
  } catch (e) {
    next(e);
  }
});

// Public self-test of the MVP nudge decision logic. No auth, no DB.
app.get('/nudge/selftest', (_req, res) => {
  const report = runNudgeSelfTest();
  res.status(report.ok ? 200 : 500).json(report);
});

// Unified daily tracker sheet — powers the /track Today view. Includes answers
// already captured via nudges so /track shows them without re-asking.
app.get('/nudge/day', async (req, res, next) => {
  try {
    const user = await requireCurrentUser(req);
    const sheet = await getDaySheet(user.id, new Date());
    res.json(nudgeDayResponseSchema.parse(sheet));
  } catch (e) {
    next(e);
  }
});

// Governor state for the current day (debug/admin).
app.get('/nudge/state', async (req, res, next) => {
  try {
    const user = await requireCurrentUser(req);
    const startOfToday = startOfDay(new Date());
    const state = await prisma.nudgeDailyState.findUnique({
      where: { userId_date: { userId: user.id, date: dayKey(startOfToday) } },
    });
    res.json(
      nudgeStateResponseSchema.parse({
        date: startOfToday.toISOString().split('T')[0],
        nudgeCount: state?.nudgeCount ?? 0,
        morningAnchorResponded: state?.morningAnchorResponded ?? false,
        afternoonResponded: state?.afternoonResponded ?? false,
        distressFlag: state?.distressFlag ?? false,
        lastEngagedAt: state?.lastEngagedAt ? state.lastEngagedAt.toISOString() : null,
      }),
    );
  } catch (e) {
    next(e);
  }
});

// Manual slot dispatch for testing (guarded by the broadcast secret).
app.post('/nudge/dispatch', async (req, res, next) => {
  try {
    requireBroadcastSecret(req);
    const slot = nudgeSlotSchema.parse(req.query.slot);
    const result = await dispatchSlot(slot);
    res.json({ ok: true, slot, ...result });
  } catch (e) {
    if (e instanceof Error && e.message.includes('FIREBASE_SERVICE_ACCOUNT')) {
      next(new HttpError(503, e.message));
      return;
    }
    next(e);
  }
});

// ─────────────────────────────────────────────
// ANU chat
// ─────────────────────────────────────────────

// Ask ANU a question. Red-flag messages are answered from clinician-authored
// safety text without the model being called at all.
app.post('/anu/chat', async (req, res, next) => {
  try {
    const user = await requireCurrentUser(req);
    if (!isAnuChatConfigured()) {
      throw new HttpError(503, 'ANU chat is not configured.');
    }
    const { message } = anuChatBodySchema.parse(req.body);
    const result = await anuAnswer(user.id, message, user.name);
    res.json(anuChatResponseSchema.parse(result));
  } catch (e) {
    next(e);
  }
});

// Past exchanges, oldest first, so the client can render the thread as-is.
app.get('/anu/chat', async (req, res, next) => {
  try {
    const user = await requireCurrentUser(req);
    const turns = await prisma.anuChatTurn.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true,
        userMessage: true,
        reply: true,
        suggestions: true,
        source: true,
        createdAt: true,
      },
    });

    res.json(
      anuChatHistoryResponseSchema.parse({
        turns: turns.reverse().map((turn) => ({
          id: turn.id,
          userMessage: turn.userMessage,
          reply: turn.reply,
          suggestions: turn.suggestions,
          source: turn.source,
          createdAt: turn.createdAt.toISOString(),
        })),
      }),
    );
  } catch (e) {
    next(e);
  }
});

app.get('/anu/cache-stats', (_req, res) => {
  res.json(cacheStats());
});

// ─────────────────────────────────────────────
// Cycle tracking
// ─────────────────────────────────────────────

async function getCycleData(userId: string) {
  const [settings, periods, flows] = await Promise.all([
    prisma.cycleSettings.findUnique({ where: { userId } }),
    prisma.periodLog.findMany({
      where: { userId },
      orderBy: { startDate: 'desc' },
      // Two years of logs: enough for the calendar to scroll back and for
      // cycle-length learning to have real history to average.
      take: 24,
    }),
    // Same depth as the period logs, so every bleeding day the calendar can
    // render carries the flow answer that belongs to it.
    prisma.periodFlowLog.findMany({
      where: { userId },
      orderBy: { date: 'desc' },
      take: 24 * PERIOD_LENGTH_MAX,
    }),
  ]);
  return { settings, periods, flows };
}

function serializePeriodLog(p: { id: string; startDate: Date; endDate: Date | null }) {
  return {
    id: p.id,
    startDate: p.startDate.toISOString().split('T')[0]!,
    endDate: p.endDate ? p.endDate.toISOString().split('T')[0]! : null,
  };
}

function serializePeriodFlowLog(f: { date: Date; flow: string }) {
  return { date: f.date.toISOString().split('T')[0]!, flow: f.flow };
}

async function cycleStatePayload(userId: string, now = new Date()) {
  const { settings, periods, flows } = await getCycleData(userId);
  const serializedPeriods = periods.map(serializePeriodLog);
  const state = buildCycleStateResponse(serializedPeriods, settings, now);
  const flowLogs = flows.map(serializePeriodFlowLog);

  return cycleStateResponseSchema.parse({
    settings: settings
      ? { cycleLength: settings.cycleLength, periodLength: settings.periodLength }
      : null,
    ...state,
    recentPeriods: serializedPeriods,
    flowLogs,
    pendingFlowDates: pendingFlowDates(
      bleedingDays(serializedPeriods, state.effectivePeriodLength, now),
      flowLogs.map((f) => f.date),
      now,
    ),
  });
}

app.get('/cycle', async (req, res, next) => {
  try {
    const user = await requireCurrentUser(req);
    res.json(await cycleStatePayload(user.id));
  } catch (e) {
    next(e);
  }
});

app.post('/cycle/setup', async (req, res, next) => {
  try {
    const user = await requireCurrentUser(req);
    const { lastPeriodStart, cycleLength, periodLength } = cycleSetupBodySchema.parse(req.body);

    await prisma.$transaction([
      prisma.cycleSettings.upsert({
        where: { userId: user.id },
        create: { userId: user.id, cycleLength, periodLength },
        update: { cycleLength, periodLength },
      }),
      prisma.periodLog.upsert({
        where: { userId_startDate: { userId: user.id, startDate: new Date(lastPeriodStart) } },
        create: { userId: user.id, startDate: new Date(lastPeriodStart) },
        update: {},
      }),
    ]);

    res.status(201).json(await cycleStatePayload(user.id));
  } catch (e) {
    next(e);
  }
});

app.put('/cycle/settings', async (req, res, next) => {
  try {
    const user = await requireCurrentUser(req);
    const { cycleLength, periodLength } = cycleSettingsBodySchema.parse(req.body);
    await prisma.cycleSettings.upsert({
      where: { userId: user.id },
      create: { userId: user.id, cycleLength, periodLength },
      update: { cycleLength, periodLength },
    });
    res.json({ cycleLength, periodLength });
  } catch (e) {
    next(e);
  }
});

app.post('/cycle/period', async (req, res, next) => {
  try {
    const user = await requireCurrentUser(req);
    const { startDate } = logPeriodBodySchema.parse(req.body);
    // A start date in the future would poison every prediction downstream.
    // One day of slack absorbs the client being ahead of the server's timezone.
    const maxStart = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0]!;
    if (startDate > maxStart) {
      throw new HttpError(400, 'Period start date cannot be in the future.');
    }
    await prisma.periodLog.upsert({
      where: { userId_startDate: { userId: user.id, startDate: new Date(startDate) } },
      create: { userId: user.id, startDate: new Date(startDate) },
      update: {},
    });
    res.status(201).json(await cycleStatePayload(user.id));
  } catch (e) {
    next(e);
  }
});

app.patch('/cycle/period/:id', async (req, res, next) => {
  try {
    const user = await requireCurrentUser(req);
    const { id } = req.params;
    const { endDate } = endPeriodBodySchema.parse(req.body);
    const existing = await prisma.periodLog.findUnique({ where: { id } });
    if (!existing || existing.userId !== user.id) {
      throw new HttpError(404, 'Period log not found.');
    }
    if (endDate < existing.startDate.toISOString().split('T')[0]!) {
      throw new HttpError(400, 'Period end date cannot be before its start date.');
    }
    await prisma.periodLog.update({
      where: { id },
      data: { endDate: new Date(endDate) },
    });
    // Closing a period early can push its later days out of the bleed.
    await deleteOrphanedFlowLogs(user.id);
    res.json(await cycleStatePayload(user.id));
  } catch (e) {
    next(e);
  }
});

app.delete('/cycle/period/:id', async (req, res, next) => {
  try {
    const user = await requireCurrentUser(req);
    const { id } = req.params;
    const existing = await prisma.periodLog.findUnique({ where: { id } });
    if (!existing || existing.userId !== user.id) {
      throw new HttpError(404, 'Period log not found.');
    }
    await prisma.periodLog.delete({ where: { id } });
    // Flow answers only exist for bleeding days. Deleting the period that made
    // those days bleeding days leaves rows describing a bleed the user has since
    // said never happened, and the prompt would never surface them again.
    await deleteOrphanedFlowLogs(user.id);
    res.json(await cycleStatePayload(user.id));
  } catch (e) {
    next(e);
  }
});

/**
 * Drop flow rows whose day is no longer a bleeding day.
 *
 * Editing the cycle can strand them two ways: deleting a period log, or closing
 * one early so its later days fall outside the bleed. Rather than reasoning about
 * which edit happened, recompute the bleeding days and keep only what still fits.
 * Bounded by the same 24-period window the rest of the tracker reads.
 */
async function deleteOrphanedFlowLogs(userId: string, now = new Date()): Promise<void> {
  const { settings, periods, flows } = await getCycleData(userId);
  const serializedPeriods = periods.map(serializePeriodLog);
  const { effectivePeriodLength } = buildCycleStateResponse(serializedPeriods, settings, now);
  const valid = new Set(bleedingDays(serializedPeriods, effectivePeriodLength, now));

  const orphaned = flows
    .map(serializePeriodFlowLog)
    .filter((f) => !valid.has(f.date))
    .map((f) => f.date);
  if (orphaned.length === 0) return;

  await prisma.periodFlowLog.deleteMany({
    where: { userId, date: { in: orphaned.map((d) => new Date(d)) } },
  });
}

/**
 * Flow intensity for one bleeding day, from the in-app home prompt or a
 * correction tapped on the calendar. Not a notification — nothing here schedules
 * or sends anything; the client decides when to ask.
 */
app.post('/cycle/flow', async (req, res, next) => {
  try {
    const user = await requireCurrentUser(req);
    const { date, flow, source } = logPeriodFlowBodySchema.parse(req.body);

    const now = new Date();
    const { settings, periods } = await getCycleData(user.id);
    const serializedPeriods = periods.map(serializePeriodLog);
    const { effectivePeriodLength } = buildCycleStateResponse(serializedPeriods, settings, now);

    // Flow is only meaningful on a day she actually bled, and only logged periods
    // make a day a bleeding day. Enforced here, not just in the UI, so a stale
    // client cannot write flow onto a predicted or future day.
    if (!isBleedingDay(date, serializedPeriods, effectivePeriodLength, now)) {
      throw new HttpError(400, 'Flow can only be logged for a day inside a logged period.');
    }

    await prisma.periodFlowLog.upsert({
      // `dayKey`, not local midnight: the column is `@db.Date`, and Prisma writes
      // the UTC date part — local midnight in IST lands on the previous day.
      where: { userId_date: { userId: user.id, date: dayKey(new Date(`${date}T00:00:00`)) } },
      create: { userId: user.id, date: dayKey(new Date(`${date}T00:00:00`)), flow, source },
      update: { flow, source, loggedAt: now },
    });

    // Same engagement credit the manual /mood and /sleep logs take, so the nudge
    // governor counts her as having shown up today.
    await markTrackerEngagement(user.id, now);
    req.log.info({ date, flow, source }, 'Period flow logged');

    res.status(201).json(await cycleStatePayload(user.id, now));
  } catch (e) {
    next(e);
  }
});

// ─────────────────────────────────────────────
// Mood tracking
// ─────────────────────────────────────────────

function serializeMoodLog(m: { id: string; feeling: number | null; emotions: string[]; loggedAt: Date }) {
  return moodLogSchema.parse({
    id: m.id,
    feeling: m.feeling,
    emotions: m.emotions,
    loggedAt: m.loggedAt.toISOString(),
  });
}

app.get('/mood', async (req, res, next) => {
  try {
    const user = await requireCurrentUser(req);
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const [today, recent] = await Promise.all([
      // Manual mood logs only (nudge L1-003/008 rows leave feeling null).
      prisma.moodLog.findFirst({
        where: { userId: user.id, feeling: { not: null }, loggedAt: { gte: startOfDay } },
        orderBy: { loggedAt: 'desc' },
      }),
      prisma.moodLog.findMany({
        where: { userId: user.id, feeling: { not: null } },
        orderBy: { loggedAt: 'desc' },
        take: 14,
      }),
    ]);

    res.json(
      moodStateResponseSchema.parse({
        today: today ? serializeMoodLog(today) : null,
        recent: recent.map(serializeMoodLog),
      }),
    );
  } catch (e) {
    next(e);
  }
});

app.post('/mood', async (req, res, next) => {
  try {
    const user = await requireCurrentUser(req);
    const { feeling, emotions, loggedAt } = logMoodBodySchema.parse(req.body);
    const created = await prisma.moodLog.create({
      data: {
        userId: user.id,
        feeling,
        emotions,
        ...(loggedAt ? { loggedAt: new Date(loggedAt) } : {}),
      },
    });
    await markTrackerEngagement(user.id, new Date());
    res.status(201).json(serializeMoodLog(created));
  } catch (e) {
    next(e);
  }
});

// ─────────────────────────────────────────────
// Sleep tracking
// ─────────────────────────────────────────────

function serializeSleepLog(s: {
  id: string;
  quality: number | null;
  hours: string | null;
  disruptions: string[];
  loggedAt: Date;
}) {
  return sleepLogSchema.parse({
    id: s.id,
    quality: s.quality,
    hours: s.hours,
    disruptions: s.disruptions,
    loggedAt: s.loggedAt.toISOString(),
  });
}

app.get('/sleep', async (req, res, next) => {
  try {
    const user = await requireCurrentUser(req);
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const [today, recent] = await Promise.all([
      // Manual sleep logs only (nudge L1-001 rows leave quality null).
      prisma.sleepLog.findFirst({
        where: { userId: user.id, quality: { not: null }, loggedAt: { gte: startOfDay } },
        orderBy: { loggedAt: 'desc' },
      }),
      prisma.sleepLog.findMany({
        where: { userId: user.id, quality: { not: null } },
        orderBy: { loggedAt: 'desc' },
        take: 14,
      }),
    ]);

    res.json(
      sleepStateResponseSchema.parse({
        today: today ? serializeSleepLog(today) : null,
        recent: recent.map(serializeSleepLog),
      }),
    );
  } catch (e) {
    next(e);
  }
});

app.post('/sleep', async (req, res, next) => {
  try {
    const user = await requireCurrentUser(req);
    const { quality, hours, disruptions, loggedAt } = logSleepBodySchema.parse(req.body);
    const created = await prisma.sleepLog.create({
      data: {
        userId: user.id,
        quality,
        hours,
        disruptions,
        ...(loggedAt ? { loggedAt: new Date(loggedAt) } : {}),
      },
    });
    await markTrackerEngagement(user.id, new Date());
    res.status(201).json(serializeSleepLog(created));
  } catch (e) {
    next(e);
  }
});

// ─────────────────────────────────────────────
// Quick symptom logging (multiple per day)
// ─────────────────────────────────────────────

const QUICK_SYMPTOMS: QuickSymptom[] = ['hot_flash', 'anxiety', 'chills', 'irritability'];

async function getTodayQuickLogCounts(userId: string) {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const grouped = await prisma.quickSymptomLog.groupBy({
    by: ['symptom'],
    where: { userId, loggedAt: { gte: startOfDay } },
    _count: { symptom: true },
  });

  const counts = { hot_flash: 0, anxiety: 0, chills: 0, irritability: 0 } as Record<
    QuickSymptom,
    number
  >;
  for (const row of grouped) {
    if ((QUICK_SYMPTOMS as string[]).includes(row.symptom)) {
      counts[row.symptom as QuickSymptom] = row._count.symptom;
    }
  }
  return counts;
}

app.get('/report', async (req, res, next) => {
  try {
    const user = await requireCurrentUser(req);
    const { period, offset } = weeklyReportQuerySchema.parse(req.query);
    // Windows are calendar-aligned (Mon-Sun weeks, 1st-EOM months); the trial
    // start only clamps how far back the user can travel and how much of a
    // period counts as coverage.
    const anchor = summaryAnchor(user);
    const report = await buildSummary(user.id, anchor, period, offset);
    res.json(weeklyReportResponseSchema.parse(report));
  } catch (e) {
    next(e);
  }
});

/**
 * Month grid for the summary's date picker (daily view only). Same anchor rule
 * as `/report`, so a day the picker offers is a day the report can render.
 */
app.get('/summary/calendar', async (req, res, next) => {
  try {
    const user = await requireCurrentUser(req);
    const { month } = summaryCalendarQuerySchema.parse(req.query);
    const anchor = summaryAnchor(user);
    const calendar = await buildSummaryCalendar(user.id, month, anchor);
    res.json(summaryCalendarResponseSchema.parse(calendar));
  } catch (e) {
    next(e);
  }
});

app.get('/quick-log', async (req, res, next) => {
  try {
    const user = await requireCurrentUser(req);
    const counts = await getTodayQuickLogCounts(user.id);
    res.json(quickLogStateResponseSchema.parse({ counts }));
  } catch (e) {
    next(e);
  }
});

app.post('/quick-log', async (req, res, next) => {
  try {
    const user = await requireCurrentUser(req);
    const { symptom, loggedAt } = logQuickSymptomBodySchema.parse(req.body);
    // Routed through the write-through module so the tap reaches the daily logs
    // the summary reads, not just the event table.
    await recordQuickSymptom(user.id, symptom, loggedAt ? new Date(loggedAt) : undefined);
    const counts = await getTodayQuickLogCounts(user.id);
    res.status(201).json(
      logQuickSymptomResponseSchema.parse({
        symptom,
        todayCount: counts[symptom],
        message: randomQuickLogMessage(symptom),
      }),
    );
  } catch (e) {
    next(e);
  }
});

type DetailedAssessmentWithAnswers = {
  status: 'in_progress' | 'completed';
  completedAt: Date | null;
  answers: { questionKey: string; value: string }[];
};

function serializeDetailedAssessment(assessment: DetailedAssessmentWithAnswers | null) {
  const answers: Record<string, string> = {};
  if (assessment) {
    for (const answer of assessment.answers) {
      answers[answer.questionKey] = answer.value;
    }
  }
  return detailedAssessmentStateResponseSchema.parse({
    status: assessment?.status ?? 'not_started',
    completedAt: assessment?.completedAt?.toISOString() ?? null,
    answers,
  });
}

/** Keep only answers whose key exists in the shared question catalog. */
function filterValidAnswers(answers: { questionKey: string; value: string }[]) {
  return answers.filter((answer) => detailedAssessmentQuestionKeys.has(answer.questionKey));
}

/**
 * Applies one batch of answers. An empty value is a deletion, not a no-op: the client sends a
 * blank string when the user clears a field, and without the delete the old value would survive
 * and reappear on the next load. Writes and deletes share one transaction so a partial save can
 * never leave a cleared field looking answered.
 */
async function upsertDetailedAnswers(userId: string, answers: { questionKey: string; value: string }[]) {
  const assessment = await prisma.detailedAssessment.upsert({
    where: { userId },
    create: { userId },
    update: {},
    select: { id: true },
  });

  const valid = filterValidAnswers(answers);
  const cleared = valid.filter((answer) => answer.value === '').map((answer) => answer.questionKey);
  const written = valid.filter((answer) => answer.value !== '');

  const operations = [
    ...written.map((answer) =>
      prisma.detailedAnswer.upsert({
        where: { assessmentId_questionKey: { assessmentId: assessment.id, questionKey: answer.questionKey } },
        create: { assessmentId: assessment.id, questionKey: answer.questionKey, value: answer.value },
        update: { value: answer.value },
      }),
    ),
    ...(cleared.length > 0
      ? [
          prisma.detailedAnswer.deleteMany({
            where: { assessmentId: assessment.id, questionKey: { in: cleared } },
          }),
        ]
      : []),
  ];

  if (operations.length > 0) {
    await prisma.$transaction(operations);
  }

  return assessment.id;
}

async function readDetailedAssessment(userId: string) {
  return prisma.detailedAssessment.findUnique({
    where: { userId },
    select: { status: true, completedAt: true, answers: { select: { questionKey: true, value: true } } },
  });
}

app.get('/detailed-assessment', async (req, res, next) => {
  try {
    const user = await requireCurrentUser(req);
    res.json(serializeDetailedAssessment(await readDetailedAssessment(user.id)));
  } catch (e) {
    next(e);
  }
});

app.put('/detailed-assessment', async (req, res, next) => {
  try {
    const user = await requireCurrentUser(req);
    const { answers } = saveDetailedAssessmentBodySchema.parse(req.body);
    await upsertDetailedAnswers(user.id, answers);
    res.json(serializeDetailedAssessment(await readDetailedAssessment(user.id)));
  } catch (e) {
    next(e);
  }
});

/**
 * Marks the assessment complete only once every required question — the signature included — holds
 * a value. The batch is saved either way so a rejected submit never costs anyone their progress;
 * completeness is judged on what is stored afterwards, not on the batch alone, because the client
 * sends only what changed since its last save.
 */
app.post('/detailed-assessment/submit', async (req, res, next) => {
  try {
    const user = await requireCurrentUser(req);
    const { answers } = submitDetailedAssessmentBodySchema.parse(req.body);
    await upsertDetailedAnswers(user.id, answers);

    const saved = await readDetailedAssessment(user.id);
    const stored: Record<string, string> = {};
    for (const answer of saved?.answers ?? []) {
      stored[answer.questionKey] = answer.value;
    }

    const missing = findMissingDetailedAnswers(stored);
    if (missing.length > 0) {
      req.log.warn({ missing: missing.length }, 'Detailed assessment submit rejected: incomplete');
      res.status(400).json({
        error: 'Some required questions are still unanswered.',
        missing,
      });
      return;
    }

    await prisma.detailedAssessment.update({
      where: { userId: user.id },
      data: { status: 'completed', completedAt: new Date() },
    });
    res.json(serializeDetailedAssessment(await readDetailedAssessment(user.id)));
  } catch (e) {
    next(e);
  }
});

/**
 * The reviewer's read of one user's detailed assessment, narrowed to the sections their lens
 * covers. Two gates apply in order: the consultation must be this doctor's (or the caller must
 * hold the admin key), and the answers are then cut down to the questions their lens owns. The
 * narrowing happens here rather than in the portal, so no client bug can widen what is returned.
 *
 * A specialist with no lens assigned sees no sections at all — the map in bookingCatalog denies
 * by default rather than granting.
 */
app.get('/doctor/consultations/:id/detailed-assessment', async (req, res, next) => {
  try {
    const identity = requireDoctorIdentity(req);

    const consultation = await prisma.consultation.findFirst({
      where: { id: req.params.id, ...doctorConsultationScope(identity) },
      select: { userId: true },
    });

    if (!consultation) {
      throw new HttpError(404, 'Consultation not found.');
    }

    // The admin key is the operations key and already reads every consultation; it reads the whole
    // assessment too. A specialist gets only the lenses their catalog entry grants.
    const lenses =
      identity.scope === 'admin' ? (['all'] as const) : lensesForSpecialist(identity.specialistKey);

    const visible = detailedSectionsForLenses(lenses);
    const visibleKeys = new Set(visible.flatMap((section) => section.questions.map((q) => q.key)));

    if (visible.length === 0) {
      req.log.warn(
        { specialistKey: identity.scope === 'doctor' ? identity.specialistKey : null },
        'Detailed assessment requested by a specialist with no lens assigned',
      );
    }

    const assessment = await readDetailedAssessment(consultation.userId);
    const answers: Record<string, string> = {};
    for (const answer of assessment?.answers ?? []) {
      if (visibleKeys.has(answer.questionKey)) {
        answers[answer.questionKey] = answer.value;
      }
    }

    res.json(
      doctorDetailedAssessmentResponseSchema.parse({
        status: assessment?.status ?? 'not_started',
        completedAt: assessment?.completedAt?.toISOString() ?? null,
        lenses: [...lenses],
        sectionKeys: visible.map((section) => section.key),
        answers,
      }),
    );
  } catch (e) {
    next(e);
  }
});

// ─────────────────────────────────────────────
// Anonymous Q&A
//
// The asker's identity is stored (so she can follow her own thread) but never served. Every
// response below is built from ANONYMOUS_QUESTION_SELECT, which has no `userId` and no `user`
// relation — so a doctor route cannot leak the asker even by accident.
// ─────────────────────────────────────────────

/** The only shape a question is ever serialized from. Deliberately omits userId. */
const ANONYMOUS_QUESTION_SELECT = {
  id: true,
  topic: true,
  body: true,
  status: true,
  createdAt: true,
  answers: {
    select: {
      id: true,
      expertName: true,
      expertRole: true,
      body: true,
      verified: true,
      answeredAt: true,
    },
    orderBy: { answeredAt: 'asc' },
  },
} as const;

type AnonymousQuestionRow = {
  id: string;
  topic: string;
  body: string;
  status: 'pending' | 'answered';
  createdAt: Date;
  answers: {
    id: string;
    expertName: string;
    expertRole: string | null;
    body: string;
    verified: boolean;
    answeredAt: Date;
  }[];
};

/** `topic` is a free-text column, so anything seeded outside the enum degrades to `other`. */
function toQuestionTopic(value: string): AnonymousQuestionTopic {
  const parsed = anonymousQuestionTopicSchema.safeParse(value);
  return parsed.success ? parsed.data : 'other';
}

function serializeAnonymousQuestion(row: AnonymousQuestionRow) {
  return {
    id: row.id,
    topic: toQuestionTopic(row.topic),
    body: row.body,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    answers: row.answers.map((answer) => ({
      id: answer.id,
      expertName: answer.expertName,
      expertRole: answer.expertRole,
      body: answer.body,
      verified: answer.verified,
      answeredAt: answer.answeredAt.toISOString(),
    })),
  };
}

/** Keeps one account from flooding the shared specialist queue. */
async function remainingQuestionsToday(userId: string): Promise<number> {
  const asked = await prisma.anonymousQuestion.count({
    where: { userId, createdAt: { gte: addDays(new Date(), -1) } },
  });

  return Math.max(0, ANONYMOUS_QA_DAILY_LIMIT - asked);
}

app.post('/questions', async (req, res, next) => {
  try {
    const user = await requireCurrentUser(req);
    const { topic, body } = createAnonymousQuestionBodySchema.parse(req.body);

    if ((await remainingQuestionsToday(user.id)) <= 0) {
      throw new HttpError(
        429,
        `You can ask up to ${ANONYMOUS_QA_DAILY_LIMIT} questions a day. Please come back tomorrow.`,
      );
    }

    const question = await prisma.anonymousQuestion.create({
      data: { userId: user.id, topic, body },
      select: ANONYMOUS_QUESTION_SELECT,
    });

    // Only the topic travels to the doctors — the question text stays in the portal, and the
    // asker is never identified in either direction.
    void notifyDoctorsQuestionAsked(question.id, anonymousQuestionTopicLabel(topic));

    res.status(201).json(
      createAnonymousQuestionResponseSchema.parse({
        question: serializeAnonymousQuestion(question as AnonymousQuestionRow),
        remainingToday: await remainingQuestionsToday(user.id),
      }),
    );
  } catch (e) {
    next(e);
  }
});

app.get('/questions/mine', async (req, res, next) => {
  try {
    const user = await requireCurrentUser(req);

    const questions = await prisma.anonymousQuestion.findMany({
      where: { userId: user.id },
      select: ANONYMOUS_QUESTION_SELECT,
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    res.json(
      myAnonymousQuestionsResponseSchema.parse({
        questions: (questions as AnonymousQuestionRow[]).map(serializeAnonymousQuestion),
        remainingToday: await remainingQuestionsToday(user.id),
      }),
    );
  } catch (e) {
    next(e);
  }
});

/**
 * The public wall of answered questions. Every asker is anonymous to every reader, including the
 * asker's own questions — they are indistinguishable here, and found under /questions/mine.
 */
app.get('/questions/feed', async (req, res, next) => {
  try {
    await requireCurrentUser(req);
    const { topic, limit } = anonymousQuestionFeedQuerySchema.parse(req.query);

    const questions = await prisma.anonymousQuestion.findMany({
      where: {
        status: 'answered',
        ...(topic ? { topic } : {}),
      },
      select: ANONYMOUS_QUESTION_SELECT,
      orderBy: { answeredAt: 'desc' },
      take: limit ?? 20,
    });

    res.json(
      anonymousQuestionFeedResponseSchema.parse({
        questions: (questions as AnonymousQuestionRow[]).map(serializeAnonymousQuestion),
      }),
    );
  } catch (e) {
    next(e);
  }
});

/**
 * The specialist queue. Unlike consultations, questions are not assigned to a doctor — the queue
 * is shared and whoever is qualified picks one up, so both scopes see the same list.
 */
app.get('/doctor/questions', async (req, res, next) => {
  try {
    const identity = requireDoctorIdentity(req);
    const { status, topic, limit } = doctorQuestionsQuerySchema.parse(req.query);

    const where = {
      ...(status ? { status } : {}),
      ...(topic ? { topic } : {}),
    };

    const [questions, pendingCount, answeredCount] = await Promise.all([
      prisma.anonymousQuestion.findMany({
        where,
        select: ANONYMOUS_QUESTION_SELECT,
        // Pending first, oldest first inside each group: the longest wait is answered next.
        orderBy: [{ status: 'asc' }, { createdAt: 'asc' }],
        take: limit ?? 100,
      }),
      prisma.anonymousQuestion.count({ where: { status: 'pending' } }),
      prisma.anonymousQuestion.count({ where: { status: 'answered' } }),
    ]);

    res.json(
      doctorQuestionsResponseSchema.parse({
        questions: (questions as AnonymousQuestionRow[]).map(serializeAnonymousQuestion),
        pendingCount,
        answeredCount,
        canAnswer: identity.scope === 'doctor',
      }),
    );
  } catch (e) {
    next(e);
  }
});

/**
 * Answers are signed with the specialist behind the key, never with a name from the request, so
 * an answer cannot be attributed to a doctor who did not write it. The shared admin key has no
 * specialist to sign as and is read-only here.
 */
app.post('/doctor/questions/:id/answer', async (req, res, next) => {
  try {
    const identity = requireDoctorIdentity(req);
    if (identity.scope !== 'doctor') {
      throw new HttpError(403, 'Answers must be written from a specialist’s own portal key.');
    }

    const { body } = answerAnonymousQuestionBodySchema.parse(req.body);

    const specialist = await prisma.specialist.findUnique({
      where: { id: identity.specialistId },
      select: { id: true, name: true, role: true, subtitle: true },
    });

    if (!specialist) {
      throw new HttpError(401, 'Invalid or missing doctor access key.');
    }

    const existing = await prisma.anonymousQuestion.findUnique({
      where: { id: req.params.id },
      select: { id: true, userId: true, answeredAt: true },
    });

    if (!existing) {
      throw new HttpError(404, 'Question not found.');
    }

    const answeredAt = new Date();

    const question = await prisma.$transaction(async (tx) => {
      await tx.expertAnswer.create({
        data: {
          questionId: existing.id,
          specialistId: specialist.id,
          expertName: specialist.name,
          expertRole: specialist.role ?? specialist.subtitle ?? null,
          body,
          verified: true,
          answeredAt,
        },
      });

      return tx.anonymousQuestion.update({
        where: { id: existing.id },
        data: {
          status: 'answered',
          // Stamped once: it marks when the question stopped waiting, so a second answer on the
          // same thread does not push it back to the top of the feed.
          answeredAt: existing.answeredAt ?? answeredAt,
        },
        select: ANONYMOUS_QUESTION_SELECT,
      });
    });

    if (existing.userId) {
      void notifyAskerQuestionAnswered(existing.userId, specialist.name);
    }

    res.json(
      answerAnonymousQuestionResponseSchema.parse({
        question: serializeAnonymousQuestion(question as AnonymousQuestionRow),
      }),
    );
  } catch (e) {
    next(e);
  }
});

// ─────────────────────────────────────────────
// Help & support
// ─────────────────────────────────────────────

const SUPPORT_TICKET_SELECT = {
  id: true,
  reference: true,
  category: true,
  subject: true,
  message: true,
  contactEmail: true,
  status: true,
  response: true,
  respondedAt: true,
  createdAt: true,
} as const;

type SupportTicketRow = {
  id: string;
  reference: string;
  category: 'account' | 'consultation' | 'subscription' | 'technical' | 'privacy' | 'other';
  subject: string;
  message: string;
  contactEmail: string | null;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  response: string | null;
  respondedAt: Date | null;
  createdAt: Date;
};

function serializeSupportTicket(row: SupportTicketRow) {
  return supportTicketSchema.parse({
    id: row.id,
    reference: row.reference,
    category: row.category,
    subject: row.subject,
    message: row.message,
    contactEmail: row.contactEmail,
    status: row.status,
    response: row.response,
    respondedAt: row.respondedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  });
}

/**
 * A short reference she can quote back to us. Crockford-ish alphabet: no O/I/1/0, because these
 * get read out over a call. Collisions are retried by the caller against the unique index.
 */
function generateSupportReference(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.randomBytes(6);
  let suffix = '';
  for (const byte of bytes) {
    suffix += alphabet[byte % alphabet.length];
  }
  return `ANV-${suffix}`;
}

/** Keeps one account from flooding the support queue. */
async function remainingSupportTicketsToday(userId: string): Promise<number> {
  const opened = await prisma.supportTicket.count({
    where: { userId, createdAt: { gte: addDays(new Date(), -1) } },
  });

  return Math.max(0, SUPPORT_TICKET_DAILY_LIMIT - opened);
}

/**
 * Opens a help request. It is stored here and answered from the admin panel — nothing is emailed,
 * so what she writes never reaches a third party and stays erasable on request.
 *
 * `purgeAfter` is stamped at creation rather than derived at delete time: the retention promise in
 * the consent notice then lives on the row itself, and changing the policy later cannot silently
 * extend the life of tickets already collected under the old one.
 */
app.post('/support/tickets', async (req, res, next) => {
  try {
    const user = await requireCurrentUser(req);
    const body = createSupportTicketBodySchema.parse(req.body);

    if ((await remainingSupportTicketsToday(user.id)) <= 0) {
      throw new HttpError(
        429,
        `You can open up to ${SUPPORT_TICKET_DAILY_LIMIT} requests a day. We are already looking at the ones you sent.`,
      );
    }

    const contactEmail = body.contactEmail?.trim() ? body.contactEmail.trim().toLowerCase() : null;
    const appVersion =
      typeof req.headers['x-app-version'] === 'string'
        ? req.headers['x-app-version'].slice(0, 40)
        : null;

    // The unique reference is generated, not derived, so a retry on the astronomically unlikely
    // collision is cheaper than coordinating a sequence.
    let ticket: SupportTicketRow | null = null;
    for (let attempt = 0; attempt < 5 && !ticket; attempt += 1) {
      try {
        ticket = (await prisma.supportTicket.create({
          data: {
            reference: generateSupportReference(),
            userId: user.id,
            category: body.category,
            subject: body.subject,
            message: body.message,
            contactEmail,
            consentVersion: body.consentVersion,
            appVersion,
            purgeAfter: addDays(new Date(), SUPPORT_TICKET_RETENTION_DAYS),
          },
          select: SUPPORT_TICKET_SELECT,
        })) as SupportTicketRow;
      } catch (error) {
        if (!isUniqueConstraintError(error)) {
          throw error;
        }
      }
    }

    if (!ticket) {
      throw new HttpError(500, 'Could not open your request. Please try again.');
    }

    // Subject and message are deliberately absent from the log line — a support note may describe
    // symptoms, and logs are the one place that outlives the purge job.
    req.log.info(
      { ticketId: ticket.id, reference: ticket.reference, category: ticket.category },
      'Support ticket opened',
    );

    res.status(201).json(
      createSupportTicketResponseSchema.parse({
        ticket: serializeSupportTicket(ticket),
        remainingToday: await remainingSupportTicketsToday(user.id),
      }),
    );
  } catch (e) {
    next(e);
  }
});

/** Her own requests and any replies, newest first. */
app.get('/support/tickets', async (req, res, next) => {
  try {
    const user = await requireCurrentUser(req);

    const tickets = (await prisma.supportTicket.findMany({
      where: { userId: user.id },
      select: SUPPORT_TICKET_SELECT,
      orderBy: { createdAt: 'desc' },
      take: 50,
    })) as SupportTicketRow[];

    res.json(
      mySupportTicketsResponseSchema.parse({
        tickets: tickets.map(serializeSupportTicket),
        remainingToday: await remainingSupportTicketsToday(user.id),
      }),
    );
  } catch (e) {
    next(e);
  }
});

// ─────────────────────────────────────────────
// Library
// ─────────────────────────────────────────────

// Editorial feed. Public — the library is readable without a session so it can
// be linked to from onboarding and marketing.
app.get('/library', (req, res, next) => {
  try {
    const query = libraryFeedQuerySchema.parse(req.query);
    res.json(libraryFeedResponseSchema.parse(getLibraryFeed(query)));
  } catch (e) {
    next(e);
  }
});

app.get('/library/articles/:slug', (req, res, next) => {
  try {
    const { slug } = libraryArticleParamsSchema.parse(req.params);
    const result = getLibraryArticle(slug);
    if (!result) {
      throw new HttpError(404, 'Article not found.');
    }
    res.json(libraryArticleResponseSchema.parse(result));
  } catch (e) {
    next(e);
  }
});

// ─────────────────────────────────────────────
// Privacy & data rights (DPDP §11 access, §12 erasure)
// ─────────────────────────────────────────────

function serializeDeletionRequest(row: {
  id: string;
  scope: string;
  status: string;
  requestedAt: Date;
  scheduledFor: Date;
  completedAt: Date | null;
  itemCounts: unknown;
}) {
  return {
    id: row.id,
    scope: row.scope,
    status: row.status,
    requestedAt: row.requestedAt.toISOString(),
    scheduledFor: row.scheduledFor.toISOString(),
    completedAt: row.completedAt?.toISOString() ?? null,
    itemCounts: (row.itemCounts as Record<string, number> | null) ?? null,
  };
}

function serializeDataExport(row: {
  id: string;
  status: string;
  createdAt: Date;
  expiresAt: Date;
  downloadedAt: Date | null;
  sizeBytes: number | null;
}) {
  return {
    id: row.id,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    expiresAt: row.expiresAt.toISOString(),
    downloadedAt: row.downloadedAt?.toISOString() ?? null,
    sizeBytes: row.sizeBytes,
  };
}

/**
 * Re-verifies possession of her phone before an irreversible erasure or before minting a copy of her
 * whole history. A valid session is not enough for either: one is destructive and the other is an
 * exfiltration primitive, and both should cost an attacker with a stolen cookie something.
 *
 * Same checks as /auth/verify-otp, with the purpose pinned and the challenge required to belong to
 * this account — otherwise a code issued for a different flow, or a different user, would pass.
 */
async function consumePrivacyOtp(
  userId: string,
  phone: string,
  challengeId: string,
  otp: string,
  purpose: 'account_deletion' | 'data_export',
): Promise<void> {
  const challenge = await prisma.otpChallenge.findUnique({ where: { id: challengeId } });

  if (!challenge || challenge.userId !== userId || challenge.phone !== phone || challenge.purpose !== purpose) {
    throw new HttpError(404, 'OTP challenge not found.');
  }

  if (challenge.status !== 'pending') {
    throw new HttpError(400, 'This OTP has already been used. Please request a new one.');
  }

  if (challenge.expiresAt <= new Date()) {
    await prisma.otpChallenge.update({ where: { id: challenge.id }, data: { status: 'expired' } });
    throw new HttpError(400, 'This OTP has expired. Please request a new one.');
  }

  if (challenge.attemptCount >= OTP_MAX_VERIFY_ATTEMPTS) {
    await prisma.otpChallenge.update({ where: { id: challenge.id }, data: { status: 'failed' } });
    throw new HttpError(429, 'Too many incorrect OTP attempts. Please request a new OTP.');
  }

  try {
    await verifyOtpWithTwoFactor(challenge.providerSessionId, otp);
  } catch (error) {
    await prisma.otpChallenge.update({
      where: { id: challenge.id },
      data: {
        attemptCount: { increment: 1 },
        status: challenge.attemptCount + 1 >= OTP_MAX_VERIFY_ATTEMPTS ? 'failed' : 'pending',
      },
    });
    throw error;
  }

  await prisma.otpChallenge.update({
    where: { id: challenge.id },
    data: { status: 'verified', verifiedAt: new Date() },
  });
}

/**
 * What we hold, why, and what has already been asked for. The counts are what make the delete
 * buttons on this screen honest, so they are computed live rather than cached.
 */
app.get('/privacy/summary', async (req, res, next) => {
  try {
    const user = await requireCurrentUser(req);
    setNoStoreHeaders(res);

    const [categories, pendingDeletion, history, latestExport, recentExport] = await Promise.all([
      buildPrivacyCategories(user.id),
      prisma.dataDeletionRequest.findFirst({
        where: { userId: user.id, status: { in: ['pending', 'processing'] } },
        orderBy: { requestedAt: 'desc' },
      }),
      prisma.dataDeletionRequest.findMany({
        where: { userId: user.id, status: { in: ['completed', 'cancelled', 'failed'] } },
        orderBy: { requestedAt: 'desc' },
        take: 20,
      }),
      prisma.dataExportRequest.findFirst({
        where: { userId: user.id },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.dataExportRequest.findFirst({
        where: {
          userId: user.id,
          createdAt: { gte: addSeconds(new Date(), -(DATA_EXPORT_COOLDOWN_HOURS * 60 * 60)) },
          // A failed generation should not cost her the day's allowance.
          status: { not: 'failed' },
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    res.json(
      privacySummaryResponseSchema.parse({
        categories,
        pendingDeletion: pendingDeletion ? serializeDeletionRequest(pendingDeletion) : null,
        history: history.map(serializeDeletionRequest),
        latestExport: latestExport ? serializeDataExport(latestExport) : null,
        exportAvailableAt: recentExport
          ? addSeconds(recentExport.createdAt, DATA_EXPORT_COOLDOWN_HOURS * 60 * 60).toISOString()
          : null,
        graceDays: ACCOUNT_DELETION_GRACE_DAYS,
        slaDays: ERASURE_SLA_DAYS,
      }),
    );
  } catch (e) {
    next(e);
  }
});

/** Sends the confirmation code for a deletion or an export, to the phone already on the account. */
app.post('/privacy/otp', async (req, res, next) => {
  try {
    const user = await requireCurrentUser(req);
    setNoStoreHeaders(res);
    const body = privacyOtpBodySchema.parse(req.body);
    const now = new Date();

    // Shares the sign-in rate limits deliberately: this is the same SMS budget and the same abuse
    // surface, counted per phone rather than per purpose.
    const recentSendCount = await prisma.otpChallenge.count({
      where: { phone: user.phone, createdAt: { gte: addSeconds(now, -(15 * 60)) } },
    });

    if (recentSendCount >= OTP_MAX_SENDS_PER_15_MINUTES) {
      throw new HttpError(429, 'Too many OTP requests. Please wait a few minutes and try again.');
    }

    const recentChallenge = await prisma.otpChallenge.findFirst({
      where: {
        phone: user.phone,
        purpose: body.intent,
        createdAt: { gte: addSeconds(now, -OTP_RESEND_COOLDOWN_SECONDS) },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (recentChallenge) {
      const retryInSeconds = Math.max(
        0,
        Math.ceil(
          (addSeconds(recentChallenge.createdAt, OTP_RESEND_COOLDOWN_SECONDS).getTime() -
            now.getTime()) /
            1000,
        ),
      );
      if (retryInSeconds > 0) {
        throw new HttpError(
          429,
          `Please wait ${retryInSeconds} seconds before requesting another OTP.`,
        );
      }
    }

    const providerSessionId = await sendOtpWithTwoFactor(user.phone);
    const challenge = await prisma.otpChallenge.create({
      data: {
        phone: user.phone,
        userId: user.id,
        purpose: body.intent,
        provider: '2factor',
        providerSessionId,
        expiresAt: addSeconds(now, OTP_EXPIRY_MINUTES * 60),
      },
    });

    req.log.info({ intent: body.intent, challengeId: challenge.id }, 'Privacy OTP sent');

    res.json(
      privacyOtpResponseSchema.parse({
        challengeId: challenge.id,
        maskedPhone: maskPhone(user.phone),
        resendAfterSeconds: OTP_RESEND_COOLDOWN_SECONDS,
      }),
    );
  } catch (e) {
    next(e);
  }
});

/**
 * Asks for an erasure.
 *
 * The narrow scopes run inline and return their counts — a pending state on "delete my recordings"
 * would be confusing, and there is nothing to reconsider. Account deletion is the opposite: it is
 * scheduled, not executed, so the seven days are hers to change her mind in. She stays signed in
 * throughout, because the cancel button is on this screen and locking her out to protect her from a
 * decision she just confirmed would only make it harder to undo.
 */
app.post('/privacy/deletion-requests', async (req, res, next) => {
  try {
    const user = await requireCurrentUser(req);
    setNoStoreHeaders(res);
    const body = createDeletionRequestBodySchema.parse(req.body);
    const now = new Date();

    const existing = await prisma.dataDeletionRequest.findFirst({
      where: { userId: user.id, status: { in: ['pending', 'processing'] } },
    });

    if (existing) {
      throw new HttpError(
        409,
        'A deletion is already scheduled on this account. Cancel it first if you want to change it.',
      );
    }

    if (body.scope === 'account') {
      // superRefine has already established both are present for this scope.
      await consumePrivacyOtp(
        user.id,
        user.phone,
        body.challengeId as string,
        body.otp as string,
        'account_deletion',
      );

      // A future consultation would otherwise be erased out from under the doctor's calendar, and
      // she may be owed a refund on it. Hers to resolve, not ours to guess at.
      const upcoming = await prisma.consultation.count({
        where: { userId: user.id, scheduledAt: { gt: now }, status: { in: ['pending', 'confirmed'] } },
      });

      if (upcoming > 0) {
        throw new HttpError(
          409,
          'You have an upcoming consultation. Please cancel it first, then delete your account.',
        );
      }

      const request = await prisma.dataDeletionRequest.create({
        data: {
          userId: user.id,
          phoneHash: sha256(user.phone),
          scope: 'account',
          scheduledFor: addDays(now, ACCOUNT_DELETION_GRACE_DAYS),
        },
      });

      req.log.info({ requestId: request.id }, 'Account deletion scheduled');

      res.status(201).json(
        createDeletionRequestResponseSchema.parse({
          request: serializeDeletionRequest(request),
          accountScheduled: true,
        }),
      );
      return;
    }

    const counts = await eraseScope(user.id, body.scope);
    const request = await prisma.dataDeletionRequest.create({
      data: {
        userId: user.id,
        phoneHash: sha256(user.phone),
        scope: body.scope,
        status: 'completed',
        scheduledFor: now,
        completedAt: new Date(),
        itemCounts: counts,
      },
    });

    req.log.info({ requestId: request.id, scope: body.scope }, 'Scoped erasure completed');

    res.status(201).json(
      createDeletionRequestResponseSchema.parse({
        request: serializeDeletionRequest(request),
        accountScheduled: false,
      }),
    );
  } catch (e) {
    next(e);
  }
});

/** Cancels a scheduled account deletion. Only while it is still pending — once it runs, it is gone. */
app.delete('/privacy/deletion-requests/:id', async (req, res, next) => {
  try {
    const user = await requireCurrentUser(req);
    setNoStoreHeaders(res);

    const request = await prisma.dataDeletionRequest.findUnique({ where: { id: req.params.id } });

    if (!request || request.userId !== user.id) {
      throw new HttpError(404, 'That request could not be found.');
    }

    if (request.status !== 'pending') {
      throw new HttpError(409, 'That deletion is already being processed and cannot be cancelled.');
    }

    const cancelled = await prisma.dataDeletionRequest.update({
      where: { id: request.id },
      data: { status: 'cancelled', cancelledAt: new Date() },
    });

    req.log.info({ requestId: request.id }, 'Account deletion cancelled');

    res.json(
      cancelDeletionRequestResponseSchema.parse({
        request: serializeDeletionRequest(cancelled),
      }),
    );
  } catch (e) {
    next(e);
  }
});

/**
 * Stages a copy of everything we hold about her and returns a single-use link.
 *
 * OTP-gated and rate-limited to one a day: this is the one endpoint that turns a session into a
 * portable copy of a complete health history. The link is returned here and nowhere else — it is
 * never emailed, because that would put her health data in a third-party mailbox outside anything
 * this screen can promise about retention.
 */
app.post('/privacy/exports', async (req, res, next) => {
  try {
    const user = await requireCurrentUser(req);
    setNoStoreHeaders(res);
    const body = createDataExportBodySchema.parse(req.body);

    const recent = await prisma.dataExportRequest.findFirst({
      where: {
        userId: user.id,
        createdAt: { gte: addSeconds(new Date(), -(DATA_EXPORT_COOLDOWN_HOURS * 60 * 60)) },
        status: { not: 'failed' },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (recent) {
      throw new HttpError(
        429,
        `You can download your data once every ${DATA_EXPORT_COOLDOWN_HOURS} hours. Please try again later.`,
      );
    }

    await consumePrivacyOtp(user.id, user.phone, body.challengeId, body.otp, 'data_export');

    const created = await createDataExport(user.id, DATA_EXPORT_TTL_HOURS);
    const row = await prisma.dataExportRequest.findUniqueOrThrow({ where: { id: created.id } });

    req.log.info({ exportId: created.id, sizeBytes: created.sizeBytes }, 'Data export requested');

    res.status(201).json(
      createDataExportResponseSchema.parse({
        export: serializeDataExport(row),
        downloadUrl: `/privacy/exports/${created.id}/download?token=${created.token}`,
      }),
    );
  } catch (e) {
    next(e);
  }
});

/**
 * Hands over the staged file, once. The token is compared by hash and the file is unlinked as soon
 * as it has been sent — a health-history archive should not sit on disk waiting for a second
 * request. Session-authenticated as well as tokenised, so a leaked link is useless on its own.
 */
app.get('/privacy/exports/:id/download', async (req, res, next) => {
  try {
    const user = await requireCurrentUser(req);
    setNoStoreHeaders(res);

    const token = typeof req.query.token === 'string' ? req.query.token : '';
    if (!token) {
      throw new HttpError(400, 'That download link is incomplete.');
    }

    const row = await prisma.dataExportRequest.findUnique({ where: { id: req.params.id } });

    if (!row || row.userId !== user.id || row.tokenHash !== sha256(token)) {
      throw new HttpError(404, 'That download could not be found.');
    }

    if (row.status !== 'ready' || !row.storagePath) {
      throw new HttpError(410, 'That download has already been used or has expired.');
    }

    if (row.expiresAt <= new Date()) {
      throw new HttpError(410, 'That download has expired. Please ask for your data again.');
    }

    const absolute = resolveExportPath(row.storagePath);
    if (!absolute) {
      throw new HttpError(410, 'That download is no longer available.');
    }

    // Marked before the send, not after: if the transfer dies halfway the copy is still considered
    // handed over. Re-issuing it would mean keeping the file alive on a promise of one download.
    await prisma.dataExportRequest.update({
      where: { id: row.id },
      data: { status: 'downloaded', downloadedAt: new Date(), storagePath: null },
    });

    res.download(absolute, `anuva-data-export-${row.createdAt.toISOString().slice(0, 10)}.json`, (error) => {
      void unlinkExportFile(row.storagePath);
      if (error) {
        req.log.error({ err: error, exportId: row.id }, 'Data export download failed');
      }
    });
  } catch (e) {
    next(e);
  }
});

/** body-parser tags its size rejection with this type; it carries no dedicated error class. */
function isPayloadTooLarge(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    (err as { type?: unknown }).type === 'entity.too.large'
  );
}

app.use(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  (err: unknown, req: express.Request, res: express.Response, _next: express.NextFunction) => {
    // Expected rejections are logged at warn with the reason, so a 400/401/404 is no longer
    // invisible — the request line alone never explained why the client was turned away.
    if (err instanceof ZodError) {
      req.log.warn({ issues: err.flatten() }, 'Request rejected: validation failed');
      res.status(400).json({ error: 'Validation failed', issues: err.flatten() });
      return;
    }

    if (err instanceof AdminError) {
      req.log.warn({ status: err.status, code: err.code }, `Request rejected: ${err.message}`);
      res.status(err.status).json({
        error: err.message,
        code: err.code,
        ...(err.details !== undefined ? { details: err.details } : {}),
      });
      return;
    }

    if (err instanceof HttpError) {
      req.log.warn({ status: err.status }, `Request rejected: ${err.message}`);
      res.status(err.status).json({ error: err.message });
      return;
    }

    // body-parser rejects an oversized JSON body before any route sees it. Without this branch it
    // falls through to the 500 below and reads as a server fault rather than an over-large request.
    if (isPayloadTooLarge(err)) {
      req.log.warn('Request rejected: body exceeds the JSON size limit');
      res.status(413).json({ error: 'That request was too large. Try again with less data.' });
      return;
    }

    // Upload failures are the client's fault, not the server's: too big, too many, wrong field.
    if (err instanceof MulterError) {
      const status = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
      const message =
        err.code === 'LIMIT_FILE_SIZE'
          ? 'That file is larger than 10MB. Retake the photo or compress the PDF.'
          : `Upload rejected: ${err.message}`;
      req.log.warn({ code: err.code }, `Request rejected: ${message}`);
      res.status(status).json({ error: message });
      return;
    }

    if (err instanceof UnsupportedDocumentTypeError) {
      req.log.warn({ status: 415 }, `Request rejected: ${err.message}`);
      res.status(415).json({ error: err.message });
      return;
    }

    req.log.error({ err }, 'Unhandled error');
    res.status(500).json({ error: 'Internal server error' });
  }
);

async function startServer() {
  await readyBookingCatalog();

  startNudgeScheduler();
  startSupportRetentionJob();
  startPrivacyRetentionJobs();

  // Warm the ANU semantic cache so a restart does not send every question
  // straight to the model until the index refills.
  if (isAnuChatConfigured()) {
    try {
      const size = await loadCache();
      logger.info({ entries: size }, 'ANU response cache loaded');
    } catch (e) {
      logger.error({ err: e }, '[anu] failed to load response cache');
    }
  } else {
    logger.warn('OPENAI_API_KEY is not set — POST /anu/chat will return 503');
  }

  const server = app.listen(port, () => {
    logger.info(
      {
        port,
        env: process.env.NODE_ENV ?? 'development',
        logLevel: logger.level,
        recordingDir: RECORDING_LOCAL_DIR || null,
        consultationDocDir: CONSULTATION_DOC_DIR,
      },
      'API listening',
    );
  });

  // A port clash or permission error on listen() emits on the server, not the promise, so
  // without this it surfaces as an unhandled 'error' event with no log line of our own.
  server.on('error', (err) => {
    logger.fatal({ err, port }, 'Server failed to bind');
    process.exit(1);
  });

  // Coolify sends SIGTERM on redeploy. Without a handler the process is killed outright and the
  // shutdown is invisible in the logs, which reads identically to a crash.
  for (const signal of ['SIGTERM', 'SIGINT'] as const) {
    process.on(signal, () => {
      logger.info({ signal }, 'Shutting down');
      server.close(() => process.exit(0));
      // node-cron timers and open Prisma handles can hold the loop open past close().
      setTimeout(() => process.exit(0), 10_000).unref();
    });
  }
}

// Both are silent today: an unhandled rejection prints a bare V8 warning to stderr with no
// context, and an uncaught exception kills the container with nothing in the log to explain it.
process.on('unhandledRejection', (reason) => {
  logger.error({ err: reason }, 'Unhandled promise rejection');
});

process.on('uncaughtException', (err) => {
  logger.fatal({ err }, 'Uncaught exception — exiting');
  process.exit(1);
});

startServer().catch((err) => {
  logger.fatal({ err }, 'API failed to start');
  process.exit(1);
});
