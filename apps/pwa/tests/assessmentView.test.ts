import { describe, expect, it } from 'vitest';
import {
  ASSESSMENT_VIEW_MODE,
  assessmentPath,
} from '../src/features/onboarding/config/assessmentView';

describe('assessmentView path helpers', () => {
  it('exports a known view mode', () => {
    expect(['single', 'paired']).toContain(ASSESSMENT_VIEW_MODE);
  });

  it('maps paired mode to /assessment-paired', () => {
    if (ASSESSMENT_VIEW_MODE === 'paired') {
      expect(assessmentPath()).toBe('/assessment-paired');
    }
  });

  it('maps single mode to /assessment', () => {
    if (ASSESSMENT_VIEW_MODE === 'single') {
      expect(assessmentPath()).toBe('/assessment');
    }
  });

  it('keeps assessmentPath consistent with ASSESSMENT_VIEW_MODE', () => {
    const expected =
      ASSESSMENT_VIEW_MODE === 'paired' ? '/assessment-paired' : '/assessment';
    expect(assessmentPath()).toBe(expected);
  });
});
