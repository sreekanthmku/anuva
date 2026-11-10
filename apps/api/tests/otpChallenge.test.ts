/**
 * A second submit of a spent OTP challenge: an expired code must keep saying "expired" and a locked
 * one "too many attempts", not "already used" — the login, sign-up and privacy-confirm screens show
 * this text as-is.
 */

import { describe, expect, it } from 'vitest';
import englishBundle from '../src/i18n/locales/en.json' with { type: 'json' };
import { translateMessage, withLanguage } from '../src/i18n/index.js';
import {
  OTP_ALREADY_USED_MESSAGE,
  OTP_EXPIRED_MESSAGE,
  OTP_TOO_MANY_ATTEMPTS_MESSAGE,
  spentChallengeRejection,
} from '../src/otpChallenge.js';

describe('spentChallengeRejection', () => {
  it('keeps telling an expired code it has expired', () => {
    expect(spentChallengeRejection('expired')).toEqual({ status: 400, message: OTP_EXPIRED_MESSAGE });
  });

  it('keeps telling a locked code there were too many attempts', () => {
    expect(spentChallengeRejection('failed')).toEqual({ status: 429, message: OTP_TOO_MANY_ATTEMPTS_MESSAGE });
  });

  it('says "already used" only for a code that was verified', () => {
    expect(spentChallengeRejection('verified')).toEqual({ status: 400, message: OTP_ALREADY_USED_MESSAGE });
  });

  it.each([OTP_EXPIRED_MESSAGE, OTP_TOO_MANY_ATTEMPTS_MESSAGE, OTP_ALREADY_USED_MESSAGE])(
    'has a translation for "%s"',
    (message) => {
      // Translation is looked up by the exact English text, so a drifted string goes out untranslated.
      expect(Object.values(englishBundle.errors)).toContain(message);
      expect(withLanguage('hi', () => translateMessage(message))).not.toBe(message);
    },
  );
});
