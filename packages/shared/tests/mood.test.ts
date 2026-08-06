import { describe, expect, it } from 'vitest';
import {
  logMoodBodySchema,
  moodEmotionSchema,
  moodFeelingSchema,
  moodLogSchema,
  moodStateResponseSchema,
} from '../src/mood.js';

const iso = '2026-03-15T08:00:00.000Z';

describe('moodFeelingSchema', () => {
  it('accepts 1–5 integers', () => {
    expect(moodFeelingSchema.parse(1)).toBe(1);
    expect(moodFeelingSchema.parse(5)).toBe(5);
  });

  it('rejects out of range and non-integers', () => {
    expect(moodFeelingSchema.safeParse(0).success).toBe(false);
    expect(moodFeelingSchema.safeParse(6).success).toBe(false);
    expect(moodFeelingSchema.safeParse(2.5).success).toBe(false);
  });
});

describe('moodEmotionSchema', () => {
  it('accepts known emotions', () => {
    expect(moodEmotionSchema.parse('calm')).toBe('calm');
    expect(moodEmotionSchema.parse('overwhelmed')).toBe('overwhelmed');
  });

  it('rejects unknown emotion', () => {
    expect(moodEmotionSchema.safeParse('happy').success).toBe(false);
  });
});

describe('logMoodBodySchema', () => {
  it('accepts feeling-only and defaults emotions', () => {
    expect(logMoodBodySchema.parse({ feeling: 3 })).toEqual({ feeling: 3, emotions: [] });
  });

  it('accepts emotions and loggedAt', () => {
    expect(
      logMoodBodySchema.parse({
        feeling: 4,
        emotions: ['anxious', 'foggy'],
        loggedAt: iso,
      }),
    ).toMatchObject({ feeling: 4, emotions: ['anxious', 'foggy'], loggedAt: iso });
  });

  it('rejects too many emotions and bad loggedAt', () => {
    expect(
      logMoodBodySchema.safeParse({
        feeling: 2,
        emotions: [
          'calm',
          'energized',
          'anxious',
          'irritable',
          'sad',
          'tearful',
          'foggy',
          'overwhelmed',
          'calm',
        ],
      }).success,
    ).toBe(false);
    expect(
      logMoodBodySchema.safeParse({ feeling: 3, loggedAt: '2026-03-15' }).success,
    ).toBe(false);
  });
});

describe('moodLogSchema / moodStateResponseSchema', () => {
  it('accepts log and state fixtures', () => {
    const log = {
      id: 'mood_1',
      feeling: 3,
      emotions: ['calm' as const],
      loggedAt: iso,
    };
    expect(moodLogSchema.parse(log)).toEqual(log);
    expect(moodStateResponseSchema.parse({ today: log, recent: [log] })).toMatchObject({
      today: { id: 'mood_1' },
    });
    expect(moodStateResponseSchema.parse({ today: null, recent: [] })).toMatchObject({
      today: null,
      recent: [],
    });
  });

  it('rejects invalid emotion in log', () => {
    expect(
      moodLogSchema.safeParse({
        id: 'mood_1',
        feeling: 3,
        emotions: ['excited'],
        loggedAt: iso,
      }).success,
    ).toBe(false);
  });
});
