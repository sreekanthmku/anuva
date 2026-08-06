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
  doctorAccessKeyRotateResponseSchema,
  doctorConsultationBookingsResponseSchema,
  doctorIdentityResponseSchema,
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
  answerAnonymousQuestionBodySchema,
  answerAnonymousQuestionResponseSchema,
  weeklyReportQuerySchema,
  weeklyReportResponseSchema,
  type AnonymousQuestionTopic,
  type AuthUser,
  type ConsultationCallState,
} from '@anuva/shared';
import { ZodError } from 'zod';
import { BOOKABLE_DOCTOR_KEYS, ensureBookingCatalog } from './bookingCatalog.js';
import { sendPushToAllTokens } from './fcm.js';
import { computeAvgPeriodLength, computeCycleState } from './cycleCalc.js';
import { startNudgeScheduler, dispatchSlot } from './nudge/scheduler.js';
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
import { randomQuickLogMessage } from './quickLogMessages.js';
import { answer as anuAnswer } from './anu/engine.js';
import { getLibraryArticle, getLibraryFeed } from './library.js';
import { isAnuChatConfigured } from './anu/openai.js';
import { loadCache, cacheStats } from './anu/cache.js';
import { httpLogger, logger } from './logger.js';

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
const DOCTOR_ACCESS_KEY = process.env.DOCTOR_ACCESS_KEY?.trim() || '';
// Questions land in one shared specialist queue, so a single account is capped per rolling day.
const ANONYMOUS_QA_DAILY_LIMIT = Math.max(1, Number(process.env.ANONYMOUS_QA_DAILY_LIMIT || 5));
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

app.use(express.json());

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
 * Who is behind an authenticated /doctor request. `doctor` is a single specialist holding their
 * own key and only ever sees their own consultations; `admin` is the shared DOCTOR_ACCESS_KEY,
 * kept for ops, and sees every booking.
 */
type DoctorIdentity =
  | { scope: 'admin'; specialistId: null; specialistKey: null; specialistName: null }
  | { scope: 'doctor'; specialistId: string; specialistKey: string; specialistName: string };

// Keyed by request object rather than a global Express type augmentation, so the identity cannot
// be read on a request that never went through the guard.
const doctorIdentities = new WeakMap<Request, DoctorIdentity>();

function requireDoctorIdentity(req: Request): DoctorIdentity {
  const identity = doctorIdentities.get(req);
  if (!identity) {
    throw new HttpError(401, 'Invalid or missing doctor access key.');
  }

  return identity;
}

/** Only the doctor's own consultations, or every one of them for the admin key. */
function doctorConsultationScope(identity: DoctorIdentity): { specialistId?: string } {
  return identity.scope === 'doctor' ? { specialistId: identity.specialistId } : {};
}

function hashDoctorAccessKey(key: string): string {
  return crypto.createHash('sha256').update(key).digest('hex');
}

function timingSafeEquals(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);

  // timingSafeEqual throws on length mismatch, so the lengths are compared first. The
  // length of the key is not a secret worth protecting here.
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

/**
 * Every /doctor route exposes patient names, phone numbers, and the ability to mint a
 * LiveKit token, so they are gated behind a key. Two kinds are accepted:
 *
 * - a specialist's own key, matched by SHA-256 against Specialist.accessKeyHash → `doctor` scope
 * - DOCTOR_ACCESS_KEY → `admin` scope, which still sees every booking
 *
 * Fails closed: an empty header, an unknown key, or a deactivated specialist is a 401, and an
 * unset DOCTOR_ACCESS_KEY simply means no key can claim admin scope.
 */
async function requireDoctorAccess(req: Request, _res: Response, next: NextFunction) {
  try {
    const provided = (req.get('x-doctor-key') ?? '').trim();
    if (!provided) {
      throw new HttpError(401, 'Invalid or missing doctor access key.');
    }

    if (DOCTOR_ACCESS_KEY && timingSafeEquals(provided, DOCTOR_ACCESS_KEY)) {
      doctorIdentities.set(req, {
        scope: 'admin',
        specialistId: null,
        specialistKey: null,
        specialistName: null,
      });
      req.log = req.log.child({ doctorScope: 'admin' });
      next();
      return;
    }

    const specialist = await prisma.specialist.findUnique({
      where: { accessKeyHash: hashDoctorAccessKey(provided) },
      select: { id: true, key: true, name: true, active: true },
    });

    if (!specialist || !specialist.active) {
      throw new HttpError(401, 'Invalid or missing doctor access key.');
    }

    doctorIdentities.set(req, {
      scope: 'doctor',
      specialistId: specialist.id,
      specialistKey: specialist.key,
      specialistName: specialist.name,
    });

    req.log = req.log.child({ doctorScope: 'doctor', specialistKey: specialist.key });

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
    phone: string;
  };
  slot: {
    endsAt: Date;
  } | null;
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
      user: { select: { id: true, name: true, phone: true } },
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

/**
 * Tells the asker her question came back. The push flows one way only — the doctor who answered
 * never learns who was notified.
 */
async function notifyAskerQuestionAnswered(userId: string, doctorName: string) {
  const rows: Array<{ token: string }> = await prisma.fcmToken.findMany({
    where: { userId, status: 'ACTIVE' },
    select: { token: true },
  });
  const tokens: string[] = [...new Set(rows.map((row) => row.token))];

  if (tokens.length === 0) {
    return;
  }

  try {
    await sendPushToAllTokens(
      tokens,
      {
        title: 'A specialist answered you',
        body: `${doctorName} replied to your anonymous question.`,
      },
      {
        url: '/qa',
        type: 'anonymous-qa-answer',
      },
    );
    logger.info({ userId, tokens: tokens.length, type: 'anonymous-qa-answer' }, 'Push sent');
  } catch (error) {
    logger.error(
      { err: error, userId, tokens: tokens.length },
      'Unable to send anonymous Q&A push notification',
    );
  }
}

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

type MyConsultationRow = {
  id: string;
  scheduledAt: Date;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled';
  isFree: boolean;
  specialist: { key: string; name: string; role: string | null; imageUrl: string | null };
  slot: { endsAt: Date } | null;
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

app.get('/consultations/specialists', async (_req, res, next) => {
  try {
    await readyBookingCatalog();

    const specialists = await prisma.specialist.findMany({
      where: { active: true },
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
        specialistKey: slot.specialist.key,
        specialistName: slot.specialist.name,
        startsAt: slot.startsAt.toISOString(),
        endsAt: slot.endsAt.toISOString(),
      };
    });

    res.json(consultationBookingResponseSchema.parse(booked));
  } catch (e) {
    next(e);
  }
});

/** Tells the portal whose bookings it is about to show, and whether the key is even valid. */
app.get('/doctor/me', (req, res, next) => {
  try {
    const identity = requireDoctorIdentity(req);

    res.json(
      doctorIdentityResponseSchema.parse({
        scope: identity.scope,
        specialistKey: identity.specialistKey,
        specialistName: identity.specialistName,
      }),
    );
  } catch (e) {
    next(e);
  }
});

/**
 * Mints a personal portal key for one specialist, admin key only. The plaintext is returned
 * once and never stored, so a lost key is replaced by rotating again — which also invalidates
 * the previous one, since a specialist holds a single hash.
 */
app.post('/doctor/specialists/:key/access-key', async (req, res, next) => {
  try {
    const identity = requireDoctorIdentity(req);
    if (identity.scope !== 'admin') {
      throw new HttpError(403, 'Only the admin access key can rotate doctor access keys.');
    }

    await readyBookingCatalog();

    const specialist = await prisma.specialist.findUnique({
      where: { key: req.params.key },
      select: { id: true, key: true, name: true },
    });

    if (!specialist) {
      throw new HttpError(404, 'Specialist not found.');
    }

    const accessKey = crypto.randomBytes(32).toString('hex');

    await prisma.specialist.update({
      where: { id: specialist.id },
      data: {
        accessKeyHash: hashDoctorAccessKey(accessKey),
        accessKeyUpdatedAt: new Date(),
      },
    });

    res.json(
      doctorAccessKeyRotateResponseSchema.parse({
        specialistKey: specialist.key,
        specialistName: specialist.name,
        accessKey,
      }),
    );
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
        user: {
          select: {
            id: true,
            name: true,
            phone: true,
          },
        },
        slot: {
          select: {
            endsAt: true,
          },
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
          patientPhone: booking.user.phone,
          scheduledAt: booking.scheduledAt.toISOString(),
          endsAt: booking.slot?.endsAt.toISOString() ?? null,
          status: booking.status,
          isFree: booking.isFree,
          createdAt: booking.createdAt.toISOString(),
          callStatus: booking.call?.status ?? null,
          recordingStatus: aggregateRecording(booking.call?.recordings)?.status ?? null,
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
      name: user.name || user.phone,
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

    const startOfToday = startOfDay(now);
    const todayState = await prisma.nudgeDailyState.findUnique({
      where: { userId_date: { userId: user.id, date: startOfToday } },
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
      where: { userId_date: { userId: user.id, date: startOfToday } },
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
  const [settings, periods] = await Promise.all([
    prisma.cycleSettings.findUnique({ where: { userId } }),
    prisma.periodLog.findMany({
      where: { userId },
      orderBy: { startDate: 'desc' },
      take: 12,
    }),
  ]);
  return { settings, periods };
}

function serializePeriodLog(p: { id: string; startDate: Date; endDate: Date | null }) {
  return {
    id: p.id,
    startDate: p.startDate.toISOString().split('T')[0]!,
    endDate: p.endDate ? p.endDate.toISOString().split('T')[0]! : null,
  };
}

app.get('/cycle', async (req, res, next) => {
  try {
    const user = await requireCurrentUser(req);
    const { settings, periods } = await getCycleData(user.id);
    const cycleLength = settings?.cycleLength ?? 28;
    const periodLength = settings?.periodLength ?? 5;
    const serializedPeriods = periods.map(serializePeriodLog);
    const avgPeriodLength = computeAvgPeriodLength(serializedPeriods);
    const computed = computeCycleState(serializedPeriods, cycleLength, avgPeriodLength ?? periodLength);
    res.json(
      cycleStateResponseSchema.parse({
        settings: settings ? { cycleLength: settings.cycleLength, periodLength: settings.periodLength } : null,
        ...computed,
        avgPeriodLength,
        recentPeriods: serializedPeriods,
      }),
    );
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

    const { settings, periods } = await getCycleData(user.id);
    const serializedPeriods = periods.map(serializePeriodLog);
    const avgPeriodLength = computeAvgPeriodLength(serializedPeriods);
    const computed = computeCycleState(serializedPeriods, settings!.cycleLength, avgPeriodLength ?? settings!.periodLength);
    res.status(201).json(
      cycleStateResponseSchema.parse({
        settings: { cycleLength: settings!.cycleLength, periodLength: settings!.periodLength },
        ...computed,
        avgPeriodLength,
        recentPeriods: serializedPeriods,
      }),
    );
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
    const log = await prisma.periodLog.upsert({
      where: { userId_startDate: { userId: user.id, startDate: new Date(startDate) } },
      create: { userId: user.id, startDate: new Date(startDate) },
      update: {},
    });
    res.status(201).json(serializePeriodLog(log));
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
    const updated = await prisma.periodLog.update({
      where: { id },
      data: { endDate: new Date(endDate) },
    });
    res.json(serializePeriodLog(updated));
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
    const anchor = user.subscription?.startedAt ?? user.createdAt;
    const report = await buildSummary(user.id, anchor, period, offset);
    res.json(weeklyReportResponseSchema.parse(report));
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
    await prisma.quickSymptomLog.create({
      data: {
        userId: user.id,
        symptom,
        ...(loggedAt ? { loggedAt: new Date(loggedAt) } : {}),
      },
    });
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

async function upsertDetailedAnswers(userId: string, answers: { questionKey: string; value: string }[]) {
  const assessment = await prisma.detailedAssessment.upsert({
    where: { userId },
    create: { userId },
    update: {},
    select: { id: true },
  });

  const valid = filterValidAnswers(answers);
  if (valid.length > 0) {
    await prisma.$transaction(
      valid.map((answer) =>
        prisma.detailedAnswer.upsert({
          where: { assessmentId_questionKey: { assessmentId: assessment.id, questionKey: answer.questionKey } },
          create: { assessmentId: assessment.id, questionKey: answer.questionKey, value: answer.value },
          update: { value: answer.value },
        }),
      ),
    );
  }

  return assessment.id;
}

app.get('/detailed-assessment', async (req, res, next) => {
  try {
    const user = await requireCurrentUser(req);
    const assessment = await prisma.detailedAssessment.findUnique({
      where: { userId: user.id },
      select: { status: true, completedAt: true, answers: { select: { questionKey: true, value: true } } },
    });
    res.json(serializeDetailedAssessment(assessment));
  } catch (e) {
    next(e);
  }
});

app.put('/detailed-assessment', async (req, res, next) => {
  try {
    const user = await requireCurrentUser(req);
    const { answers } = saveDetailedAssessmentBodySchema.parse(req.body);
    await upsertDetailedAnswers(user.id, answers);
    const assessment = await prisma.detailedAssessment.findUnique({
      where: { userId: user.id },
      select: { status: true, completedAt: true, answers: { select: { questionKey: true, value: true } } },
    });
    res.json(serializeDetailedAssessment(assessment));
  } catch (e) {
    next(e);
  }
});

app.post('/detailed-assessment/submit', async (req, res, next) => {
  try {
    const user = await requireCurrentUser(req);
    const { answers } = submitDetailedAssessmentBodySchema.parse(req.body);
    await upsertDetailedAnswers(user.id, answers);
    await prisma.detailedAssessment.update({
      where: { userId: user.id },
      data: { status: 'completed', completedAt: new Date() },
    });
    const assessment = await prisma.detailedAssessment.findUnique({
      where: { userId: user.id },
      select: { status: true, completedAt: true, answers: { select: { questionKey: true, value: true } } },
    });
    res.json(serializeDetailedAssessment(assessment));
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

    if (err instanceof HttpError) {
      req.log.warn({ status: err.status }, `Request rejected: ${err.message}`);
      res.status(err.status).json({ error: err.message });
      return;
    }

    req.log.error({ err }, 'Unhandled error');
    res.status(500).json({ error: 'Internal server error' });
  }
);

async function startServer() {
  await readyBookingCatalog();

  startNudgeScheduler();

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
