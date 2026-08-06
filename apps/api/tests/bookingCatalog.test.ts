import { describe, expect, it } from 'vitest';
import { BOOKABLE_DOCTOR_KEYS } from '../src/bookingCatalog.js';

describe('BOOKABLE_DOCTOR_KEYS', () => {
  it('contains the expected bookable doctor keys', () => {
    expect(BOOKABLE_DOCTOR_KEYS).toBeInstanceOf(Set);
    expect(BOOKABLE_DOCTOR_KEYS.has('kekin-gala')).toBe(true);
    expect(BOOKABLE_DOCTOR_KEYS.has('rizwana-sayed')).toBe(true);
    expect(BOOKABLE_DOCTOR_KEYS.size).toBe(2);
  });

  it('does not include non-bookable specialist keys', () => {
    expect(BOOKABLE_DOCTOR_KEYS.has('jai-bapat')).toBe(false);
    expect(BOOKABLE_DOCTOR_KEYS.has('jigna-shah')).toBe(false);
  });
});

// ensureBookingCatalog intentionally not called — it seeds Prisma.
