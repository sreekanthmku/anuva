import { describe, expect, it } from 'vitest';
import { HEALTH_DATA_CONSENT_VERSION, authUserSchema, consultationSpecialistSchema } from '@anuva/shared';
import { hasHealthDataConsent, healthDataConsentInclude } from '../src/healthDataConsent.js';
import { DEFAULT_GRIEVANCE_EMAIL, readGrievanceOfficer } from '../src/grievanceOfficer.js';

// The legal and compliance review: health-data consent, practitioner registration, grievance officer.

describe('health-data consent', () => {
  it('counts only an open agreement to the current version', () => {
    expect(healthDataConsentInclude.where).toEqual({
      purpose: 'health_data_processing',
      textVersion: HEALTH_DATA_CONSENT_VERSION,
      withdrawnAt: null,
    });
    expect(hasHealthDataConsent([{ id: 'c1' }])).toBe(true);
    expect(hasHealthDataConsent([])).toBe(false);
    expect(hasHealthDataConsent(undefined)).toBe(false);
  });

  it('defaults to not given for a user cached before the field existed', () => {
    const cached = authUserSchema.parse({
      id: 'u1',
      phone: '+919876543210',
      name: 'Priya',
      email: null,
      onboardingCompleted: true,
      detailedAssessmentStatus: 'not_started',
      subscriptionPlan: null,
      subscriptionStatus: null,
      subscriptionStartedAt: null,
      trialEndsAt: null,
      renewsAt: null,
      hasActiveAccess: true,
      trialAvailable: false,
      requiresPayment: false,
      phoneVerifiedAt: null,
      report14OpenedAt: null,
      createdAt: new Date().toISOString(),
    });
    expect(cached.healthDataConsent).toBe(false);
  });
});

describe('specialist registration', () => {
  it('parses a specialist from an API that does not send registration yet', () => {
    const parsed = consultationSpecialistSchema.parse({
      key: 'kekin-gala',
      name: 'Dr. Kekin Gala',
      subtitle: null,
      role: null,
      specialization: null,
      summary: null,
      experience: null,
      tag: null,
      imageUrl: null,
      qualifications: [],
      bookable: false,
      bookingDisabledReason: 'Booking for this specialist is coming soon.',
    });
    expect(parsed.registrationNumber).toBeNull();
    expect(parsed.registrationCouncil).toBeNull();
  });
});

describe('grievance officer', () => {
  it('falls back to the published email, with no name until one is set', () => {
    expect(readGrievanceOfficer({})).toEqual({
      name: null,
      designation: null,
      email: DEFAULT_GRIEVANCE_EMAIL,
      phone: null,
      hours: null,
    });
  });

  it('reads and trims the configured officer, treating blanks as unset', () => {
    expect(
      readGrievanceOfficer({
        GRIEVANCE_OFFICER_NAME: ' Asha Rao ',
        GRIEVANCE_OFFICER_EMAIL: 'grievance@example.com',
        GRIEVANCE_OFFICER_PHONE: '  ',
      }),
    ).toMatchObject({ name: 'Asha Rao', email: 'grievance@example.com', phone: null });
  });
});
