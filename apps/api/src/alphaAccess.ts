// Alpha testing: while it is on, a new account needs one of the access codes handed out to testers,
// and the code is stored on the account so each code's sign-ups can be counted. Existing accounts
// sign in as before — the code is only ever checked on the call that creates an account.
//
//   ALPHA_TESTING_ENABLED=true            require a code to sign up (anything else: off)
//   ALPHA_CODES=ALPHASM,ALPHAWM,...       optional; the accepted codes, comma-separated
//
// Both are read once at startup, so changing either needs an API restart, not a rebuild: the PWA
// asks GET /auth/signup-config whether to show the field.

export const ALPHA_CODE_REQUIRED_MESSAGE = 'Please enter a valid alpha access code to sign up.';

/** The codes handed out for the first alpha round. ALPHA_CODES replaces the whole list. */
export const DEFAULT_ALPHA_CODES = ['ALPHASM', 'ALPHAWM', 'ALPHARD', 'ALPHAHM'] as const;

export type AlphaAccessConfig = {
  enabled: boolean;
  /** Normalised (upper-case, no spaces), in the order given. */
  codes: readonly string[];
};

/** Upper-cased with all whitespace removed, so "alpha sm " matches ALPHASM. Empty → null. */
export function normalizeAlphaCode(raw: string | undefined | null): string | null {
  const code = (raw ?? '').replace(/\s+/g, '').toUpperCase();
  return code === '' ? null : code;
}

export function readAlphaAccessConfig(env: NodeJS.ProcessEnv = process.env): AlphaAccessConfig {
  const fromEnv = (env.ALPHA_CODES ?? '')
    .split(',')
    .map(normalizeAlphaCode)
    .filter((code): code is string => code !== null);

  return {
    enabled: env.ALPHA_TESTING_ENABLED?.trim().toLowerCase() === 'true',
    codes: [...new Set(fromEnv.length > 0 ? fromEnv : DEFAULT_ALPHA_CODES)],
  };
}

export type AlphaCodeResult = { ok: true; code: string | null } | { ok: false };

/**
 * The code to store on a new account. Off: nothing is required and nothing is stored, even if one
 * was sent. On: the code must be one of the configured ones, and is stored normalised.
 */
export function resolveAlphaCode(config: AlphaAccessConfig, raw: string | undefined): AlphaCodeResult {
  if (!config.enabled) return { ok: true, code: null };

  const code = normalizeAlphaCode(raw);
  return code !== null && config.codes.includes(code) ? { ok: true, code } : { ok: false };
}

// Alpha accounts cannot book a consultation until they are on a paid plan. Everyone starts on a
// 14-day trial (status 'trialing'), and a lapsed trial is not paid either, so in practice: booking
// opens once the subscription is 'active'. Enforced at POST /consultations/book, the one door every
// booking goes through (the booking screen and ANU's booking card alike); the app reads
// `consultationBookingLocked` off the user to grey the doctors out and say why.

export const CONSULTATION_BOOKING_LOCKED_MESSAGE = 'Subscribe to book a consultation.';

export function isConsultationBookingLocked(user: {
  alphaCode: string | null;
  subscriptionStatus: string | null;
}): boolean {
  return user.alphaCode !== null && user.subscriptionStatus !== 'active';
}
