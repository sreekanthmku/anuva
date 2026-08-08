import { describe, expect, it } from 'vitest';
import {
  cancelConsultationResponseSchema,
  consultationBookingResponseSchema,
  consultationCallConsentBodySchema,
  consultationCallJoinResponseSchema,
  consultationCallStateSchema,
  consultationDocumentKindSchema,
  consultationDocumentSchema,
  consultationSlotSchema,
  consultationSlotsQuerySchema,
  consultationSlotsResponseSchema,
  consultationSpecialistSchema,
  consultationStatusSchema,
  createConsultationBookingBodySchema,
  createConsultationSlotsBodySchema,
  doctorConsultationBookingSchema,
  doctorIdentityResponseSchema,
  doctorLoginRequestSchema,
  doctorPasswordChangeRequestSchema,
  myConsultationSchema,
  myConsultationsResponseSchema,
  rescheduleConsultationBodySchema,
  uploadConsultationDocumentBodySchema,
} from '../src/booking.js';

const iso = '2026-04-01T09:00:00.000Z';
const isoEnd = '2026-04-01T09:30:00.000Z';

const specialist = {
  key: 'kekin-gala',
  name: 'Dr Kekin Gala',
  subtitle: 'Gynecologist',
  role: 'MD',
  specialization: 'Menopause care',
  summary: 'Specialist summary',
  experience: '15 years',
  tag: 'Popular',
  imageUrl: 'https://cdn.example.com/doc.jpg',
  qualifications: ['MD', 'DGO'],
  bookable: true,
  bookingDisabledReason: null,
};

const callState = {
  consultationId: 'con_1',
  roomName: 'room-1',
  status: 'waiting' as const,
  doctorStartedAt: null,
  patientJoinedAt: null,
  recordingStartedAt: null,
  endedAt: null,
  patientConsentRequired: true,
  patientConsented: false,
  recording: null,
};

const myConsultation = {
  consultationId: 'con_1',
  specialistKey: 'kekin-gala',
  specialistName: 'Dr Kekin Gala',
  specialistRole: 'Gynecologist',
  specialistImageUrl: null,
  scheduledAt: iso,
  endsAt: isoEnd,
  status: 'confirmed' as const,
  isFree: true,
  callStatus: 'waiting' as const,
  canCancel: true,
  canReschedule: true,
  canJoin: false,
  recordingAvailable: false,
  recordingStatus: null,
  recordingDurationSeconds: null,
  documentCount: 0,
};

describe('consultationStatusSchema', () => {
  it('accepts known statuses', () => {
    expect(consultationStatusSchema.parse('pending')).toBe('pending');
    expect(consultationStatusSchema.parse('cancelled')).toBe('cancelled');
  });

  it('rejects unknown status', () => {
    expect(consultationStatusSchema.safeParse('no-show').success).toBe(false);
  });
});

describe('consultationSpecialistSchema', () => {
  it('accepts a specialist fixture', () => {
    expect(consultationSpecialistSchema.parse(specialist)).toMatchObject({
      key: 'kekin-gala',
      bookable: true,
    });
  });

  it('rejects empty key', () => {
    expect(consultationSpecialistSchema.safeParse({ ...specialist, key: '' }).success).toBe(false);
  });
});

describe('consultationSlotsQuerySchema', () => {
  it('accepts valid query and coerces days', () => {
    expect(
      consultationSlotsQuerySchema.parse({
        specialistKey: 'kekin-gala',
        from: '2026-04-01',
        days: '7',
      }),
    ).toEqual({ specialistKey: 'kekin-gala', from: '2026-04-01', days: 7 });
  });

  it('rejects bad date format', () => {
    expect(
      consultationSlotsQuerySchema.safeParse({
        specialistKey: 'kekin-gala',
        from: '01-04-2026',
        days: 7,
      }).success,
    ).toBe(false);
  });

  it('rejects days out of range', () => {
    expect(
      consultationSlotsQuerySchema.safeParse({
        specialistKey: 'kekin-gala',
        from: '2026-04-01',
        days: 0,
      }).success,
    ).toBe(false);
    expect(
      consultationSlotsQuerySchema.safeParse({
        specialistKey: 'kekin-gala',
        from: '2026-04-01',
        days: 32,
      }).success,
    ).toBe(false);
  });
});

describe('consultationSlotSchema / consultationSlotsResponseSchema', () => {
  it('accepts slot and slots response', () => {
    const slot = { id: 'slot_1', startsAt: iso, endsAt: isoEnd };
    expect(consultationSlotSchema.parse(slot)).toEqual(slot);
    expect(
      consultationSlotsResponseSchema.parse({
        specialistKey: 'kekin-gala',
        from: '2026-04-01',
        days: 7,
        dates: [{ date: '2026-04-01', slots: [slot] }],
      }),
    ).toMatchObject({ days: 7 });
  });

  it('rejects non-datetime startsAt', () => {
    expect(
      consultationSlotSchema.safeParse({
        id: 'slot_1',
        startsAt: '2026-04-01 09:00',
        endsAt: isoEnd,
      }).success,
    ).toBe(false);
  });
});

describe('createConsultationBookingBodySchema', () => {
  it('accepts slotId', () => {
    expect(createConsultationBookingBodySchema.parse({ slotId: 'slot_1' })).toEqual({
      slotId: 'slot_1',
    });
  });

  it('rejects empty slotId', () => {
    expect(createConsultationBookingBodySchema.safeParse({ slotId: '' }).success).toBe(false);
  });
});

describe('consultationBookingResponseSchema', () => {
  it('accepts booking response', () => {
    expect(
      consultationBookingResponseSchema.parse({
        consultationId: 'con_1',
        specialistKey: 'kekin-gala',
        specialistName: 'Dr Kekin Gala',
        startsAt: iso,
        endsAt: isoEnd,
      }),
    ).toMatchObject({ consultationId: 'con_1' });
  });

  it('rejects missing specialistName', () => {
    expect(
      consultationBookingResponseSchema.safeParse({
        consultationId: 'con_1',
        specialistKey: 'kekin-gala',
        startsAt: iso,
        endsAt: isoEnd,
      }).success,
    ).toBe(false);
  });
});

describe('doctorIdentityResponseSchema', () => {
  it('accepts admin and doctor scopes', () => {
    expect(
      doctorIdentityResponseSchema.parse({
        scope: 'admin',
        username: 'ops',
        specialistKey: null,
        specialistName: null,
      }),
    ).toMatchObject({ scope: 'admin' });
    expect(
      doctorIdentityResponseSchema.parse({
        scope: 'doctor',
        username: 'kekin',
        specialistKey: 'kekin-gala',
        specialistName: 'Dr Kekin Gala',
      }),
    ).toMatchObject({ scope: 'doctor' });
  });

  it('rejects unknown scope', () => {
    expect(
      doctorIdentityResponseSchema.safeParse({
        scope: 'nurse',
        username: 'ops',
        specialistKey: null,
        specialistName: null,
      }).success,
    ).toBe(false);
  });
});

describe('doctorLoginRequestSchema', () => {
  it('trims the username and keeps the password verbatim', () => {
    expect(doctorLoginRequestSchema.parse({ username: '  kekin ', password: ' pw ' })).toEqual({
      username: 'kekin',
      password: ' pw ',
    });
  });

  it('rejects usernames with spaces or symbols', () => {
    expect(doctorLoginRequestSchema.safeParse({ username: 'ke kin', password: 'pw' }).success).toBe(
      false,
    );
    expect(doctorLoginRequestSchema.safeParse({ username: 'ke@kin', password: 'pw' }).success).toBe(
      false,
    );
  });

  it('accepts a short password, so an old one can still sign in', () => {
    expect(doctorLoginRequestSchema.safeParse({ username: 'kekin', password: 'a' }).success).toBe(
      true,
    );
  });

  it('rejects an empty password', () => {
    expect(doctorLoginRequestSchema.safeParse({ username: 'kekin', password: '' }).success).toBe(
      false,
    );
  });
});

describe('doctorPasswordChangeRequestSchema', () => {
  it('enforces the minimum length on the new password only', () => {
    expect(
      doctorPasswordChangeRequestSchema.safeParse({
        currentPassword: 'short',
        newPassword: 'a-long-enough-one',
      }).success,
    ).toBe(true);
    expect(
      doctorPasswordChangeRequestSchema.safeParse({
        currentPassword: 'a-long-enough-one',
        newPassword: 'too-short',
      }).success,
    ).toBe(false);
  });
});

describe('doctorConsultationBookingSchema', () => {
  it('accepts doctor booking row', () => {
    expect(
      doctorConsultationBookingSchema.parse({
        consultationId: 'con_1',
        specialistKey: 'kekin-gala',
        specialistName: 'Dr Kekin Gala',
        patientId: 'usr_1',
        patientName: 'Priya',
        patientPhone: '+919876543210',
        scheduledAt: iso,
        endsAt: isoEnd,
        status: 'confirmed',
        isFree: false,
        createdAt: iso,
        callStatus: null,
        recordingStatus: null,
        documentCount: 2,
      }),
    ).toMatchObject({ documentCount: 2 });
  });

  it('rejects negative documentCount', () => {
    expect(
      doctorConsultationBookingSchema.safeParse({
        consultationId: 'con_1',
        specialistKey: 'kekin-gala',
        specialistName: 'Dr Kekin Gala',
        patientId: 'usr_1',
        patientName: null,
        patientPhone: '+919876543210',
        scheduledAt: iso,
        endsAt: null,
        status: 'pending',
        isFree: true,
        createdAt: iso,
        callStatus: null,
        recordingStatus: null,
        documentCount: -1,
      }).success,
    ).toBe(false);
  });
});

describe('consultationCallStateSchema / join response', () => {
  it('accepts call state and join payload', () => {
    expect(consultationCallStateSchema.parse(callState)).toMatchObject({
      consultationId: 'con_1',
      status: 'waiting',
    });
    expect(
      consultationCallJoinResponseSchema.parse({
        livekitUrl: 'https://livekit.example.com',
        token: 'tok_abc',
        call: callState,
      }),
    ).toMatchObject({ token: 'tok_abc' });
  });

  it('rejects non-url livekitUrl', () => {
    expect(
      consultationCallJoinResponseSchema.safeParse({
        livekitUrl: 'not-a-url',
        token: 'tok_abc',
        call: callState,
      }).success,
    ).toBe(false);
  });
});

describe('consultationCallConsentBodySchema', () => {
  it('applies default consent version when omitted', () => {
    expect(consultationCallConsentBodySchema.parse({})).toEqual({
      consentTextVersion: 'recording-consent-v1',
    });
  });

  it('rejects blank consentTextVersion', () => {
    expect(
      consultationCallConsentBodySchema.safeParse({ consentTextVersion: '   ' }).success,
    ).toBe(false);
  });
});

describe('createConsultationSlotsBodySchema', () => {
  it('accepts one or more slots', () => {
    expect(
      createConsultationSlotsBodySchema.parse({
        specialistKey: 'kekin-gala',
        slots: [{ startsAt: iso, endsAt: isoEnd }],
      }),
    ).toMatchObject({ specialistKey: 'kekin-gala' });
  });

  it('rejects empty slots array', () => {
    expect(
      createConsultationSlotsBodySchema.safeParse({
        specialistKey: 'kekin-gala',
        slots: [],
      }).success,
    ).toBe(false);
  });
});

describe('myConsultationSchema / myConsultationsResponseSchema', () => {
  it('accepts patient booking lists', () => {
    expect(myConsultationSchema.parse(myConsultation)).toMatchObject({ canJoin: false });
    expect(
      myConsultationsResponseSchema.parse({ upcoming: [myConsultation], past: [] }),
    ).toMatchObject({ upcoming: [expect.objectContaining({ consultationId: 'con_1' })], past: [] });
  });

  it('rejects unknown status on my consultation', () => {
    expect(
      myConsultationSchema.safeParse({ ...myConsultation, status: 'rescheduled' }).success,
    ).toBe(false);
  });
});

describe('cancel / reschedule schemas', () => {
  it('accepts cancel response and reschedule body', () => {
    expect(
      cancelConsultationResponseSchema.parse({ ok: true, consultation: myConsultation }),
    ).toMatchObject({ ok: true });
    expect(rescheduleConsultationBodySchema.parse({ slotId: 'slot_2' })).toEqual({
      slotId: 'slot_2',
    });
  });

  it('rejects empty reschedule slotId', () => {
    expect(rescheduleConsultationBodySchema.safeParse({ slotId: '' }).success).toBe(false);
  });
});

describe('consultation documents', () => {
  it('accepts document kinds and document fixture', () => {
    expect(consultationDocumentKindSchema.parse('prescription')).toBe('prescription');
    expect(
      consultationDocumentSchema.parse({
        id: 'doc_1',
        consultationId: 'con_1',
        kind: 'diet_plan',
        title: 'Week 1 plan',
        originalName: 'diet.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 2048,
        uploadedByName: 'Dr Kekin Gala',
        createdAt: iso,
      }),
    ).toMatchObject({ kind: 'diet_plan', sizeBytes: 2048 });
  });

  it('accepts upload body with optional title', () => {
    expect(uploadConsultationDocumentBodySchema.parse({ kind: 'other' })).toEqual({
      kind: 'other',
    });
    expect(
      uploadConsultationDocumentBodySchema.parse({ kind: 'prescription', title: 'Rx' }),
    ).toMatchObject({ title: 'Rx' });
  });

  it('rejects invalid kind and overlong title', () => {
    expect(consultationDocumentKindSchema.safeParse('lab_report').success).toBe(false);
    expect(
      uploadConsultationDocumentBodySchema.safeParse({
        kind: 'prescription',
        title: 'x'.repeat(121),
      }).success,
    ).toBe(false);
  });
});
