// What to tell someone whose OTP challenge is no longer pending.
//
// A challenge leaves `pending` three ways: verified, expired, or locked after too many wrong codes.
// The first submit that finds it expired or locked says so; this keeps every later submit of the
// same challenge saying the same thing, instead of claiming a code that never worked was "used".
//
// The messages are matched by their English text against the `errors` bundle for translation, so
// they must stay identical to the entries in `i18n/locales/en.json`.

export const OTP_EXPIRED_MESSAGE = 'This OTP has expired. Please request a new one.';
export const OTP_TOO_MANY_ATTEMPTS_MESSAGE = 'Too many incorrect OTP attempts. Please request a new OTP.';
export const OTP_ALREADY_USED_MESSAGE = 'This OTP has already been used. Please request a new one.';

/** Mirrors the `OtpChallengeStatus` enum in schema.prisma. */
export type OtpChallengeStatus = 'pending' | 'verified' | 'expired' | 'failed';

export function spentChallengeRejection(status: Exclude<OtpChallengeStatus, 'pending'>): {
  status: number;
  message: string;
} {
  switch (status) {
    case 'expired':
      return { status: 400, message: OTP_EXPIRED_MESSAGE };
    case 'failed':
      return { status: 429, message: OTP_TOO_MANY_ATTEMPTS_MESSAGE };
    default:
      return { status: 400, message: OTP_ALREADY_USED_MESSAGE };
  }
}
