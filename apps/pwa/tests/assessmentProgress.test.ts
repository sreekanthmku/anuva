import { describe, expect, it } from 'vitest';
import {
  ASSESSMENT_PROGRESS_KEY,
  clearAssessmentProgress,
  readAssessmentProgress,
  writeAssessmentProgress,
} from '../src/features/onboarding/data/assessmentProgress';
import type { AssessmentQuestion } from '../src/features/onboarding/data/assessmentQuestions';

// Going back from the Start trial page used to restart the assessment. Progress is now kept in
// session storage and read back, validated, when the questions open again.

function memoryStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => void map.set(key, value),
    removeItem: (key: string) => void map.delete(key),
    raw: map,
  };
}

const questions: AssessmentQuestion[] = [
  { id: 'age', options: ['age_29_below', 'age_30_34', 'age_35_40'] },
  { id: 'hot_flashes', options: ['yes', 'no', 'sometimes'] },
  { id: 'sleep', options: ['yes', 'no', 'sometimes'] },
];

describe('assessment progress', () => {
  it('starts empty when nothing was saved, or storage is unavailable', () => {
    expect(readAssessmentProgress(memoryStorage(), 'paired', questions, 2)).toEqual({ step: 0, answers: {} });
    expect(readAssessmentProgress(null, 'paired', questions, 2)).toEqual({ step: 0, answers: {} });
  });

  it('round-trips her step and every answer', () => {
    const storage = memoryStorage();
    writeAssessmentProgress(storage, 'paired', questions, { step: 1, answers: { 0: 2, 1: 0, 2: 1 } });
    expect(readAssessmentProgress(storage, 'paired', questions, 2)).toEqual({ step: 1, answers: { 0: 2, 1: 0, 2: 1 } });
  });

  it('keeps answers but resets the step when saved from the other layout', () => {
    const storage = memoryStorage();
    writeAssessmentProgress(storage, 'single', questions, { step: 2, answers: { 0: 1 } });
    expect(readAssessmentProgress(storage, 'paired', questions, 2)).toEqual({ step: 0, answers: { 0: 1 } });
  });

  it('drops everything when the questions have changed since', () => {
    const storage = memoryStorage();
    writeAssessmentProgress(storage, 'paired', questions, { step: 1, answers: { 0: 1 } });
    const changed = [...questions.slice(0, 2), { id: 'mood', options: ['yes', 'no'] } as AssessmentQuestion];
    expect(readAssessmentProgress(storage, 'paired', changed, 2)).toEqual({ step: 0, answers: {} });
  });

  it('ignores a step past the end, an out-of-range answer, and corrupt data', () => {
    const storage = memoryStorage();
    storage.setItem(
      ASSESSMENT_PROGRESS_KEY,
      JSON.stringify({ mode: 'paired', step: 9, questionIds: ['age', 'hot_flashes', 'sleep'], answers: { 0: 7, 1: 1, 5: 0 } }),
    );
    expect(readAssessmentProgress(storage, 'paired', questions, 2)).toEqual({ step: 0, answers: { 1: 1 } });

    storage.setItem(ASSESSMENT_PROGRESS_KEY, '{not json');
    expect(readAssessmentProgress(storage, 'paired', questions, 2)).toEqual({ step: 0, answers: {} });
  });

  it('is cleared once she has started her trial', () => {
    const storage = memoryStorage();
    writeAssessmentProgress(storage, 'paired', questions, { step: 1, answers: { 0: 1 } });
    clearAssessmentProgress(storage);
    expect(storage.raw.has(ASSESSMENT_PROGRESS_KEY)).toBe(false);
  });
});
