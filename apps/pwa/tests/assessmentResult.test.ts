import { describe, expect, it } from 'vitest';
import {
  controlNextSteps,
  controlPills,
  nextSteps,
  riskPills,
  type RiskPill,
} from '../src/features/onboarding/data/assessmentResult';
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
  it('exposes three risk pills with title/value keys and a colour', () => {
    expect(riskPills).toHaveLength(3);
    riskPills.forEach(assertRiskPillShape);
  });

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
