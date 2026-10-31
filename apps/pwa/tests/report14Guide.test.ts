import { describe, expect, it } from 'vitest';
import { shouldGuideToReport14 } from '../src/features/core/report14Guide';

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
