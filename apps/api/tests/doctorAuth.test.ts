import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearDoctorLoginFailures,
  doctorLoginLockoutSeconds,
  DUMMY_DOCTOR_PASSWORD_HASH,
  hashDoctorPassword,
  normaliseDoctorUsername,
  recordDoctorLoginFailure,
  resetDoctorLoginThrottle,
  verifyDoctorPassword,
} from '../src/doctorAuth.js';

describe('doctor password hashing', () => {
  it('verifies the password it hashed', async () => {
    const hash = await hashDoctorPassword('correct horse battery');
    await expect(verifyDoctorPassword('correct horse battery', hash)).resolves.toBe(true);
  });

  it('rejects a wrong password', async () => {
    const hash = await hashDoctorPassword('correct horse battery');
    await expect(verifyDoctorPassword('correct horse batteru', hash)).resolves.toBe(false);
  });

  it('salts, so the same password hashes differently every time', async () => {
    const [a, b] = await Promise.all([
      hashDoctorPassword('same-password'),
      hashDoctorPassword('same-password'),
    ]);
    expect(a).not.toBe(b);
  });

  it('encodes its parameters in the stored value', async () => {
    const hash = await hashDoctorPassword('whatever-it-is');
    expect(hash.split('$').slice(0, 4)).toEqual(['scrypt', '16384', '8', '1']);
  });

  it('normalises unicode, so the same typed password verifies either way', async () => {
    // U+00E9 vs e + U+0301 — the same grapheme from two keyboards.
    const hash = await hashDoctorPassword('passé-word-long');
    await expect(verifyDoctorPassword('passé-word-long', hash)).resolves.toBe(true);
  });

  it('returns false rather than throwing on a malformed hash', async () => {
    await expect(verifyDoctorPassword('x', 'not-a-hash')).resolves.toBe(false);
    await expect(verifyDoctorPassword('x', 'bcrypt$1$2$3$aa$bb')).resolves.toBe(false);
    await expect(verifyDoctorPassword('x', 'scrypt$x$8$1$aa$bb')).resolves.toBe(false);
    await expect(verifyDoctorPassword('x', 'scrypt$16384$8$1$$')).resolves.toBe(false);
  });

  it('never matches the dummy hash used for unknown usernames', async () => {
    await expect(verifyDoctorPassword('', DUMMY_DOCTOR_PASSWORD_HASH)).resolves.toBe(false);
    await expect(verifyDoctorPassword('anything', DUMMY_DOCTOR_PASSWORD_HASH)).resolves.toBe(false);
  });
});

describe('normaliseDoctorUsername', () => {
  it('trims and lowercases', () => {
    expect(normaliseDoctorUsername('  Kekin.Gala ')).toBe('kekin.gala');
  });
});

describe('login throttle', () => {
  beforeEach(() => {
    resetDoctorLoginThrottle();
  });

  it('does not lock before the failure limit', () => {
    for (let i = 0; i < 7; i += 1) {
      recordDoctorLoginFailure('doc');
    }
    expect(doctorLoginLockoutSeconds('doc')).toBe(0);
  });

  it('locks the username once the limit is reached', () => {
    for (let i = 0; i < 8; i += 1) {
      recordDoctorLoginFailure('doc');
    }
    expect(doctorLoginLockoutSeconds('doc')).toBeGreaterThan(0);
  });

  it('is case-insensitive, so casing cannot dodge the lockout', () => {
    for (let i = 0; i < 8; i += 1) {
      recordDoctorLoginFailure('Doc');
    }
    expect(doctorLoginLockoutSeconds('doc')).toBeGreaterThan(0);
  });

  it('locks one username without touching another', () => {
    for (let i = 0; i < 8; i += 1) {
      recordDoctorLoginFailure('doc');
    }
    expect(doctorLoginLockoutSeconds('other')).toBe(0);
  });

  it('forgets failures older than the window', () => {
    const start = 1_000_000;
    for (let i = 0; i < 7; i += 1) {
      recordDoctorLoginFailure('doc', start);
    }
    // One more failure, but outside the 15 minute window — the count restarts at 1.
    recordDoctorLoginFailure('doc', start + 16 * 60 * 1000);
    expect(doctorLoginLockoutSeconds('doc', start + 16 * 60 * 1000)).toBe(0);
  });

  it('releases the lock once it expires', () => {
    const start = 1_000_000;
    for (let i = 0; i < 8; i += 1) {
      recordDoctorLoginFailure('doc', start);
    }
    expect(doctorLoginLockoutSeconds('doc', start)).toBeGreaterThan(0);
    expect(doctorLoginLockoutSeconds('doc', start + 16 * 60 * 1000)).toBe(0);
  });

  it('clears the record on a successful sign-in', () => {
    for (let i = 0; i < 8; i += 1) {
      recordDoctorLoginFailure('doc');
    }
    clearDoctorLoginFailures('doc');
    expect(doctorLoginLockoutSeconds('doc')).toBe(0);
  });
});
