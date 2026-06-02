import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.join(__dirname, '../../../.env') });

import cors from 'cors';
import express from 'express';
import type { Request, Response } from 'express';
import { prisma } from '@anuva/database';
import {
  activateOneDaySubscriptionResponseSchema,
  authSessionResponseSchema,
  authUserSchema,
  consultationBookingResponseSchema,
  consultationSlotsQuerySchema,
  consultationSlotsResponseSchema,
  consultationSpecialistsResponseSchema,
  createConsultationBookingBodySchema,
  createConsultationSlotsBodySchema,
  createConsultationSlotsResponseSchema,
  deleteConsultationSlotParamsSchema,
  deleteConsultationSlotResponseSchema,
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
  saveDetailedAssessmentBodySchema,
  submitDetailedAssessmentBodySchema,
  detailedAssessmentStateResponseSchema,
  detailedAssessmentQuestionKeys,
  type AuthUser,
} from '@anuva/shared';
import { ZodError } from 'zod';
import { BOOKABLE_DOCTOR_KEYS, ensureBookingCatalog } from './bookingCatalog.js';
import { sendPushToAllTokens } from './fcm.js';
import { computeAvgPeriodLength, computeCycleState } from './cycleCalc.js';

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

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

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

function isBookableDoctorKey(key: string): boolean {
  return BOOKABLE_DOCTOR_KEYS.has(key);
}

async function readyBookingCatalog() {
  await ensureBookingCatalog(prisma);
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
        specialists.map((specialist) => serializeSpecialist(specialist)),
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

    const booked = await prisma.$transaction(async (tx) => {
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

    const created = await prisma.consultationSlot.createMany({
      data,
      skipDuplicates: true,
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

    const rows = await prisma.fcmToken.findMany({
      where: { status: 'ACTIVE' },
      select: { token: true },
    });
    const tokens = [...new Set(rows.map((row) => row.token))];

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

app.use(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  (err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    if (err instanceof ZodError) {
      res.status(400).json({ error: 'Validation failed', issues: err.flatten() });
      return;
    }

    if (err instanceof HttpError) {
      res.status(err.status).json({ error: err.message });
      return;
    }

    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
);

async function startServer() {
  await readyBookingCatalog();

  app.listen(port, () => {
    console.log(`API listening on http://localhost:${port}`);
  });
}

startServer().catch((err) => {
  console.error(err);
  process.exit(1);
});
