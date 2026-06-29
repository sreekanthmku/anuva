// ANU Nudge Engine — self-test suite.
// Deterministic, DB-free checks of the decision logic: Governor (SR-01..09),
// tone templates (RT-001..007), and the L2 selection tree. Exposed publicly via
// GET /nudge/selftest so anyone can verify the rules without auth or data setup.

import { evaluateGovernor, type GovernorState } from './governor.js';
import { decideL2 } from './selectL2Nudge.js';
import { getNudge, selectToneTemplate } from './registry.js';
import type { NudgeSlot } from '@anuva/shared';

interface CaseResult {
  group: string;
  name: string;
  ok: boolean;
  expected: unknown;
  got: unknown;
}

const L1_001 = getNudge('L1-001')!; // morning mandatory
const L1_004 = getNudge('L1-004')!; // afternoon mandatory
const L1_005 = getNudge('L1-005')!; // evening mandatory
const L3_001 = getNudge('L3-001')!; // layer-3 trigger
const L3_007 = getNudge('L3-007')!; // safety

// Benign baseline — all gates pass.
function baseState(overrides: Partial<GovernorState> = {}): GovernorState {
  return {
    nudgeCountToday: 0,
    distressFlag: false,
    symptomSeverity: 0,
    lastEngagedAt: null,
    morningAnchorResponded: true,
    hoursSinceLastOpen: 1,
    selfLoggedTrackerToday: false,
    l3LastFiredAt: null,
    isWeekend: false,
    isStreakDay1: false,
    ...overrides,
  };
}

// A fixed weekday morning (Wed) and afternoon for deterministic time checks.
const MORNING = new Date('2026-06-24T08:00:00');
const AFTERNOON = new Date('2026-06-24T13:00:00');
const EVENING = new Date('2026-06-24T21:00:00');

function governorCases(): CaseResult[] {
  const cases: {
    name: string;
    nudge: typeof L1_001;
    slot: NudgeSlot;
    now: Date;
    state: GovernorState;
    expect: { allowed: boolean; suppressedBy?: string; reEngagementOnly?: boolean };
  }[] = [
    { name: 'allow (benign)', nudge: L1_001, slot: 'morning', now: MORNING, state: baseState(), expect: { allowed: true } },
    { name: 'SR-01 daily cap', nudge: L1_001, slot: 'morning', now: MORNING, state: baseState({ nudgeCountToday: 3 }), expect: { allowed: false, suppressedBy: 'SR-01' } },
    { name: 'SR-03 distress suppresses non-safety', nudge: L1_001, slot: 'morning', now: MORNING, state: baseState({ distressFlag: true }), expect: { allowed: false, suppressedBy: 'SR-03' } },
    { name: 'SR-03 safety allowed under distress', nudge: L3_007, slot: 'morning', now: MORNING, state: baseState({ distressFlag: true }), expect: { allowed: true } },
    { name: 'SR-08 48h inactivity', nudge: L1_001, slot: 'morning', now: MORNING, state: baseState({ hoursSinceLastOpen: 72 }), expect: { allowed: false, suppressedBy: 'SR-08', reEngagementOnly: true } },
    { name: 'SR-02 recent engagement', nudge: L1_001, slot: 'morning', now: MORNING, state: baseState({ lastEngagedAt: new Date(MORNING.getTime() - 10 * 60000) }), expect: { allowed: false, suppressedBy: 'SR-02' } },
    { name: 'SR-04 morning ignored -> afternoon', nudge: L1_004, slot: 'afternoon', now: AFTERNOON, state: baseState({ morningAnchorResponded: false }), expect: { allowed: false, suppressedBy: 'SR-04' } },
    { name: 'SR-07 weekend drops afternoon', nudge: L1_004, slot: 'afternoon', now: AFTERNOON, state: baseState({ isWeekend: true }), expect: { allowed: false, suppressedBy: 'SR-07' } },
    { name: 'SR-05 self-logged tracker', nudge: L1_001, slot: 'morning', now: MORNING, state: baseState({ selfLoggedTrackerToday: true }), expect: { allowed: false, suppressedBy: 'SR-05' } },
    { name: 'SR-09 L3 repeat within 3 days', nudge: L3_001, slot: 'evening', now: EVENING, state: baseState({ l3LastFiredAt: new Date(EVENING.getTime() - 24 * 3600000) }), expect: { allowed: false, suppressedBy: 'SR-09' } },
    { name: 'SR-06 streak day 1 evening', nudge: L1_005, slot: 'evening', now: EVENING, state: baseState({ isStreakDay1: true }), expect: { allowed: false, suppressedBy: 'SR-06' } },
  ];

  return cases.map((c) => {
    const got = evaluateGovernor(c.nudge, c.slot, c.now, c.state);
    const ok =
      got.allowed === c.expect.allowed &&
      (c.expect.suppressedBy === undefined || got.suppressedBy === c.expect.suppressedBy) &&
      (c.expect.reEngagementOnly === undefined || got.reEngagementOnly === c.expect.reEngagementOnly);
    return { group: 'governor', name: c.name, ok, expected: c.expect, got };
  });
}

function toneCases(): CaseResult[] {
  const cases: { name: string; nudgeId: string; answer: string; expect: string }[] = [
    { name: 'safety none-of-these -> RT-001', nudgeId: 'L3-007', answer: 'None of these', expect: 'RT-001' },
    { name: 'safety red flag -> RT-007', nudgeId: 'L3-007', answer: 'Chest pain', expect: 'RT-007' },
    { name: 'low adherence -> RT-002', nudgeId: 'L1-007', answer: 'I forgot', expect: 'RT-002' },
    { name: 'mood difficulty -> RT-003', nudgeId: 'L1-003', answer: 'Sad', expect: 'RT-003' },
    { name: 'uncertain -> RT-004', nudgeId: 'L1-003', answer: "I don't know", expect: 'RT-004' },
    { name: 'family low -> RT-005', nudgeId: 'L2-008', answer: 'I felt misunderstood', expect: 'RT-005' },
    { name: 'positive -> RT-001', nudgeId: 'L1-001', answer: 'I slept well', expect: 'RT-001' },
  ];
  return cases.map((c) => {
    const got = selectToneTemplate(c.nudgeId, c.answer).id;
    return { group: 'tone', name: c.name, ok: got === c.expect, expected: c.expect, got };
  });
}

function l2Cases(): CaseResult[] {
  const base = {
    nudgeCount: 0,
    morningResponded: true,
    stressOverwhelmed: false,
    poorSleep: false,
    lowEnergy: false,
    lowMood: false,
    dieticianAssigned: false,
  };
  const cases: { name: string; signals: typeof base; expect: { nudgeId: string | null; setDistress?: boolean; rotate?: boolean; suppressedBy?: string } }[] = [
    { name: 'SR-01 budget', signals: { ...base, nudgeCount: 3 }, expect: { nudgeId: null, suppressedBy: 'SR-01' } },
    { name: 'SR-04 morning ignored', signals: { ...base, morningResponded: false }, expect: { nudgeId: null, suppressedBy: 'SR-04' } },
    { name: 'overwhelmed -> L2-003 + distress', signals: { ...base, stressOverwhelmed: true }, expect: { nudgeId: 'L2-003', setDistress: true } },
    { name: 'poor sleep -> L2-003', signals: { ...base, poorSleep: true }, expect: { nudgeId: 'L2-003' } },
    { name: 'low energy -> L2-003', signals: { ...base, lowEnergy: true }, expect: { nudgeId: 'L2-003' } },
    { name: 'low mood + dietician -> L2-002', signals: { ...base, lowMood: true, dieticianAssigned: true }, expect: { nudgeId: 'L2-002' } },
    { name: 'low mood, no dietician -> rotate', signals: { ...base, lowMood: true }, expect: { nudgeId: null, rotate: true } },
    { name: 'benign -> rotate', signals: { ...base }, expect: { nudgeId: null, rotate: true } },
  ];
  return cases.map((c) => {
    const got = decideL2(c.signals);
    const ok =
      got.nudgeId === c.expect.nudgeId &&
      (c.expect.setDistress === undefined || got.setDistress === c.expect.setDistress) &&
      (c.expect.rotate === undefined || (got.rotate ?? false) === c.expect.rotate) &&
      (c.expect.suppressedBy === undefined || got.suppressedReason === c.expect.suppressedBy);
    return { group: 'selectL2', name: c.name, ok, expected: c.expect, got };
  });
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
