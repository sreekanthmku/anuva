import { describe, expect, it } from 'vitest';
import {
  getAssessmentOutcome,
  scoreAssessmentQuestions,
} from '../src/features/onboarding/data/assessmentOutcome';
import type { AssessmentQuestion } from '../src/features/onboarding/data/assessmentQuestions';
import { assessmentQuestions } from '../src/features/onboarding/data/assessmentQuestions';

// Option *values*, not labels: scoring reads the value, so the language a woman answers in cannot
// change her score.
const sampleQuestions: AssessmentQuestion[] = [
  { id: 'q1', options: ['yes', 'no', 'sometimes'] },
  { id: 'q2', options: ['yes', 'no', 'sometimes'] },
  { id: 'q3', options: ['age_29_below', 'age_30_34'] },
];

describe('scoreAssessmentQuestions', () => {
  it('returns 0 when no answers are provided', () => {
    expect(scoreAssessmentQuestions({}, sampleQuestions)).toBe(0);
  });

  it('scores yes as 2, sometimes as 1, and no as 0', () => {
    expect(scoreAssessmentQuestions({ 0: 0 }, sampleQuestions)).toBe(2); // yes
    expect(scoreAssessmentQuestions({ 0: 2 }, sampleQuestions)).toBe(1); // sometimes
    expect(scoreAssessmentQuestions({ 0: 1 }, sampleQuestions)).toBe(0); // no
  });

  it('sums scores across answered questions', () => {
    // yes (2) + sometimes (1) = 3
    expect(scoreAssessmentQuestions({ 0: 0, 1: 2 }, sampleQuestions)).toBe(3);
  });

  it('skips undefined answers and out-of-range option indices', () => {
    expect(scoreAssessmentQuestions({ 0: undefined, 1: 99 }, sampleQuestions)).toBe(0);
  });

  it('treats unscored option values as 0 (e.g. age bracket)', () => {
    expect(scoreAssessmentQuestions({ 2: 0 }, sampleQuestions)).toBe(0);
  });

  it('scores the real assessment questions off their option values', () => {
    const yesOnly = Object.fromEntries(
      assessmentQuestions.map((_, index) => [index, 0])
    ) as Record<number, number>;
    // The first ten questions lead with `yes`; the age bracket's first option scores nothing.
    const symptomYesCount = assessmentQuestions.filter((q) => q.options[0] === 'yes').length;
    expect(scoreAssessmentQuestions(yesOnly, assessmentQuestions)).toBe(symptomYesCount * 2);
  });
});

describe('getAssessmentOutcome', () => {
  it('uses default threshold of 8', () => {
    expect(getAssessmentOutcome(7)).toEqual({
      score: 7,
      threshold: 8,
      status: 'in_control',
    });
  });

  it('returns in_control when score is below threshold', () => {
    expect(getAssessmentOutcome(0).status).toBe('in_control');
    expect(getAssessmentOutcome(7, 8).status).toBe('in_control');
  });

  it('returns further_assessment when score equals threshold', () => {
    expect(getAssessmentOutcome(8)).toEqual({
      score: 8,
      threshold: 8,
      status: 'further_assessment',
    });
  });

  it('returns further_assessment when score is above threshold', () => {
    expect(getAssessmentOutcome(12).status).toBe('further_assessment');
  });

  it('respects a custom threshold', () => {
    expect(getAssessmentOutcome(5, 5).status).toBe('further_assessment');
    expect(getAssessmentOutcome(4, 5).status).toBe('in_control');
  });
});
