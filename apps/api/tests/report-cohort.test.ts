import { describe, it, expect } from 'vitest';
import type { ReportRingKey } from '@anuva/shared';
import { COHORT_LABEL, COHORT_REFERENCES, type CohortReference } from '../src/report/cohort.js';

const EXPECTED_KEYS: ReportRingKey[] = [
  'sleep',
  'energy',
  'stress',
  'mood',
  'focus',
  'hotFlashes',
];

describe('COHORT_REFERENCES', () => {
  it('has exactly the six report ring keys', () => {
    expect(Object.keys(COHORT_REFERENCES).sort()).toEqual([...EXPECTED_KEYS].sort());
  });

  it('matches the CohortReference shape for every ring', () => {
    for (const key of EXPECTED_KEYS) {
      const ref: CohortReference = COHORT_REFERENCES[key];
      expect(ref, key).toBeDefined();
      expect(typeof ref.value).toBe('number');
      expect(ref.value).toBeGreaterThanOrEqual(0);
      expect(ref.value).toBeLessThanOrEqual(100);
      expect(['high', 'medium']).toContain(ref.confidence);
      expect(typeof ref.basis).toBe('string');
      expect(ref.basis.length).toBeGreaterThan(0);
      expect(typeof ref.source).toBe('string');
      expect(ref.source.length).toBeGreaterThan(0);
    }
  });

  it('pins documented median values and confidence levels', () => {
    expect(COHORT_REFERENCES.sleep).toMatchObject({ value: 62, confidence: 'high' });
    expect(COHORT_REFERENCES.energy).toMatchObject({ value: 56, confidence: 'high' });
    expect(COHORT_REFERENCES.stress).toMatchObject({ value: 60, confidence: 'medium' });
    expect(COHORT_REFERENCES.mood).toMatchObject({ value: 62, confidence: 'medium' });
    expect(COHORT_REFERENCES.focus).toMatchObject({ value: 68, confidence: 'medium' });
    expect(COHORT_REFERENCES.hotFlashes).toMatchObject({ value: 80, confidence: 'high' });
  });
});

describe('COHORT_LABEL', () => {
  it('describes the India-first general population cohort', () => {
    expect(COHORT_LABEL).toBe('Indian women 42–50, general population');
  });
});
