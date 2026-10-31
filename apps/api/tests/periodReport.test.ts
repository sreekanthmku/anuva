import { describe, expect, it } from 'vitest';
import zlib from 'node:zlib';
import type { ReportRing, WeeklyReportResponse } from '@anuva/shared';
import { periodReportPdf, periodReportTier } from '../src/periodReport/tier.js';
import { periodReportFilename, renderPeriodReportPdf } from '../src/periodReport/render.js';

describe('periodReportTier', () => {
  it('weekly: 0–3 insufficient, 4–5 limited, 6–7 full', () => {
    expect([0, 1, 2, 3].map((d) => periodReportTier('weekly', d))).toEqual(Array(4).fill('insufficient'));
    expect([4, 5].map((d) => periodReportTier('weekly', d))).toEqual(['limited', 'limited']);
    expect([6, 7].map((d) => periodReportTier('weekly', d))).toEqual(['full', 'full']);
  });

  it('monthly: 0–14 insufficient, 15–23 preliminary, 24+ full', () => {
    expect(periodReportTier('monthly', 14)).toBe('insufficient');
    expect(periodReportTier('monthly', 15)).toBe('limited');
    expect(periodReportTier('monthly', 23)).toBe('limited');
    expect(periodReportTier('monthly', 24)).toBe('full');
    expect(periodReportTier('monthly', 31)).toBe('full');
  });
});

describe('periodReportPdf', () => {
  it('offers no report on daily or for the period still in progress', () => {
    expect(periodReportPdf('daily', 1, 7)).toBeNull();
    expect(periodReportPdf('weekly', 0, 7)).toBeNull();
    expect(periodReportPdf('monthly', 0, 30)).toBeNull();
  });

  it('offers completed weeks and months with their thresholds', () => {
    expect(periodReportPdf('weekly', 1, 5)).toEqual({ tier: 'limited', minDays: 4, fullDays: 6 });
    expect(periodReportPdf('monthly', 3, 10)).toEqual({ tier: 'insufficient', minDays: 15, fullDays: 24 });
  });
});

function ring(key: ReportRing['key'], label: string, tone: ReportRing['deltaTone'], delta: string): ReportRing {
  return {
    key, label, pct: 64, band: 'Manageable', detail: null, delta, deltaTone: tone, deltaValue: 8,
    reference: null, daysLogged: 6, symptomDays: 2, series: [60, 70, null, 55, 64, 72, 68],
  };
}

function summary(over: Partial<WeeklyReportResponse> = {}): WeeklyReportResponse {
  return {
    period: 'weekly', offset: 1,
    periodStart: '2026-10-19', periodEnd: '2026-10-25',
    coverageStart: '2026-10-19', coverageEnd: '2026-10-25',
    seriesStart: '2026-10-19', seriesCoverageStart: '2026-10-19',
    canGoBack: true, canGoForward: true, calibrating: false,
    daysLogged: 6, daysElapsed: 7, periodLength: 7, daysElapsedInPeriod: 7,
    trackingLabel: '6 of 7 days tracked', trackingNote: null, dataState: 'ready',
    referenceNote: 'Dots show last week.',
    headline: { score: 66, band: 'Good', headline: 'A steady week', body: 'Sleep carried the week; mood dipped midweek.' },
    dayBalance: { good: 3, okay: 2, hard: 1, untracked: 1 },
    glance: [],
    suggestion: null,
    rings: [
      ring('sleep', 'Sleep quality', 'positive', '+12 pts · improving'),
      ring('mood', 'Mood stability', 'attention', '−9 pts · lower'),
      ring('energy', 'Energy', 'neutral', 'Steady'),
    ],
    stats: [{ key: 'wellness', label: 'Wellness', value: '66', unit: '/100', trend: [62, 71, null, 48, 66, 79, 70], seriesNote: '' }],
    insights: [{ tone: 'positive', title: 'Sleep is improving', body: 'You slept better on five of six logged nights.' }],
    joints: null,
    weekBreakdown: [],
    anuReflection: 'You kept showing up for yourself this week — that consistency is what makes these patterns visible.',
    pdf: { tier: 'full', minDays: 4, fullDays: 6 },
    ...over,
  };
}

/** The text actually drawn, from the PDF's content streams. Hex-encoded by PDFKit. */
function drawnText(pdf: Buffer): string {
  const raw = pdf.toString('latin1');
  let text = '';
  for (const match of raw.matchAll(/stream\r?\n([\s\S]*?)\r?\nendstream/g)) {
    let content: string;
    try {
      content = zlib.inflateSync(Buffer.from(match[1]!, 'latin1')).toString('latin1');
    } catch {
      continue;
    }
    for (const hex of content.matchAll(/<([0-9a-fA-F]+)>/g)) {
      text += Buffer.from(hex[1]!, 'hex').toString('latin1');
    }
  }
  return text;
}

describe('renderPeriodReportPdf', () => {
  it('draws a full weekly report: the page’s cards, no limited flag', async () => {
    const pdf = await renderPeriodReportPdf(summary(), new Date('2026-10-26T09:00:00+05:30'));
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
    const text = drawnText(pdf);
    expect(text).toContain('Your week in review');
    expect(text).toContain('DAY BALANCE');
    expect(text).toContain('Sleep quality');
    expect(text).toContain('Sleep is improving');
    expect(text).not.toContain('LOW CONFIDENCE');
  });

  it('flags a limited week as low confidence', async () => {
    const text = drawnText(
      await renderPeriodReportPdf(summary({ daysLogged: 4, pdf: { tier: 'limited', minDays: 4, fullDays: 6 } })),
    );
    expect(text).toContain('LIMITED REPORT');
    expect(text).toContain('Based on 4 of 7 days logged.');
  });

  it('draws a preliminary monthly report with its headline, tiles and weekly bars', async () => {
    const month = summary({
      period: 'monthly',
      periodStart: '2026-09-01', periodEnd: '2026-09-30', periodLength: 30, daysLogged: 18,
      trackingLabel: '18 of 30 days tracked',
      glance: [
        { key: 'strongest', eyebrow: 'Strongest area', label: 'Sleep quality', value: '+18 pts', note: 'vs last month', ringKey: 'sleep', tone: 'positive' },
        { key: 'tracked', eyebrow: 'Tracked days', label: '18 of 30', value: null, note: 'this month', ringKey: null, tone: 'info' },
      ],
      weekBreakdown: [
        { startDate: '2026-09-01', endDate: '2026-09-06', wellness: 58, daysLogged: 4 },
        { startDate: '2026-09-07', endDate: '2026-09-13', wellness: null, daysLogged: 0 },
        { startDate: '2026-09-14', endDate: '2026-09-20', wellness: 71, daysLogged: 6 },
      ],
      pdf: { tier: 'limited', minDays: 15, fullDays: 24 },
    });
    const text = drawnText(await renderPeriodReportPdf(month));
    expect(text).toContain('Your month in review');
    expect(text).toContain('PRELIMINARY REPORT');
    expect(text).toContain('A steady week');
    expect(text).toContain('STRONGEST AREA');
    expect(text).toContain('HOW YOUR MONTH LOOKED');
  });

  it('names the file by period and start date', () => {
    expect(periodReportFilename(summary())).toBe('anuva-weekly-report-2026-10-19.pdf');
  });
});
