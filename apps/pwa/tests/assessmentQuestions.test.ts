import { describe, expect, it } from 'vitest';
import { assessmentQuestions } from '../src/features/onboarding/data/assessmentQuestions';

describe('assessmentQuestions structural integrity', () => {
  it('contains exactly 11 questions', () => {
    expect(assessmentQuestions).toHaveLength(11);
  });

  it('has unique ids', () => {
    const ids = assessmentQuestions.map((q) => q.id);
    expect(new Set(ids).size).toBe(assessmentQuestions.length);
  });

  it('requires nonempty id, prompt, and options for every question', () => {
    for (const question of assessmentQuestions) {
      expect(question.id.trim().length).toBeGreaterThan(0);
      expect(question.prompt.trim().length).toBeGreaterThan(0);
      expect(question.options.length).toBeGreaterThan(0);
      for (const option of question.options) {
        expect(option.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it('uses Yes/No/Sometimes for symptom questions and a distinct age bracket', () => {
    const age = assessmentQuestions.find((q) => q.id === 'age-bracket');
    expect(age).toBeDefined();
    expect(age!.options).toEqual([
      '29 or below',
      '30-34',
      '35-40',
      '41-45',
      '46-50',
      '51 or above',
    ]);

    const symptoms = assessmentQuestions.filter((q) => q.id !== 'age-bracket');
    expect(symptoms).toHaveLength(10);
    for (const question of symptoms) {
      expect(question.options).toEqual(['Yes', 'No', 'Sometimes']);
    }
  });
});
