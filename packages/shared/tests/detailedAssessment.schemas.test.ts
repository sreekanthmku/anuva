import { describe, expect, it } from 'vitest';
import {
  DETAILED_SIGNATURE_VALUE_MAX,
  QOL_OPTIONS,
  SEVERITY_OPTIONS,
  YESNO_OPTIONS,
  detailedAnswerSchema,
  detailedAssessmentQuestionKeys,
  detailedAssessmentRequiredKeys,
  detailedAssessmentSections,
  detailedAssessmentStateResponseSchema,
  detailedAssessmentStatusSchema,
  detailedPractitioners,
  detailedQuestionInputTypes,
  detailedSignatureQuestionKeys,
  findMissingDetailedAnswers,
  saveDetailedAssessmentBodySchema,
  submitDetailedAssessmentBodySchema,
} from '../src/detailedAssessment.js';

describe('catalog constants', () => {
  it('exposes expected input types and scale options', () => {
    expect(detailedQuestionInputTypes).toEqual([
      'text',
      'textarea',
      'number',
      'date',
      'yesno',
      'severity',
      'qol',
      'select',
      'multiselect',
      'textlist',
      'dynlist',
      'signature',
    ]);
    expect(SEVERITY_OPTIONS).toEqual(['None', 'Mild', 'Moderate', 'Severe']);
    expect(QOL_OPTIONS).toEqual(['Not at all', 'Somewhat', 'Significantly', 'Severely']);
    expect(YESNO_OPTIONS).toEqual(['Yes', 'No']);
  });

  it('has unique question keys across all sections', () => {
    const keys = detailedAssessmentSections.flatMap((s) => s.questions.map((q) => q.key));
    expect(new Set(keys).size).toBe(keys.length);
    expect(detailedAssessmentQuestionKeys.size).toBe(keys.length);
    for (const key of keys) {
      expect(detailedAssessmentQuestionKeys.has(key)).toBe(true);
    }
  });

  it('includes core sections used by the questionnaire', () => {
    expect(detailedAssessmentSections.map((s) => s.key)).toEqual([
      'your-information',
      'menstrual-history',
      'vasomotor',
      'sleep',
      'mood-cognitive',
      'physical',
      'nutrition-metabolic',
      'digestive-gut',
      'lifestyle',
      'medical-history',
      'surgical-history',
      'medications',
      'quality-of-life',
      'family-relationship',
      'treatment-goals',
      'signature',
    ]);
  });

  it('marks select and multiselect questions with options', () => {
    const choiceQuestions = detailedAssessmentSections
      .flatMap((s) => s.questions)
      .filter((q) => q.inputType === 'select' || q.inputType === 'multiselect');
    expect(choiceQuestions.length).toBeGreaterThan(0);
    for (const q of choiceQuestions) {
      expect(q.options?.length).toBeGreaterThan(0);
    }
  });

  it('assigns a reviewing practitioner to every section', () => {
    for (const section of detailedAssessmentSections) {
      expect(detailedPractitioners).toContain(section.primary);
      if (section.secondary) {
        expect(detailedPractitioners).toContain(section.secondary);
      }
    }
  });

  it('auto-fills the date on the first and last screens', () => {
    const first = detailedAssessmentSections[0]!;
    const last = detailedAssessmentSections[detailedAssessmentSections.length - 1]!;
    expect(first.questions.some((q) => q.autoFill === 'today')).toBe(true);
    expect(last.questions.some((q) => q.autoFill === 'today')).toBe(true);
  });

  it('exposes exactly one signature question', () => {
    expect([...detailedSignatureQuestionKeys]).toEqual(['signature']);
  });
});

describe('findMissingDetailedAnswers', () => {
  it('reports every required key when nothing is answered', () => {
    expect(findMissingDetailedAnswers({})).toEqual(detailedAssessmentRequiredKeys);
  });

  it('reports nothing when every required key holds a value', () => {
    const answers = Object.fromEntries(detailedAssessmentRequiredKeys.map((key) => [key, 'Yes']));
    expect(findMissingDetailedAnswers(answers)).toEqual([]);
  });

  it('treats blank and whitespace-only values as unanswered', () => {
    const answers = Object.fromEntries(detailedAssessmentRequiredKeys.map((key) => [key, 'Yes']));
    answers['hot-flashes'] = '';
    answers['night-sweats'] = '   ';
    expect(findMissingDetailedAnswers(answers)).toEqual(['hot-flashes', 'night-sweats']);
  });

  it('ignores optional questions', () => {
    const optional = detailedAssessmentSections
      .flatMap((s) => s.questions)
      .filter((q) => q.optional)
      .map((q) => q.key);
    expect(optional.length).toBeGreaterThan(0);
    const missing = findMissingDetailedAnswers({});
    for (const key of optional) {
      expect(missing).not.toContain(key);
    }
  });

  it('requires the signature before an assessment counts as complete', () => {
    const answers = Object.fromEntries(detailedAssessmentRequiredKeys.map((key) => [key, 'Yes']));
    delete answers['signature'];
    expect(findMissingDetailedAnswers(answers)).toEqual(['signature']);
  });

  it('narrows to a caller-supplied key subset', () => {
    expect(findMissingDetailedAnswers({ 'hot-flashes': 'Mild' }, ['hot-flashes', 'night-sweats'])).toEqual([
      'night-sweats',
    ]);
  });
});

describe('detailedAssessmentStatusSchema', () => {
  it.each(['not_started', 'in_progress', 'completed'] as const)('accepts %s', (status) => {
    expect(detailedAssessmentStatusSchema.parse(status)).toBe(status);
  });

  it('rejects unknown status', () => {
    expect(detailedAssessmentStatusSchema.safeParse('draft').success).toBe(false);
  });
});

describe('detailedAnswerSchema', () => {
  it('accepts a catalog key and value', () => {
    expect(
      detailedAnswerSchema.parse({ questionKey: 'hot-flashes', value: 'Moderate' }),
    ).toEqual({ questionKey: 'hot-flashes', value: 'Moderate' });
  });

  it('rejects empty questionKey', () => {
    expect(detailedAnswerSchema.safeParse({ questionKey: '', value: 'Yes' }).success).toBe(
      false,
    );
  });

  it('rejects questionKey over 120 chars', () => {
    expect(
      detailedAnswerSchema.safeParse({ questionKey: 'k'.repeat(121), value: 'Yes' }).success,
    ).toBe(false);
  });

  it('rejects value over 4000 chars', () => {
    expect(
      detailedAnswerSchema.safeParse({
        questionKey: 'main-concerns',
        value: 'x'.repeat(4001),
      }).success,
    ).toBe(false);
  });

  it('rejects missing value', () => {
    expect(detailedAnswerSchema.safeParse({ questionKey: 'hot-flashes' }).success).toBe(
      false,
    );
  });

  it('accepts a signature well over the ordinary value limit', () => {
    const value = `data:image/png;base64,${'A'.repeat(20_000)}`;
    expect(detailedAnswerSchema.safeParse({ questionKey: 'signature', value }).success).toBe(
      true,
    );
  });

  it('accepts a cleared signature', () => {
    expect(
      detailedAnswerSchema.safeParse({ questionKey: 'signature', value: '' }).success,
    ).toBe(true);
  });

  it('rejects a signature that is not a PNG data URL', () => {
    expect(
      detailedAnswerSchema.safeParse({ questionKey: 'signature', value: 'x'.repeat(9000) })
        .success,
    ).toBe(false);
    expect(
      detailedAnswerSchema.safeParse({
        questionKey: 'signature',
        value: 'data:text/html;base64,PHNjcmlwdD4=',
      }).success,
    ).toBe(false);
  });

  it('rejects a signature past the signature limit', () => {
    const value = `data:image/png;base64,${'A'.repeat(DETAILED_SIGNATURE_VALUE_MAX)}`;
    expect(detailedAnswerSchema.safeParse({ questionKey: 'signature', value }).success).toBe(
      false,
    );
  });
});

describe('saveDetailedAssessmentBodySchema / submitDetailedAssessmentBodySchema', () => {
  it('accepts empty answers array', () => {
    expect(saveDetailedAssessmentBodySchema.parse({ answers: [] })).toEqual({ answers: [] });
    expect(submitDetailedAssessmentBodySchema.parse({ answers: [] })).toEqual({
      answers: [],
    });
  });

  it('accepts a batch of answers', () => {
    const body = {
      answers: [
        { questionKey: 'periods-regular', value: 'No' },
        { questionKey: 'hot-flashes', value: 'Severe' },
      ],
    };
    expect(saveDetailedAssessmentBodySchema.parse(body)).toEqual(body);
  });

  it('rejects more than 250 answers', () => {
    const answers = Array.from({ length: 251 }, (_, i) => ({
      questionKey: `q-${i}`,
      value: 'Yes',
    }));
    expect(saveDetailedAssessmentBodySchema.safeParse({ answers }).success).toBe(false);
  });

  it('rejects missing answers', () => {
    expect(saveDetailedAssessmentBodySchema.safeParse({}).success).toBe(false);
  });

  it('rejects invalid nested answer', () => {
    expect(
      saveDetailedAssessmentBodySchema.safeParse({
        answers: [{ questionKey: '', value: 'Yes' }],
      }).success,
    ).toBe(false);
  });
});

describe('detailedAssessmentStateResponseSchema', () => {
  it('accepts not_started with null completedAt', () => {
    expect(
      detailedAssessmentStateResponseSchema.parse({
        status: 'not_started',
        completedAt: null,
        answers: {},
      }),
    ).toEqual({
      status: 'not_started',
      completedAt: null,
      answers: {},
    });
  });

  it('accepts completed state with answer map', () => {
    expect(
      detailedAssessmentStateResponseSchema.parse({
        status: 'completed',
        completedAt: '2026-08-06T18:00:00.000Z',
        answers: { 'hot-flashes': 'Mild', 'periods-regular': 'Yes' },
      }),
    ).toMatchObject({
      status: 'completed',
      answers: { 'hot-flashes': 'Mild' },
    });
  });

  it('rejects missing answers map', () => {
    expect(
      detailedAssessmentStateResponseSchema.safeParse({
        status: 'in_progress',
        completedAt: null,
      }).success,
    ).toBe(false);
  });

  it('rejects non-string answer values', () => {
    expect(
      detailedAssessmentStateResponseSchema.safeParse({
        status: 'in_progress',
        completedAt: null,
        answers: { 'hot-flashes': 2 },
      }).success,
    ).toBe(false);
  });
});
