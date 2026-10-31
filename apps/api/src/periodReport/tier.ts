/**
 * Weekly and monthly reports: how many logged days a completed period needs.
 *
 *   Week:  0–3 days insufficient (tracking reminder), 4–5 limited (low confidence), 6–7 full.
 *   Month: 0–14 days insufficient, 15–23 preliminary (shown as limited), 24+ full.
 *
 * Separate from the 14-day assessment report (`../report14`), which is a one-off personalised
 * document; these recur every week and month and describe exactly what the summary page shows.
 */

import type { PeriodReportPdf, PeriodReportTier, SummaryPeriod } from '@anuva/shared';

type ReportPeriod = Exclude<SummaryPeriod, 'daily'>;

export const PERIOD_REPORT_DAYS: Record<ReportPeriod, { minDays: number; fullDays: number }> = {
  weekly: { minDays: 4, fullDays: 6 },
  monthly: { minDays: 15, fullDays: 24 },
};

export function periodReportTier(period: ReportPeriod, daysLogged: number): PeriodReportTier {
  const { minDays, fullDays } = PERIOD_REPORT_DAYS[period];
  if (daysLogged >= fullDays) return 'full';
  if (daysLogged >= minDays) return 'limited';
  return 'insufficient';
}

/**
 * The PDF a summary window offers: none on daily, none for the period still in progress (offset
 * 0) — only a completed week or month has a report.
 */
export function periodReportPdf(
  period: SummaryPeriod,
  offset: number,
  daysLogged: number,
): PeriodReportPdf | null {
  if (period === 'daily' || offset < 1) return null;
  return { tier: periodReportTier(period, daysLogged), ...PERIOD_REPORT_DAYS[period] };
}
