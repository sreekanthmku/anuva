// ANU Nudge Engine — MVP self-test suite.
// Deterministic, DB-free checks of the simplified Governor, tone templates,
// and afternoon L2 rotation contract.

import type { NudgeSlot } from '@anuva/shared';
import { evaluateGovernor, type GovernorState } from './governor.js';
import { decideL2, ROTATION } from './selectL2Nudge.js';
import { getNudge, selectToneTemplate, type NudgeDef } from './registry.js';

interface CaseResult {
  group: string;
  name: string;
  ok: boolean;
  expected: unknown;
  got: unknown;
}

const L1_001 = getNudge('L1-001')!;
const L1_004 = getNudge('L1-004')!;

function baseState(overrides: Partial<GovernorState> = {}): GovernorState {
  return {
    nudgeCountToday: 0,
    selfLoggedTrackerToday: false,
    ...overrides,
  };
}

const MORNING = new Date('2026-06-24T08:00:00');
const AFTERNOON = new Date('2026-06-24T13:00:00');

function governorCases(): CaseResult[] {
  const cases: {
    name: string;
    nudge: NudgeDef;
    slot: NudgeSlot;
    now: Date;
    state: GovernorState;
    expect: { allowed: boolean; suppressedBy?: string };
  }[] = [
    {
      name: 'allow morning',
      nudge: L1_001,
      slot: 'morning',
      now: MORNING,
      state: baseState(),
      expect: { allowed: true },
    },
    {
      name: 'allow afternoon independently',
      nudge: L1_004,
      slot: 'afternoon',
      now: AFTERNOON,
      state: baseState(),
      expect: { allowed: true },
    },
    {
      name: 'SR-01 daily cap',
      nudge: L1_001,
      slot: 'morning',
      now: MORNING,
      state: baseState({ nudgeCountToday: 3 }),
      expect: { allowed: false, suppressedBy: 'SR-01' },
    },
    {
      name: 'SR-05 already logged tracker',
      nudge: L1_001,
      slot: 'morning',
      now: MORNING,
      state: baseState({ selfLoggedTrackerToday: true }),
      expect: { allowed: false, suppressedBy: 'SR-05' },
    },
  ];

  return cases.map((c) => {
    const got = evaluateGovernor(c.nudge, c.slot, c.now, c.state);
    const ok =
      got.allowed === c.expect.allowed &&
      (c.expect.suppressedBy === undefined || got.suppressedBy === c.expect.suppressedBy);
    return { group: 'governor', name: c.name, ok, expected: c.expect, got };
  });
}

function toneCases(): CaseResult[] {
  const cases: { name: string; nudgeId: string; answer: string; expect: string }[] = [
    { name: 'low adherence -> RT-002', nudgeId: 'L1-007', answer: 'I forgot', expect: 'RT-002' },
    { name: 'mood difficulty -> RT-003', nudgeId: 'L1-003', answer: 'Sad', expect: 'RT-003' },
    { name: 'uncertain -> RT-004', nudgeId: 'L1-003', answer: "I don't know", expect: 'RT-004' },
    { name: 'positive -> RT-001', nudgeId: 'L1-001', answer: 'I slept well', expect: 'RT-001' },
  ];

  return cases.map((c) => {
    const got = selectToneTemplate(c.nudgeId, c.answer).id;
    return { group: 'tone', name: c.name, ok: got === c.expect, expected: c.expect, got };
  });
}

function l2Cases(): CaseResult[] {
  const decision = decideL2();
  return [
    {
      group: 'selectL2',
      name: 'rotation order',
      ok: ROTATION.join(',') === 'L2-003,L2-002,L2-009',
      expected: ['L2-003', 'L2-002', 'L2-009'],
      got: [...ROTATION],
    },
    {
      group: 'selectL2',
      name: 'MVP always rotates',
      ok: decision.nudgeId === null && decision.setDistress === false && decision.rotate === true,
      expected: { nudgeId: null, setDistress: false, rotate: true },
      got: decision,
    },
  ];
}

export function runNudgeSelfTest() {
  const results = [...governorCases(), ...toneCases(), ...l2Cases()];
  const failed = results.filter((r) => !r.ok);
  return {
    ok: failed.length === 0,
    total: results.length,
    passed: results.length - failed.length,
    failed: failed.length,
    results,
  };
}
