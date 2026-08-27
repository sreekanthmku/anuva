/**
 * The gate decision. Pure, and deliberately so: whether the blocking dialog is open is the one
 * thing in this feature the client must never compute, and the rule is small enough to pin exactly.
 *
 * The prisma mock exists only because invites.ts imports the client at module load; none of these
 * tests touch it.
 */

import { describe, expect, it, vi } from 'vitest';

vi.mock('@anuva/database', () => ({ prisma: {} }));

process.env.FAMILY_INVITE_SECRET = 'test-secret-of-at-least-32-characters-long';

const { computeGate } = await import('../src/family/invites.js');

const NOW = new Date(2026, 7, 27, 10, 0, 0);
const ready = { optedOut: false, onboardingCompleted: true, hasMember: false };

function minutesAgo(minutes: number): Date {
  return new Date(NOW.getTime() - minutes * 60 * 1000);
}

describe('computeGate', () => {
  it('opens for a woman past onboarding who has never shared', () => {
    expect(computeGate({ ...ready, sharedAt: null }, NOW)).toEqual({
      mustShare: true,
      repromptAfterSeconds: null,
    });
  });

  it('closes for the grace window right after a share, and reports the countdown', () => {
    const gate = computeGate({ ...ready, sharedAt: minutesAgo(1) }, NOW);
    expect(gate.mustShare).toBe(false);
    // Default window is 7 minutes, so ~6 remain.
    expect(gate.repromptAfterSeconds).toBeGreaterThan(5 * 60);
    expect(gate.repromptAfterSeconds).toBeLessThanOrEqual(6 * 60);
  });

  it('re-opens once the window lapses', () => {
    expect(computeGate({ ...ready, sharedAt: minutesAgo(60) }, NOW)).toEqual({
      mustShare: true,
      repromptAfterSeconds: null,
    });
  });

  it('re-opens exactly at the boundary rather than hanging on zero', () => {
    // 7 minutes is the configured window: at the boundary there is nothing left to wait for.
    expect(computeGate({ ...ready, sharedAt: minutesAgo(7) }, NOW)).toEqual({
      mustShare: true,
      repromptAfterSeconds: null,
    });
  });

  it('never opens once a family member has joined', () => {
    for (const sharedAt of [null, minutesAgo(1), minutesAgo(600)]) {
      expect(computeGate({ ...ready, hasMember: true, sharedAt }, NOW)).toEqual({
        mustShare: false,
        repromptAfterSeconds: null,
      });
    }
  });

  it('never opens for an opted-out account — the only relief from a blocking gate', () => {
    expect(computeGate({ ...ready, optedOut: true, sharedAt: null }, NOW)).toEqual({
      mustShare: false,
      repromptAfterSeconds: null,
    });
  });

  it('never opens before onboarding is finished, so it cannot precede the assessment', () => {
    expect(computeGate({ ...ready, onboardingCompleted: false, sharedAt: null }, NOW)).toEqual({
      mustShare: false,
      repromptAfterSeconds: null,
    });
  });

  it('treats a future sharedAt as still inside the window rather than crashing', () => {
    // Clock skew between the API host and Postgres should not produce a negative countdown.
    const gate = computeGate({ ...ready, sharedAt: new Date(NOW.getTime() + 30_000) }, NOW);
    expect(gate.mustShare).toBe(false);
    expect(gate.repromptAfterSeconds).toBeGreaterThan(0);
  });
});
