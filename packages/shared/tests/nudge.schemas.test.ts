import { describe, expect, it } from 'vitest';
import {
  nudgeCardSchema,
  nudgeDayResponseSchema,
  nudgeDayTrackerSchema,
  nudgeLayerSchema,
  nudgeRespondResponseSchema,
  nudgeSlotSchema,
  nudgeStateResponseSchema,
  nudgeTierSchema,
  nudgeTodayResponseSchema,
  submitNudgeResponseBodySchema,
} from '../src/nudge.js';

describe('nudgeSlotSchema', () => {
  it.each(['morning', 'afternoon', 'evening'] as const)('accepts %s', (slot) => {
    expect(nudgeSlotSchema.parse(slot)).toBe(slot);
  });

  it('rejects night', () => {
    expect(nudgeSlotSchema.safeParse('night').success).toBe(false);
  });
});

describe('nudgeLayerSchema', () => {
  it.each([1, 2] as const)('accepts layer %s', (layer) => {
    expect(nudgeLayerSchema.parse(layer)).toBe(layer);
  });

  it('rejects layer 3 and non-literal numbers', () => {
    expect(nudgeLayerSchema.safeParse(3).success).toBe(false);
    expect(nudgeLayerSchema.safeParse(0).success).toBe(false);
    expect(nudgeLayerSchema.safeParse('1').success).toBe(false);
  });
});

describe('nudgeCardSchema', () => {
  const valid = {
    nudgeId: 'L1-001',
    layer: 1,
    slot: 'morning',
    question: 'How did you sleep?',
    options: ['Great', 'Okay', 'Poor'],
    required: true,
  };

  it('accepts a valid card', () => {
    expect(nudgeCardSchema.parse(valid)).toEqual(valid);
  });

  it('rejects missing options', () => {
    const { options: _omit, ...rest } = valid;
    expect(nudgeCardSchema.safeParse(rest).success).toBe(false);
  });

  it('rejects invalid slot', () => {
    expect(nudgeCardSchema.safeParse({ ...valid, slot: 'midnight' }).success).toBe(false);
  });
});

describe('submitNudgeResponseBodySchema', () => {
  it('accepts required fields without loggedAt', () => {
    expect(
      submitNudgeResponseBodySchema.parse({ nudgeId: 'L1-001', answer: 'Great' }),
    ).toEqual({ nudgeId: 'L1-001', answer: 'Great' });
  });

  it('accepts ISO datetime loggedAt', () => {
    expect(
      submitNudgeResponseBodySchema.parse({
        nudgeId: 'L2-001',
        answer: 'Yes',
        loggedAt: '2026-08-06T10:00:00.000Z',
      }),
    ).toMatchObject({ loggedAt: '2026-08-06T10:00:00.000Z' });
  });

  it('rejects missing answer', () => {
    expect(submitNudgeResponseBodySchema.safeParse({ nudgeId: 'L1-001' }).success).toBe(
      false,
    );
  });

  it('rejects non-datetime loggedAt', () => {
    expect(
      submitNudgeResponseBodySchema.safeParse({
        nudgeId: 'L1-001',
        answer: 'Great',
        loggedAt: '2026-08-06',
      }).success,
    ).toBe(false);
  });
});

describe('nudgeRespondResponseSchema', () => {
  const valid = {
    ok: true,
    toneTemplateId: 'RT-001',
    message: 'Thanks for checking in.',
    distressFlag: false,
  };

  it('accepts a valid respond payload', () => {
    expect(nudgeRespondResponseSchema.parse(valid)).toEqual(valid);
  });

  it('rejects missing distressFlag', () => {
    const { distressFlag: _omit, ...rest } = valid;
    expect(nudgeRespondResponseSchema.safeParse(rest).success).toBe(false);
  });
});

describe('nudgeTodayResponseSchema', () => {
  it('accepts null slot/bundleTitle and empty cards', () => {
    expect(
      nudgeTodayResponseSchema.parse({
        slot: null,
        bundleTitle: null,
        budgetRemaining: 2,
        cards: [],
      }),
    ).toEqual({
      slot: null,
      bundleTitle: null,
      budgetRemaining: 2,
      cards: [],
    });
  });

  it('accepts a morning bundle with cards', () => {
    const result = nudgeTodayResponseSchema.parse({
      slot: 'morning',
      bundleTitle: 'Morning',
      budgetRemaining: 1,
      cards: [
        {
          nudgeId: 'L1-001',
          layer: 1,
          slot: 'morning',
          question: 'Sleep?',
          options: ['Good'],
          required: true,
        },
      ],
    });
    expect(result.cards).toHaveLength(1);
  });

  it('rejects non-int budgetRemaining', () => {
    expect(
      nudgeTodayResponseSchema.safeParse({
        slot: null,
        bundleTitle: null,
        budgetRemaining: 1.5,
        cards: [],
      }).success,
    ).toBe(false);
  });
});

describe('nudgeTierSchema', () => {
  it.each(['core', 'body', 'lifestyle', 'weekly'] as const)('accepts %s', (tier) => {
    expect(nudgeTierSchema.parse(tier)).toBe(tier);
  });

  it('rejects unknown tier', () => {
    expect(nudgeTierSchema.safeParse('optional').success).toBe(false);
  });
});

describe('nudgeDayTrackerSchema / nudgeDayResponseSchema', () => {
  const tracker = {
    nudgeId: 'L1-002',
    tier: 'core',
    label: 'Energy',
    question: 'Energy today?',
    options: ['Low', 'Medium', 'High'],
    required: true,
    answered: true,
    answer: 'Medium',
  };

  it('accepts answered and unanswered trackers', () => {
    expect(nudgeDayTrackerSchema.parse(tracker)).toEqual(tracker);
    expect(
      nudgeDayTrackerSchema.parse({ ...tracker, answered: false, answer: null }),
    ).toMatchObject({ answer: null });
  });

  it('accepts a day response', () => {
    expect(
      nudgeDayResponseSchema.parse({
        date: '2026-08-06',
        total: 1,
        answeredCount: 1,
        trackers: [tracker],
      }),
    ).toMatchObject({ total: 1, answeredCount: 1 });
  });

  it('rejects missing answer field on tracker', () => {
    const { answer: _omit, ...rest } = tracker;
    expect(nudgeDayTrackerSchema.safeParse(rest).success).toBe(false);
  });

  it('rejects non-int totals on day response', () => {
    expect(
      nudgeDayResponseSchema.safeParse({
        date: '2026-08-06',
        total: 1.2,
        answeredCount: 0,
        trackers: [],
      }).success,
    ).toBe(false);
  });
});

describe('nudgeStateResponseSchema', () => {
  const valid = {
    date: '2026-08-06',
    nudgeCount: 2,
    morningAnchorResponded: true,
    afternoonResponded: false,
    distressFlag: false,
    lastEngagedAt: '2026-08-06T09:00:00.000Z',
  };

  it('accepts nullable lastEngagedAt', () => {
    expect(nudgeStateResponseSchema.parse(valid)).toEqual(valid);
    expect(
      nudgeStateResponseSchema.parse({ ...valid, lastEngagedAt: null }),
    ).toMatchObject({ lastEngagedAt: null });
  });

  it('rejects missing morningAnchorResponded', () => {
    const { morningAnchorResponded: _omit, ...rest } = valid;
    expect(nudgeStateResponseSchema.safeParse(rest).success).toBe(false);
  });
});
