import { describe, expect, it } from 'vitest';
import {
  controlNextSteps,
  controlPills,
  nextSteps,
  riskPills,
  type RiskPill,
} from '../src/features/onboarding/data/assessmentResult';

function assertRiskPillShape(pill: RiskPill) {
  expect(pill.title.trim().length).toBeGreaterThan(0);
  expect(pill.value.trim().length).toBeGreaterThan(0);
  expect(pill.color).toMatch(/^#[0-9A-Fa-f]{6}$/);
}

function assertStepTuple(step: [string, string]) {
  expect(step).toHaveLength(2);
  expect(step[0].trim().length).toBeGreaterThan(0);
  expect(step[1].trim().length).toBeGreaterThan(0);
}

describe('assessmentResult content shape', () => {
  it('exposes three risk pills with title/value/color', () => {
    expect(riskPills).toHaveLength(3);
    riskPills.forEach(assertRiskPillShape);
  });

  it('exposes three control pills with title/value/color', () => {
    expect(controlPills).toHaveLength(3);
    controlPills.forEach(assertRiskPillShape);
  });

  it('exposes nextSteps as nonempty title/subtitle tuples', () => {
    expect(nextSteps.length).toBeGreaterThan(0);
    nextSteps.forEach(assertStepTuple);
  });

  it('exposes controlNextSteps as nonempty title/subtitle tuples', () => {
    expect(controlNextSteps.length).toBeGreaterThan(0);
    controlNextSteps.forEach(assertStepTuple);
  });
});
