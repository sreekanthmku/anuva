import { describe, expect, it } from 'vitest';
import {
  CLEARED_LOCK_STATE,
  DUMMY_DOCTOR_PASSWORD_HASH,
  hashDoctorPassword,
  LOGIN_LOCKOUT_MS,
  LOGIN_MAX_FAILURES,
  lockoutSecondsRemaining,
  nextFailureState,
  normaliseDoctorUsername,
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

describe('login lockout', () => {
  const NOW = 1_000_000;
  const fresh = { failedLoginCount: 0, lockedUntil: null };

  it('does not lock before the failure limit', () => {
    let state = fresh;
    for (let i = 0; i < LOGIN_MAX_FAILURES - 1; i += 1) {
      state = nextFailureState(state, NOW);
    }
    expect(state.failedLoginCount).toBe(LOGIN_MAX_FAILURES - 1);
    expect(state.lockedUntil).toBeNull();
    expect(lockoutSecondsRemaining(state, NOW)).toBe(0);
  });

  it('locks once the limit is reached', () => {
    let state = fresh;
    for (let i = 0; i < LOGIN_MAX_FAILURES; i += 1) {
      state = nextFailureState(state, NOW);
    }
    expect(state.lockedUntil).not.toBeNull();
    expect(lockoutSecondsRemaining(state, NOW)).toBe(LOGIN_LOCKOUT_MS / 1000);
  });

  it('reports no lockout once it has expired', () => {
    const state = { failedLoginCount: LOGIN_MAX_FAILURES, lockedUntil: new Date(NOW + 1000) };
    expect(lockoutSecondsRemaining(state, NOW)).toBe(1);
    expect(lockoutSecondsRemaining(state, NOW + 2000)).toBe(0);
  });

  it('starts a fresh count after a served lockout, so one late failure does not relock', () => {
    const served = {
      failedLoginCount: LOGIN_MAX_FAILURES,
      lockedUntil: new Date(NOW - 1),
    };
    const next = nextFailureState(served, NOW);
    expect(next.failedLoginCount).toBe(1);
    expect(next.lockedUntil).toBeNull();
  });

  it('keeps counting while the lockout is still standing', () => {
    const locked = {
      failedLoginCount: LOGIN_MAX_FAILURES,
      lockedUntil: new Date(NOW + LOGIN_LOCKOUT_MS),
    };
    const next = nextFailureState(locked, NOW);
    expect(next.failedLoginCount).toBe(LOGIN_MAX_FAILURES + 1);
    expect(next.lockedUntil).not.toBeNull();
  });

  it('clears both counters on a successful sign-in', () => {
    expect(CLEARED_LOCK_STATE).toEqual({ failedLoginCount: 0, lockedUntil: null });
    expect(lockoutSecondsRemaining(CLEARED_LOCK_STATE, NOW)).toBe(0);
  });
});
