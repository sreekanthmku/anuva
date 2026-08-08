import crypto from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(crypto.scrypt) as (
  password: crypto.BinaryLike,
  salt: crypto.BinaryLike,
  keylen: number,
  options: crypto.ScryptOptions,
) => Promise<Buffer>;

/**
 * Doctor portal passwords are human-chosen, so they get a slow KDF rather than the plain SHA-256
 * used for high-entropy session tokens. scrypt ships with Node, which keeps this dependency-free.
 *
 * Stored as `scrypt$N$r$p$saltHex$keyHex` so the parameters travel with the hash and can be
 * raised later without invalidating everyone's password.
 */
const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const SCRYPT_KEYLEN = 64;
const SALT_BYTES = 16;

// scrypt needs roughly 128 * N * r bytes; the default 32 MB cap is exactly at the limit for
// N=16384, r=8, so it is raised explicitly rather than left to trip on some Node versions.
const SCRYPT_MAXMEM = 64 * 1024 * 1024;

export async function hashDoctorPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(SALT_BYTES);
  const derived = await scrypt(password.normalize('NFKC'), salt, SCRYPT_KEYLEN, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
    maxmem: SCRYPT_MAXMEM,
  });

  return [
    'scrypt',
    SCRYPT_N,
    SCRYPT_R,
    SCRYPT_P,
    salt.toString('hex'),
    derived.toString('hex'),
  ].join('$');
}

/**
 * Constant-time within a given stored hash. A malformed or unknown-scheme hash verifies as false
 * rather than throwing, so a corrupt row is a failed login and not a 500.
 */
export async function verifyDoctorPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') {
    return false;
  }

  const [, rawN, rawR, rawP, saltHex = '', keyHex = ''] = parts;
  const N = Number(rawN);
  const r = Number(rawR);
  const p = Number(rawP);
  if (!Number.isInteger(N) || !Number.isInteger(r) || !Number.isInteger(p)) {
    return false;
  }

  let expected: Buffer;
  let salt: Buffer;
  try {
    expected = Buffer.from(keyHex, 'hex');
    salt = Buffer.from(saltHex, 'hex');
  } catch {
    return false;
  }

  if (expected.length === 0 || salt.length === 0) {
    return false;
  }

  const derived = await scrypt(password.normalize('NFKC'), salt, expected.length, {
    N,
    r,
    p,
    maxmem: SCRYPT_MAXMEM,
  });

  return crypto.timingSafeEqual(derived, expected);
}

/**
 * Verified against when the username is unknown, so a missing account costs the same scrypt work
 * as a real one and cannot be distinguished by response time. Well-formed on purpose; the key is
 * fixed nonsense and matches nothing.
 */
export const DUMMY_DOCTOR_PASSWORD_HASH = [
  'scrypt',
  SCRYPT_N,
  SCRYPT_R,
  SCRYPT_P,
  '00'.repeat(SALT_BYTES),
  'ff'.repeat(SCRYPT_KEYLEN),
].join('$');

/** Usernames are stored and compared lowercased, so `Kekin` and `kekin` are the same login. */
export function normaliseDoctorUsername(username: string): string {
  return username.trim().toLowerCase();
}

/**
 * Login throttle. In-memory and therefore per-instance — enough to stop credential stuffing from
 * a single client, not a substitute for a WAF. Keyed by username so a distributed attack cannot
 * dodge it by rotating IPs, and the window slides forward on every failure.
 */
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_FAILURES = 8;

type Attempt = { failures: number; firstFailedAt: number; lockedUntil: number };

const loginAttempts = new Map<string, Attempt>();

function pruneAttempts(now: number): void {
  for (const [key, attempt] of loginAttempts) {
    if (attempt.lockedUntil <= now && now - attempt.firstFailedAt > LOGIN_WINDOW_MS) {
      loginAttempts.delete(key);
    }
  }
}

/** Seconds left on the lockout, or 0 when the caller may attempt a login. */
export function doctorLoginLockoutSeconds(username: string, now = Date.now()): number {
  const attempt = loginAttempts.get(normaliseDoctorUsername(username));
  if (!attempt || attempt.lockedUntil <= now) {
    return 0;
  }

  return Math.ceil((attempt.lockedUntil - now) / 1000);
}

export function recordDoctorLoginFailure(username: string, now = Date.now()): void {
  pruneAttempts(now);

  const key = normaliseDoctorUsername(username);
  const existing = loginAttempts.get(key);
  const withinWindow = existing && now - existing.firstFailedAt <= LOGIN_WINDOW_MS;

  const attempt: Attempt = withinWindow
    ? { ...existing, failures: existing.failures + 1 }
    : { failures: 1, firstFailedAt: now, lockedUntil: 0 };

  if (attempt.failures >= LOGIN_MAX_FAILURES) {
    attempt.lockedUntil = now + LOGIN_WINDOW_MS;
  }

  loginAttempts.set(key, attempt);
}

export function clearDoctorLoginFailures(username: string): void {
  loginAttempts.delete(normaliseDoctorUsername(username));
}

/** Test hook — the throttle is module state and would otherwise leak between cases. */
export function resetDoctorLoginThrottle(): void {
  loginAttempts.clear();
}
