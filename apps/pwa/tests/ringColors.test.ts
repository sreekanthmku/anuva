import { describe, expect, it } from 'vitest';
import type { ReportRingKey } from '@anuva/shared';
import { RING_COLORS, RING_EMPTY_COLOR } from '../src/features/core/ringColors';

const EXPECTED_KEYS: ReportRingKey[] = [
  'sleep',
  'energy',
  'stress',
  'mood',
  'focus',
  'hotFlashes',
];

describe('RING_COLORS', () => {
  it('defines color + track for every ReportRingKey', () => {
    expect(Object.keys(RING_COLORS).sort()).toEqual([...EXPECTED_KEYS].sort());
    for (const key of EXPECTED_KEYS) {
      expect(RING_COLORS[key].color).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(RING_COLORS[key].track).toMatch(/^rgba\(/);
    }
  });

  it('keeps brand-aligned accents for sleep / mood / focus', () => {
    expect(RING_COLORS.sleep.color).toBe('#5E3566');
    expect(RING_COLORS.mood.color).toBe('#C97E92');
    expect(RING_COLORS.focus.color).toBe('#B8923C');
    expect(RING_COLORS.hotFlashes.color).toBe('#C0405A');
  });

  it('uses a faded track distinct from the solid ring color', () => {
    for (const key of EXPECTED_KEYS) {
      expect(RING_COLORS[key].track).not.toBe(RING_COLORS[key].color);
      expect(RING_COLORS[key].track).toContain('0.');
    }
  });
});

describe('RING_EMPTY_COLOR', () => {
  it('is the muted empty-state hex', () => {
    expect(RING_EMPTY_COLOR).toBe('#B9A79A');
  });

  it('is not used as any metric ring color', () => {
    for (const key of EXPECTED_KEYS) {
      expect(RING_COLORS[key].color).not.toBe(RING_EMPTY_COLOR);
    }
  });
});
