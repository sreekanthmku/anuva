import { describe, expect, it } from 'vitest';
import {
  controlNextSteps,
  controlPills,
  nextSteps,
  type RiskPill,
} from '../src/features/onboarding/data/assessmentResult';
import { assessmentQuestions } from '../src/features/onboarding/data/assessmentQuestions';
import en from '../src/i18n/locales/en.json';

/**
 * The result module holds keys and colours; the words are in the locale bundles. These assert the
 * join between them — a pill or a step whose key has no English string would render as the key.
 */
function assertRiskPillShape(pill: RiskPill) {
  expect(en.assessmentResult.pills[pill.titleKey as keyof typeof en.assessmentResult.pills]).toEqual(
    expect.stringMatching(/\S/),
  );
  expect(
    en.assessmentResult.values[pill.valueKey as keyof typeof en.assessmentResult.values],
  ).toEqual(expect.stringMatching(/\S/));
  expect(pill.color).toMatch(/^#[0-9A-Fa-f]{6}$/);
}

function assertStepKey(step: string) {
  const copy = en.assessmentResult.steps[step as keyof typeof en.assessmentResult.steps];
  expect(copy).toBeDefined();
  expect(copy.title.trim().length).toBeGreaterThan(0);
  expect(copy.body.trim().length).toBeGreaterThan(0);
}

describe('assessmentResult content shape', () => {
  it('exposes three control pills with title/value keys and a colour', () => {
    expect(controlPills).toHaveLength(3);
    controlPills.forEach(assertRiskPillShape);
  });

  it('exposes nextSteps as keys with title and body copy', () => {
    expect(nextSteps.length).toBeGreaterThan(0);
    nextSteps.forEach(assertStepKey);
  });

  it('exposes controlNextSteps as keys with title and body copy', () => {
    expect(controlNextSteps.length).toBeGreaterThan(0);
    controlNextSteps.forEach(assertStepKey);
  });
});

describe('assessmentResult reported signs copy', () => {
  // The "why" card names each sign by its question id; a scored question with no short label
  // would render as the raw key.
  it('has a short English label for every scored question', () => {
    const symptoms = assessmentQuestions.filter((q) => q.options.includes('yes'));
    for (const question of symptoms) {
      expect(
        en.assessmentResult.signs[question.id as keyof typeof en.assessmentResult.signs],
      ).toEqual(expect.stringMatching(/\S/));
    }
  });
});
