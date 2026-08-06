import { describe, expect, it } from 'vitest';
import { OVERWHELMED } from '../src/nudge/signals.js';

describe('OVERWHELMED', () => {
  it('matches the L1-004 stress option string exactly', () => {
    expect(OVERWHELMED).toBe('I feel overwhelmed');
  });

  it('is a non-empty string constant', () => {
    expect(typeof OVERWHELMED).toBe('string');
    expect(OVERWHELMED.length).toBeGreaterThan(0);
  });
});
