import { describe, expect, it } from 'vitest';
import type { SummaryWeekBreakdown } from '@anuva/shared';
import { weekAxisLabels, weeklyMeans } from '../src/features/core/summaryAggregate';

/** Mon-Sun weeks clamped to June 2024, as the API builds them. */
const JUNE_WEEKS: SummaryWeekBreakdown[] = [
  { startDate: '2024-06-01', endDate: '2024-06-02', wellness: null, daysLogged: 0 },
  { startDate: '2024-06-03', endDate: '2024-06-09', wellness: null, daysLogged: 0 },
  { startDate: '2024-06-10', endDate: '2024-06-16', wellness: null, daysLogged: 0 },
];

describe('weeklyMeans', () => {
  it('averages each week over the days it actually holds', () => {
    // 1 June onwards, one value per day.
    const values = [
      60, 80, // Sat 1, Sun 2 -> partial first week
      10, 20, 30, 40, 50, 60, 70, // Mon 3 - Sun 9
      100, 100, 100, 100, 100, 100, 100, // Mon 10 - Sun 16
    ];

    expect(weeklyMeans(values, '2024-06-01', JUNE_WEEKS)).toEqual([70, 40, 100]);
  });

  it('ignores unlogged days rather than counting them as zero', () => {
    const values = [null, 80, ...Array(7).fill(null), 50, null, null, null, null, null, null];

    expect(weeklyMeans(values, '2024-06-01', JUNE_WEEKS)).toEqual([80, null, 50]);
  });

  it('returns null for a week with nothing in it, so the line breaks', () => {
    const values = Array(16).fill(null);

    expect(weeklyMeans(values, '2024-06-01', JUNE_WEEKS)).toEqual([null, null, null]);
  });

  it('leaves days outside every bucket out of the means', () => {
    // Series starts a week before the month; those columns belong to no week.
    const values = [0, 0, 0, 0, 0, 0, 0, 90, 90];

    expect(weeklyMeans(values, '2024-05-25', JUNE_WEEKS)).toEqual([90, null, null]);
  });

  it('labels the weeks in order', () => {
    expect(weekAxisLabels(JUNE_WEEKS)).toEqual(['W1', 'W2', 'W3']);
  });
});
