import { describe, expect, it } from 'vitest';
import {
  logSleepBodySchema,
  sleepDisruptionSchema,
  sleepHoursBucketSchema,
  sleepLogSchema,
  sleepQualitySchema,
  sleepStateResponseSchema,
} from '../src/sleep.js';

const iso = '2026-03-15T07:00:00.000Z';

describe('sleepQualitySchema', () => {
  it('accepts 1–5 integers', () => {
    expect(sleepQualitySchema.parse(1)).toBe(1);
    expect(sleepQualitySchema.parse(5)).toBe(5);
  });

  it('rejects out of range', () => {
    expect(sleepQualitySchema.safeParse(0).success).toBe(false);
    expect(sleepQualitySchema.safeParse(6).success).toBe(false);
  });
});

describe('sleepHoursBucketSchema', () => {
  it('accepts known buckets', () => {
    expect(sleepHoursBucketSchema.parse('lt5')).toBe('lt5');
    expect(sleepHoursBucketSchema.parse('gt8')).toBe('gt8');
  });

  it('rejects unknown bucket', () => {
    expect(sleepHoursBucketSchema.safeParse('8to9').success).toBe(false);
  });
});

describe('sleepDisruptionSchema', () => {
  it('accepts known disruptions', () => {
    expect(sleepDisruptionSchema.parse('night_sweats')).toBe('night_sweats');
    expect(sleepDisruptionSchema.parse('racing_mind')).toBe('racing_mind');
  });

  it('rejects unknown disruption', () => {
    expect(sleepDisruptionSchema.safeParse('snoring').success).toBe(false);
  });
});

describe('logSleepBodySchema', () => {
  it('accepts quality-only with defaults', () => {
    expect(logSleepBodySchema.parse({ quality: 3 })).toEqual({
      quality: 3,
      hours: null,
      disruptions: [],
    });
  });

  it('accepts full payload', () => {
    expect(
      logSleepBodySchema.parse({
        quality: 2,
        hours: '5to6',
        disruptions: ['hot_flashes', 'woke_often'],
        loggedAt: iso,
      }),
    ).toMatchObject({ quality: 2, hours: '5to6' });
  });

  it('rejects too many disruptions and bad hours', () => {
    expect(
      logSleepBodySchema.safeParse({
        quality: 3,
        disruptions: [
          'night_sweats',
          'hot_flashes',
          'cant_fall_asleep',
          'woke_often',
          'woke_early',
          'bathroom_trips',
          'racing_mind',
          'restless',
          'night_sweats',
        ],
      }).success,
    ).toBe(false);
    expect(logSleepBodySchema.safeParse({ quality: 3, hours: '4to5' }).success).toBe(false);
  });
});

describe('sleepLogSchema / sleepStateResponseSchema', () => {
  it('accepts log and state fixtures', () => {
    const log = {
      id: 'sleep_1',
      quality: 4,
      hours: '7to8' as const,
      disruptions: ['restless' as const],
      loggedAt: iso,
    };
    expect(sleepLogSchema.parse(log)).toEqual(log);
    expect(sleepStateResponseSchema.parse({ today: log, recent: [log] })).toMatchObject({
      today: { id: 'sleep_1' },
    });
  });

  it('rejects missing id', () => {
    expect(
      sleepLogSchema.safeParse({
        quality: 4,
        hours: null,
        disruptions: [],
        loggedAt: iso,
      }).success,
    ).toBe(false);
  });
});
