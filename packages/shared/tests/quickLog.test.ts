import { describe, expect, it } from 'vitest';
import {
  logQuickSymptomBodySchema,
  logQuickSymptomResponseSchema,
  quickLogCountsSchema,
  quickLogStateResponseSchema,
  quickSymptomSchema,
} from '../src/quickLog.js';

const iso = '2026-03-15T12:00:00.000Z';

describe('quickSymptomSchema', () => {
  it('accepts known symptoms', () => {
    expect(quickSymptomSchema.parse('hot_flash')).toBe('hot_flash');
    expect(quickSymptomSchema.parse('irritability')).toBe('irritability');
  });

  it('rejects unknown symptom', () => {
    expect(quickSymptomSchema.safeParse('headache').success).toBe(false);
  });
});

describe('logQuickSymptomBodySchema', () => {
  it('accepts symptom-only payload', () => {
    expect(logQuickSymptomBodySchema.parse({ symptom: 'anxiety' })).toEqual({
      symptom: 'anxiety',
    });
  });

  it('accepts optional loggedAt', () => {
    expect(
      logQuickSymptomBodySchema.parse({ symptom: 'chills', loggedAt: iso }),
    ).toMatchObject({ symptom: 'chills', loggedAt: iso });
  });

  it('rejects bad symptom and non-datetime loggedAt', () => {
    expect(logQuickSymptomBodySchema.safeParse({ symptom: 'fatigue' }).success).toBe(false);
    expect(
      logQuickSymptomBodySchema.safeParse({ symptom: 'anxiety', loggedAt: 'noon' }).success,
    ).toBe(false);
  });
});

describe('quickLogCountsSchema / quickLogStateResponseSchema', () => {
  it('accepts counts and state', () => {
    const counts = { hot_flash: 2, anxiety: 1, chills: 0, irritability: 3 };
    expect(quickLogCountsSchema.parse(counts)).toEqual(counts);
    expect(quickLogStateResponseSchema.parse({ counts })).toEqual({ counts });
  });

  it('rejects missing count keys', () => {
    expect(
      quickLogCountsSchema.safeParse({ hot_flash: 1, anxiety: 0, chills: 0 }).success,
    ).toBe(false);
  });
});

describe('logQuickSymptomResponseSchema', () => {
  it('accepts log response', () => {
    expect(
      logQuickSymptomResponseSchema.parse({
        symptom: 'hot_flash',
        todayCount: 2,
        message: 'Logged. You have had 2 hot flashes today.',
      }),
    ).toMatchObject({ todayCount: 2 });
  });

  it('rejects missing message', () => {
    expect(
      logQuickSymptomResponseSchema.safeParse({
        symptom: 'hot_flash',
        todayCount: 1,
      }).success,
    ).toBe(false);
  });
});
