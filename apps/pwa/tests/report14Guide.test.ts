import { describe, expect, it } from 'vitest';
import {
  isReport14Available,
  report14ReadyDate,
  shouldGuideToReport14,
} from '../src/features/core/report14Guide';

// Trial started 1 Aug: days 1–14 are 1–14 Aug, and the report is ready on the 15th.
const base = {
  subscriptionStartedAt: '2026-08-01T09:00:00',
  createdAt: '2026-07-30T09:00:00',
  detailedAssessmentStatus: 'completed' as const,
  report14OpenedAt: null,
};

describe('shouldGuideToReport14', () => {
  it('guides her on day 15', () => {
    expect(shouldGuideToReport14(base, new Date('2026-08-15T08:00:00'))).toBe(true);
  });

  it('waits through day 14', () => {
    expect(shouldGuideToReport14(base, new Date('2026-08-14T23:00:00'))).toBe(false);
  });

  it('keeps guiding after day 15 until she opens it', () => {
    expect(shouldGuideToReport14(base, new Date('2026-09-20T08:00:00'))).toBe(true);
  });

  it('stops once she has opened it, from Home or from Profile', () => {
    expect(
      shouldGuideToReport14(
        { ...base, report14OpenedAt: '2026-08-15T08:05:00.000Z' },
        new Date('2026-08-16T08:00:00'),
      ),
    ).toBe(false);
  });

  it('does not guide her before her detailed assessment is complete', () => {
    for (const status of ['not_started', 'in_progress'] as const) {
      expect(
        shouldGuideToReport14(
          { ...base, detailedAssessmentStatus: status },
          new Date('2026-08-20T08:00:00'),
        ),
      ).toBe(false);
    }
  });

  it('counts from signup when she has no trial', () => {
    const noTrial = { ...base, subscriptionStartedAt: null };
    expect(shouldGuideToReport14(noTrial, new Date('2026-08-12T08:00:00'))).toBe(false);
    expect(shouldGuideToReport14(noTrial, new Date('2026-08-13T08:00:00'))).toBe(true);
  });

  it('does nothing without a user', () => {
    expect(shouldGuideToReport14(null)).toBe(false);
  });
});

describe('isReport14Available', () => {
  // Profile and the report page use this; same day 15 as Home's guide.
  it('is closed through day 14 and open from day 15', () => {
    expect(isReport14Available(base, new Date('2026-08-14T23:00:00'))).toBe(false);
    expect(isReport14Available(base, new Date('2026-08-15T00:30:00'))).toBe(true);
  });

  it('does not wait for the assessment or for a first opening', () => {
    expect(
      isReport14Available(
        { ...base, detailedAssessmentStatus: 'in_progress' as const, report14OpenedAt: '2026-08-15T08:05:00.000Z' },
        new Date('2026-08-20T08:00:00'),
      ),
    ).toBe(true);
  });

  it('is closed with nothing to count from', () => {
    expect(isReport14Available(null)).toBe(false);
  });
});

describe('report14ReadyDate', () => {
  it('is local midnight starting day 15', () => {
    const ready = report14ReadyDate(base);
    expect(ready?.getFullYear()).toBe(2026);
    expect(ready?.getMonth()).toBe(7);
    expect(ready?.getDate()).toBe(15);
    expect(ready?.getHours()).toBe(0);
  });

  it('counts from sign-up when no trial has started', () => {
    expect(report14ReadyDate({ subscriptionStartedAt: null, createdAt: '2026-07-30T09:00:00' })?.getDate()).toBe(13);
  });

  it('is null with nothing to count from', () => {
    expect(report14ReadyDate(null)).toBeNull();
  });
});
