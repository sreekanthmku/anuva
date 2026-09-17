import { describe, expect, it } from 'vitest';
import { assessmentQuestions } from '../src/features/onboarding/data/assessmentQuestions';
import en from '../src/i18n/locales/en.json';

/**
 * The questions module holds structure only — the prompts and answer labels live in the locale
 * bundles. So what is worth asserting is that the two halves still line up: every question has a
 * prompt to render, and every option value has a label. A missing key would otherwise surface as a
 * raw `assessment.questions.brain-fog` on screen.
 */
describe('assessmentQuestions structural integrity', () => {
  it('contains exactly 11 questions', () => {
    expect(assessmentQuestions).toHaveLength(11);
  });

  it('has unique ids', () => {
    const ids = assessmentQuestions.map((q) => q.id);
    expect(new Set(ids).size).toBe(assessmentQuestions.length);
  });

  it('has an English prompt for every question id', () => {
    for (const question of assessmentQuestions) {
      expect(question.id.trim().length).toBeGreaterThan(0);
      expect(question.options.length).toBeGreaterThan(0);
      expect(en.assessment.questions[question.id as keyof typeof en.assessment.questions]).toEqual(
        expect.stringMatching(/\S/),
      );
    }
  });

  it('has an English label for every option value', () => {
    for (const question of assessmentQuestions) {
      for (const option of question.options) {
        expect(en.assessment.options[option as keyof typeof en.assessment.options]).toEqual(
          expect.stringMatching(/\S/),
        );
      }
    }
  });

  it('uses yes/no/sometimes for symptom questions and a distinct age bracket', () => {
    const age = assessmentQuestions.find((q) => q.id === 'age-bracket');
    expect(age).toBeDefined();
    expect(age!.options).toEqual([
      'age_29_below',
      'age_30_34',
      'age_35_40',
      'age_41_45',
      'age_46_50',
      'age_51_above',
    ]);

    const symptoms = assessmentQuestions.filter((q) => q.id !== 'age-bracket');
    expect(symptoms).toHaveLength(10);
    for (const question of symptoms) {
      expect(question.options).toEqual(['yes', 'no', 'sometimes']);
    }
  });
});
