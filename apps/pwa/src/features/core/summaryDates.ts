import type { WeeklyReportResponse } from '@anuva/shared';

/**
 * The API returns plain ISO days. Formatting lives on the client so it follows
 * the device locale and timezone rather than the server's.
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
  return parseIso(iso).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

export function formatShortDay(iso: string): string {
  return parseIso(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function formatRange(startIso: string, endIso: string): string {
  if (startIso === endIso) return formatShortDay(startIso);
  const start = parseIso(startIso);
  const end = parseIso(endIso);
  const month = (d: Date) => d.toLocaleDateString(undefined, { month: 'short' });
  return start.getMonth() === end.getMonth()
    ? `${month(start)} ${start.getDate()} – ${end.getDate()}`
    : `${month(start)} ${start.getDate()} – ${month(end)} ${end.getDate()}`;
}

export function formatMonth(iso: string): string {
  return parseIso(iso).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

/** Headline for the window — relative wording where it reads better than a date. */
export function periodHeadline(data: WeeklyReportResponse): string {
  if (data.period === 'daily') {
    if (data.offset === 0) return 'Today';
    if (data.offset === 1) return 'Yesterday';
    return formatDay(data.periodStart);
  }
  if (data.period === 'weekly') {
    if (data.offset === 0) return 'This week';
    if (data.offset === 1) return 'Last week';
    return formatRange(data.periodStart, data.periodEnd);
  }
  return data.offset === 0 ? 'This month' : formatMonth(data.periodStart);
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
    ? `${base} · your data from ${formatShortDay(data.coverageStart)}`
    : base;
}

export const PERIOD_NOUN: Record<WeeklyReportResponse['period'], string> = {
  daily: 'day',
  weekly: 'week',
  monthly: 'month',
};
