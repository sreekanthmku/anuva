import type { SummaryWeekBreakdown } from '@anuva/shared';
import { addDaysIso, parseIso } from './summaryDates';

/**
 * Fold a per-day score series into one point per week.
 *
 * The monthly view plots weeks, not days: thirty-one columns in a phone-width
 * card is a smear, and nobody reads a month one Tuesday at a time. The weeks
 * come from the API's `weekBreakdown`, so the chart's buckets are the same
 * Mon-Sun weeks (clamped to the month) that every other monthly number uses.
 *
 * Mean, never sum — every series this runs on is a 0-100 score, and the mean of
 * a week's logged days is what "how was that week" means. The one series on the
 * page that aggregates by *sum* is the hot-flash count, and the monthly view
 * deliberately does not chart it.
 *
 * A week with nothing logged comes back null rather than 0, so the chart breaks
 * its line there instead of drawing a crash.
 */
export function weeklyMeans(
  values: (number | null)[],
  seriesStart: string,
  weeks: SummaryWeekBreakdown[]
): (number | null)[] {
  return weeks.map((week) => {
    const from = parseIso(week.startDate).getTime();
    const to = parseIso(week.endDate).getTime();

    const logged: number[] = [];
    values.forEach((value, index) => {
      if (value == null) return;
      const day = addDaysIso(seriesStart, index).getTime();
      if (day >= from && day <= to) logged.push(value);
    });

    if (logged.length === 0) return null;
    return logged.reduce((sum, v) => sum + v, 0) / logged.length;
  });
}

/** "W1", "W2" … — short enough for an axis that has five of them. */
export function weekAxisLabels(weeks: SummaryWeekBreakdown[]): string[] {
  return weeks.map((_, i) => `W${i + 1}`);
}
