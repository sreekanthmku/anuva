// Consent to collecting and processing her health information (DPDP Act 2023, s. 6). Asked on its
// own screen before the assessment, separate from the Terms, as the legal and compliance review
// recommends; existing accounts are asked on their next visit. Stored as a ConsentRecord with the
// version of the screen she saw, so a change of wording (a new HEALTH_DATA_CONSENT_VERSION) asks
// everyone again.
//
// Withdrawing it means no longer processing her health data, which is the whole app, so the screen
// tells her the way to withdraw is to delete her account from Privacy (that flow already exists).

import { prisma } from '@anuva/database';
import { HEALTH_DATA_CONSENT_VERSION } from '@anuva/shared';

export const HEALTH_DATA_CONSENT_REQUIRED_MESSAGE =
  'Please agree to how Anuva uses your health information to continue.';

export const HEALTH_DATA_CONSENT_STALE_MESSAGE =
  'This consent screen has been updated. Please reopen the app and agree to the latest version.';

/** Prisma `include` for the user loader: her open agreement to the current version, if any. */
export const healthDataConsentInclude = {
  where: {
    purpose: 'health_data_processing' as const,
    textVersion: HEALTH_DATA_CONSENT_VERSION,
    withdrawnAt: null,
  },
  select: { id: true },
  take: 1,
};

export function hasHealthDataConsent(consents: readonly unknown[] | undefined): boolean {
  return (consents?.length ?? 0) > 0;
}

/**
 * Records her agreement to `version`, which must be the current one: an app showing older wording
 * is refused rather than recorded against text she did not see. Agreeing twice is a no-op.
 */
export async function grantHealthDataConsent(userId: string, version: string): Promise<'granted' | 'stale'> {
  if (version !== HEALTH_DATA_CONSENT_VERSION) return 'stale';
  const open = await prisma.consentRecord.findFirst({
    where: { userId, ...healthDataConsentInclude.where },
    select: { id: true },
  });
  if (open) return 'granted';
  // An agreement to an older version is closed first, so exactly one row is ever open.
  await prisma.consentRecord.updateMany({
    where: { userId, purpose: 'health_data_processing', withdrawnAt: null },
    data: { withdrawnAt: new Date() },
  });
  await prisma.consentRecord.create({
    data: { userId, purpose: 'health_data_processing', textVersion: HEALTH_DATA_CONSENT_VERSION },
  });
  return 'granted';
}
