import { describe, expect, it } from 'vitest';
import {
  backAction,
  furthestReachableStep,
  readHistoryStep,
} from '../src/features/onboarding/data/assessmentStepHistory';

// The pre-assessment step lives in browser history so the back gesture and the back chevron both
// step back one question instead of leaving the assessment.

describe('assessment step history', () => {
  it('reads the step stored on a history entry, and ignores anything else', () => {
    expect(readHistoryStep({ assessmentStep: 3 }, 8)).toBe(3);
    expect(readHistoryStep({ assessmentStep: 0, pushedByNext: true }, 8)).toBe(0);
    expect(readHistoryStep(null, 8)).toBeUndefined();
    expect(readHistoryStep({ other: 1 }, 8)).toBeUndefined();
    expect(readHistoryStep({ assessmentStep: 8 }, 8)).toBeUndefined();
    expect(readHistoryStep({ assessmentStep: -1 }, 8)).toBeUndefined();
    expect(readHistoryStep({ assessmentStep: 1.5 }, 8)).toBeUndefined();
  });

  it('never lets a stale entry skip past an unanswered step', () => {
    const answered = new Set([0, 1]);
    expect(furthestReachableStep(5, (step) => answered.has(step))).toBe(2);
    expect(furthestReachableStep(5, () => false)).toBe(0);
    expect(furthestReachableStep(5, () => true)).toBe(4);
  });

  it('pops history only when Continue pushed this entry over the step before', () => {
    expect(backAction({ assessmentStep: 2, pushedByNext: true }, 2, 8)).toBe('pop');
  });

  it('rewrites the entry in place when she arrived on it, so back never leaves the assessment', () => {
    expect(backAction({ assessmentStep: 5 }, 5, 8)).toBe('replace');
    expect(backAction(null, 5, 8)).toBe('replace');
    // Shown step was clamped below the entry's own: the entry underneath is not the step before.
    expect(backAction({ assessmentStep: 5, pushedByNext: true }, 3, 8)).toBe('replace');
  });

  it('does nothing on the first step', () => {
    expect(backAction({ assessmentStep: 0 }, 0, 8)).toBe('none');
    expect(backAction(null, 0, 8)).toBe('none');
  });
});
