import { describe, expect, it } from 'vitest';
import { evaluateGovernor, type GovernorState } from '../src/nudge/governor.js';
import { getNudge, type NudgeDef } from '../src/nudge/registry.js';

const L1_001 = getNudge('L1-001') as NudgeDef;
const NOW = new Date('2026-06-24T08:00:00');

function state(overrides: Partial<GovernorState> = {}): GovernorState {
  return {
    nudgeCountToday: 0,
    selfLoggedTrackerToday: false,
    ...overrides,
  };
}

describe('evaluateGovernor', () => {
  it('allows when under daily cap and tracker not self-logged', () => {
    const result = evaluateGovernor(L1_001, 'morning', NOW, state());
    expect(result).toEqual({ allowed: true });
  });

  it('allows when nudgeCountToday is just under cap (2)', () => {
    const result = evaluateGovernor(L1_001, 'morning', NOW, state({ nudgeCountToday: 2 }));
    expect(result).toEqual({ allowed: true });
  });

  it('suppresses with SR-01 when daily cap is reached (3)', () => {
    const result = evaluateGovernor(L1_001, 'morning', NOW, state({ nudgeCountToday: 3 }));
    expect(result).toEqual({ allowed: false, suppressedBy: 'SR-01' });
  });

  it('suppresses with SR-01 when over daily cap', () => {
    const result = evaluateGovernor(L1_001, 'afternoon', NOW, state({ nudgeCountToday: 5 }));
    expect(result).toEqual({ allowed: false, suppressedBy: 'SR-01' });
  });

  it('suppresses with SR-05 when tracker already self-logged', () => {
    const result = evaluateGovernor(
      L1_001,
      'morning',
      NOW,
      state({ selfLoggedTrackerToday: true }),
    );
    expect(result).toEqual({ allowed: false, suppressedBy: 'SR-05' });
  });

  it('SR-01 takes precedence over SR-05 when both would apply', () => {
    const result = evaluateGovernor(
      L1_001,
      'morning',
      NOW,
      state({ nudgeCountToday: 3, selfLoggedTrackerToday: true }),
    );
    expect(result).toEqual({ allowed: false, suppressedBy: 'SR-01' });
  });

  it('ignoreDailyCap bypasses SR-01 but still respects SR-05', () => {
    const atCap = evaluateGovernor(
      L1_001,
      'morning',
      NOW,
      state({ nudgeCountToday: 3 }),
      { ignoreDailyCap: true },
    );
    expect(atCap).toEqual({ allowed: true });

    const selfLogged = evaluateGovernor(
      L1_001,
      'morning',
      NOW,
      state({ nudgeCountToday: 3, selfLoggedTrackerToday: true }),
      { ignoreDailyCap: true },
    );
    expect(selfLogged).toEqual({ allowed: false, suppressedBy: 'SR-05' });
  });

  it('defaults options to empty object (cap enforced)', () => {
    const result = evaluateGovernor(L1_001, 'evening', NOW, state({ nudgeCountToday: 3 }));
    expect(result.allowed).toBe(false);
    expect(result.suppressedBy).toBe('SR-01');
  });
});
