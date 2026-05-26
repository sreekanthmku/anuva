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
  authSessionResponseSchema,
  authUserSchema,
  logoutResponseSchema,
  registerFcmBodySchema,
  registerFcmResponseSchema,
  requestOtpBodySchema,
  pushBroadcastResponseSchema,
  unregisterFcmBodySchema,
  unregisterFcmResponseSchema,
  requestOtpResponseSchema,
  verifyOtpBodySchema,
  type AuthUser,
} from '@anuva/shared';
import { ZodError } from 'zod';
import { sendPushToAllTokens } from './fcm.js';

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
const SESSION_COOKIE_SECURE = process.env.SESSION_COOKIE_SECURE === 'true';
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

function setSessionCookie(res: Response, token: string, expiresAt: Date): void {
  res.cookie(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: SESSION_COOKIE_SECURE,
    expires: expiresAt,
    path: '/',
  });
}

function clearSessionCookie(res: Response): void {
  res.clearCookie(SESSION_COOKIE_NAME, {
    httpOnly: true,
    sameSite: 'lax',
    secure: SESSION_COOKIE_SECURE,
    path: '/',
  });
}

function serializeUser(user: {
  id: string;
  phone: string;
  name: string | null;
  email: string | null;
  onboardingCompleted: boolean;
  phoneVerifiedAt: Date | null;
  createdAt: Date;
}): AuthUser {
  return authUserSchema.parse({
    id: user.id,
    phone: user.phone,
    name: user.name,
    email: user.email,
    onboardingCompleted: user.onboardingCompleted,
    phoneVerifiedAt: user.phoneVerifiedAt?.toISOString() ?? null,
    createdAt: user.createdAt.toISOString(),
  });
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
    include: { user: true },
  });

  if (!session || session.expiresAt <= new Date()) {
    throw new HttpError(401, 'Your session has expired. Please sign in again.');
  }

  await prisma.session.update({
    where: { id: session.id },
    data: { lastSeenAt: new Date() },
  });

  return session.user;
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

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

app.post('/auth/request-otp', async (req, res, next) => {
  try {
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

    res.json(authUserSchema.parse(serializeUser(updated)));
  } catch (e) {
    next(e);
  }
});

app.post('/auth/logout', async (req, res, next) => {
  try {
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

app.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
});
