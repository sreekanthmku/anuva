import type { WeeklyReportResponse } from '@anuva/shared';
// The instance rather than the hook: these are pure helpers, not components.
import i18n from '../../i18n';

/**
 * The API returns plain ISO days. Formatting lives on the client so it follows
 * the *chosen language* and the device timezone rather than the server's. The
 * language, not the device locale: a Telugu screen with English month names reads
 * as half-translated.
 */

export function parseIso(iso: string): Date {
  return new Date(`${iso}T00:00:00`);
}

export function addDaysIso(iso: string, days: number): Date {
  const d = parseIso(iso);
  d.setDate(d.getDate() + days);
  return d;
}

/** Inclusive day count from `startIso` to `endIso`; 0 when end precedes start. */
export function daysBetweenIso(startIso: string, endIso: string): number {
  const start = parseIso(startIso);
  const end = parseIso(endIso);
  const toDayNumber = (d: Date) =>
    Math.round(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86_400_000);
  return Math.max(0, toDayNumber(end) - toDayNumber(start) + 1);
}

export function formatDay(iso: string): string {
  return parseIso(iso).toLocaleDateString(i18n.language, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

export function formatShortDay(iso: string): string {
  return parseIso(iso).toLocaleDateString(i18n.language, { month: 'short', day: 'numeric' });
}

/**
 * `formatShortDay` for the day `offset` days after `startIso` — the form charts
 * need for axis ticks. Formats the local Date directly rather than round-tripping
 * through `toISOString()`, which shifts the day for any timezone ahead of UTC.
 */
export function formatShortDayFrom(startIso: string, offset: number): string {
  return addDaysIso(startIso, offset).toLocaleDateString(i18n.language, {
    month: 'short',
    day: 'numeric',
  });
}

/** "Mon" — the weekday axis a seven-column chart wants. */
export function formatWeekdayFrom(startIso: string, offset: number): string {
  return addDaysIso(startIso, offset).toLocaleDateString(i18n.language, { weekday: 'short' });
}

export function formatRange(startIso: string, endIso: string): string {
  if (startIso === endIso) return formatShortDay(startIso);
  const start = parseIso(startIso);
  const end = parseIso(endIso);
  const month = (d: Date) => d.toLocaleDateString(i18n.language, { month: 'short' });
  return start.getMonth() === end.getMonth()
    ? i18n.t('summary.rangeSameMonth', {
        month: month(start),
        from: start.getDate(),
        to: end.getDate(),
      })
    : i18n.t('summary.rangeCrossMonth', {
        fromMonth: month(start),
        from: start.getDate(),
        toMonth: month(end),
        to: end.getDate(),
      });
}

export function formatMonth(iso: string): string {
  return parseIso(iso).toLocaleDateString(i18n.language, { month: 'long', year: 'numeric' });
}

/** Headline for the window — relative wording where it reads better than a date. */
export function periodHeadline(data: WeeklyReportResponse): string {
  if (data.period === 'daily') {
    if (data.offset === 0) return i18n.t('summary.today');
    if (data.offset === 1) return i18n.t('summary.yesterday');
    return formatDay(data.periodStart);
  }
  if (data.period === 'weekly') {
    if (data.offset === 0) return i18n.t('summary.thisWeek');
    if (data.offset === 1) return i18n.t('summary.lastWeek');
    return formatRange(data.periodStart, data.periodEnd);
  }
  return data.offset === 0 ? i18n.t('summary.thisMonth') : formatMonth(data.periodStart);
}

/** The concrete dates behind the headline, plus a note when the user joined mid-period. */
export function periodDetail(data: WeeklyReportResponse): string {
  const base =
    data.period === 'daily'
      ? formatDay(data.periodStart)
      : data.period === 'weekly'
        ? formatRange(data.periodStart, data.periodEnd)
        : formatMonth(data.periodStart);

  return data.coverageStart !== data.periodStart
    ? i18n.t('summary.detailWithCoverage', {
        base,
        from: formatShortDay(data.coverageStart),
      })
    : base;
}

/** "day" / "week" / "month" — the noun the report drops into its own sentences. */
export function periodNoun(period: WeeklyReportResponse['period']): string {
  return i18n.t(`summary.periodNoun.${period}`);
}
