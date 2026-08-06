import { describe, expect, it } from 'vitest';
import { currentSlot, startOfDay, toCard } from '../src/nudge/engine.js';
import { getNudge, type NudgeDef } from '../src/nudge/registry.js';

describe('startOfDay', () => {
  it('zeros hours/minutes/seconds/ms without changing the calendar day', () => {
    const input = new Date('2026-06-24T15:42:19.456');
    const result = startOfDay(input);

    expect(result.getFullYear()).toBe(2026);
    expect(result.getMonth()).toBe(5); // June
    expect(result.getDate()).toBe(24);
    expect(result.getHours()).toBe(0);
    expect(result.getMinutes()).toBe(0);
    expect(result.getSeconds()).toBe(0);
    expect(result.getMilliseconds()).toBe(0);
  });

  it('does not mutate the input Date', () => {
    const input = new Date('2026-06-24T15:42:19.456');
    const before = input.getTime();
    startOfDay(input);
    expect(input.getTime()).toBe(before);
  });

  it('is idempotent for an already-midnight date', () => {
    const midnight = new Date('2026-06-24T00:00:00.000');
    expect(startOfDay(midnight).getTime()).toBe(midnight.getTime());
  });
});

describe('currentSlot', () => {
  it('returns morning for hours 0–11', () => {
    expect(currentSlot(new Date('2026-06-24T00:00:00'))).toBe('morning');
    expect(currentSlot(new Date('2026-06-24T08:30:00'))).toBe('morning');
    expect(currentSlot(new Date('2026-06-24T11:59:59'))).toBe('morning');
  });

  it('returns afternoon for hours 12–16', () => {
    expect(currentSlot(new Date('2026-06-24T12:00:00'))).toBe('afternoon');
    expect(currentSlot(new Date('2026-06-24T13:00:00'))).toBe('afternoon');
    expect(currentSlot(new Date('2026-06-24T16:59:59'))).toBe('afternoon');
  });

  it('returns evening for hours 17–23', () => {
    expect(currentSlot(new Date('2026-06-24T17:00:00'))).toBe('evening');
    expect(currentSlot(new Date('2026-06-24T20:15:00'))).toBe('evening');
    expect(currentSlot(new Date('2026-06-24T23:59:59'))).toBe('evening');
  });

  it('uses local-hour boundaries at exact cutovers', () => {
    // < 12 → morning; < 17 → afternoon; else evening
    expect(currentSlot(new Date(2026, 5, 24, 11, 59, 0))).toBe('morning');
    expect(currentSlot(new Date(2026, 5, 24, 12, 0, 0))).toBe('afternoon');
    expect(currentSlot(new Date(2026, 5, 24, 16, 59, 0))).toBe('afternoon');
    expect(currentSlot(new Date(2026, 5, 24, 17, 0, 0))).toBe('evening');
  });
});

describe('toCard', () => {
  it('maps NudgeDef fields onto a NudgeCard', () => {
    const def = getNudge('L1-004') as NudgeDef;
    expect(toCard(def)).toEqual({
      nudgeId: 'L1-004',
      layer: 1,
      slot: 'afternoon',
      question: def.question,
      options: def.options,
      required: true,
    });
  });

  it('preserves layer-2 optional flags and options array identity content', () => {
    const def = getNudge('L2-003') as NudgeDef;
    const card = toCard(def);
    expect(card.nudgeId).toBe('L2-003');
    expect(card.layer).toBe(2);
    expect(card.required).toBe(false);
    expect(card.options).toEqual(def.options);
    expect(card.question).toBe(def.question);
  });

  it('does not include storage on the card', () => {
    const def = getNudge('L1-001') as NudgeDef;
    expect(toCard(def)).not.toHaveProperty('storage');
  });
});
