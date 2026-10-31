/**
 * Weekly and monthly report PDFs.
 *
 * The content is the summary page's own response for that week or month (`buildSummary`), drawn
 * card by card in the order the page shows them, so the PDF says exactly what she saw on screen.
 * Only the look is borrowed from the 14-day assessment report (`../pdf/brand.ts`): logo, palette,
 * type. English only, like that report: PDFKit's built-in fonts have no Indic glyphs.
 *
 * Not cached: a summary is a handful of short blocks and renders in milliseconds, and recomputing
 * means a late log for a past week is always in the download.
 */

import PDFDocument from 'pdfkit';
import type { ReportRing, WeeklyReportResponse } from '@anuva/shared';
import {
  drawPageHeader,
  GOLD,
  INK,
  INK_SOFT,
  openLogo,
  PAGE_MARGIN,
  PLUM,
  ROSE,
  RULE,
  SANS,
  SANS_BOLD,
  SERIF,
  SERIF_BOLD,
} from '../pdf/brand.js';

/** The summary page's gauge ladder, worst to best (`GAUGE_BANDS` in the PWA). */
const GAUGE_BANDS = ['#E23B2E', '#F5871F', '#F2C023', '#8CC63F', '#3E9B33'] as const;
const EMPTY = '#D9CDD6';
const BAND_WORDS = ['Very hard', 'Hard', 'Okay', 'Good', 'Great'] as const;
const TONE_COLOR = { positive: PLUM, attention: '#C0405A', neutral: '#5C4A66' } as const;
const PANEL_FILL = '#F7F0E8';

function gaugeColor(score: number | null): string {
  if (score == null) return EMPTY;
  const clamped = Math.min(Math.max(score, 0), 100);
  return GAUGE_BANDS[Math.min(GAUGE_BANDS.length - 1, Math.floor((clamped / 100) * GAUGE_BANDS.length))]!;
}

/**
 * Helvetica and Times here are WinAnsi: anything outside it prints as a wrong glyph. The copy is
 * English, so this only ever meets typographic punctuation and the odd symbol; the punctuation
 * WinAnsi has passes through, a minus becomes a hyphen, and anything else is dropped rather than
 * printed as noise.
 */
const WINANSI_EXTRA = new Set('€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ');
function pdfSafe(text: string): string {
  let out = '';
  for (const ch of text.replace(/−/g, '-')) {
    if (ch.codePointAt(0)! <= 0xff || WINANSI_EXTRA.has(ch)) out += ch;
  }
  return out.replace(/ {2,}/g, ' ').trim();
}

function parseIso(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y!, m! - 1, d!);
}

function dayMonth(iso: string): string {
  return parseIso(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

function addDaysIso(iso: string, days: number): Date {
  const d = parseIso(iso);
  d.setDate(d.getDate() + days);
  return d;
}

/** "20–26 Oct 2026" for a week; "October 2026" for a month. */
function periodLabel(report: WeeklyReportResponse): string {
  const start = parseIso(report.periodStart);
  const end = parseIso(report.periodEnd);
  if (report.period === 'monthly') {
    return start.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
  }
  const year = end.getFullYear();
  return start.getMonth() === end.getMonth()
    ? `${start.getDate()}–${end.getDate()} ${end.toLocaleDateString('en-IN', { month: 'short' })} ${year}`
    : `${dayMonth(report.periodStart)} – ${dayMonth(report.periodEnd)} ${year}`;
}

interface Ctx {
  doc: PDFKit.PDFDocument;
  width: number;
}

function bottom(ctx: Ctx): number {
  return ctx.doc.page.height - PAGE_MARGIN;
}

/** Starts a new page when `height` would not fit, so a card is never split across two. */
function ensureSpace(ctx: Ctx, height: number): void {
  if (ctx.doc.y + height > bottom(ctx)) ctx.doc.addPage();
}

function hr(ctx: Ctx, gapBefore = 12, gapAfter = 14): void {
  const { doc, width } = ctx;
  const y = doc.y + gapBefore;
  doc.save().moveTo(PAGE_MARGIN, y).lineTo(PAGE_MARGIN + width, y).lineWidth(0.5).strokeColor(RULE).stroke().restore();
  doc.x = PAGE_MARGIN;
  doc.y = y + gapAfter;
}

function eyebrow(ctx: Ctx, text: string, color: string = GOLD): void {
  ctx.doc
    .font(SANS_BOLD)
    .fontSize(7.5)
    .fillColor(color)
    .text(pdfSafe(text).toUpperCase(), PAGE_MARGIN, ctx.doc.y, { characterSpacing: 1.1, width: ctx.width });
  ctx.doc.moveDown(0.45);
}

/** A card's heading: page-break first, so a heading never sits alone at the foot of a page. */
function section(ctx: Ctx, title: string, minBody = 80): void {
  ensureSpace(ctx, 30 + minBody);
  ctx.doc.moveDown(0.45);
  eyebrow(ctx, title);
}

function body(ctx: Ctx, text: string, opts: { color?: string; size?: number; font?: string } = {}): void {
  ctx.doc
    .font(opts.font ?? SANS)
    .fontSize(opts.size ?? 9.8)
    .fillColor(opts.color ?? INK)
    .text(pdfSafe(text), PAGE_MARGIN, ctx.doc.y, { width: ctx.width, lineGap: 2.2 });
}

/** A note on a tinted panel: the limited/preliminary flag, the calibration note. */
function panel(ctx: Ctx, label: string, text: string, accent: string = GOLD): void {
  const { doc, width } = ctx;
  const pad = 12;
  const innerWidth = width - pad * 2 - 3;
  doc.font(SANS).fontSize(9.2);
  const textHeight = doc.heightOfString(pdfSafe(text), { width: innerWidth, lineGap: 2 });
  const height = pad + 11 + textHeight + pad;
  ensureSpace(ctx, height + 8);
  const top = doc.y;
  doc.save().rect(PAGE_MARGIN, top, width, height).fill(PANEL_FILL).restore();
  doc.save().rect(PAGE_MARGIN, top, 3, height).fill(accent).restore();
  doc
    .font(SANS_BOLD)
    .fontSize(7.5)
    .fillColor(accent)
    .text(pdfSafe(label).toUpperCase(), PAGE_MARGIN + pad + 3, top + pad, { characterSpacing: 1, width: innerWidth });
  doc
    .font(SANS)
    .fontSize(9.2)
    .fillColor(INK)
    .text(pdfSafe(text), PAGE_MARGIN + pad + 3, top + pad + 11, { width: innerWidth, lineGap: 2 });
  doc.x = PAGE_MARGIN;
  doc.y = top + height + 8;
}

// ── Cards ────────────────────────────────────────────────────

function tierPanel(ctx: Ctx, report: WeeklyReportResponse): void {
  const pdf = report.pdf;
  if (!pdf || pdf.tier !== 'limited') return;
  const days = `Based on ${report.daysLogged} of ${report.periodLength} days logged.`;
  if (report.period === 'weekly') {
    panel(
      ctx,
      'Limited report · low confidence',
      `${days} With fewer than ${pdf.fullDays} days, read what follows as early signs rather than firm trends.`,
      ROSE,
    );
  } else {
    panel(
      ctx,
      'Preliminary report',
      `${days} A full monthly report needs ${pdf.fullDays} days, so some of the patterns below may change as more days are tracked.`,
      ROSE,
    );
  }
}

function headlineCard(ctx: Ctx, report: WeeklyReportResponse): void {
  const { doc } = ctx;
  const { headline } = report;
  section(ctx, 'How your month went');
  doc.font(SERIF_BOLD).fontSize(17).fillColor(INK).text(pdfSafe(headline.headline), PAGE_MARGIN, doc.y, { width: ctx.width });
  doc.moveDown(0.3);
  body(ctx, headline.body, { color: INK_SOFT });
  if (headline.score != null) {
    doc.moveDown(0.4);
    doc
      .font(SANS_BOLD)
      .fontSize(11)
      .fillColor(gaugeColor(headline.score))
      .text(`${Math.round(headline.score)}/100${headline.band ? `  ·  ${headline.band}` : ''}`, PAGE_MARGIN, doc.y);
  }
}

function dayBalance(ctx: Ctx, report: WeeklyReportResponse): void {
  const { doc, width } = ctx;
  section(ctx, 'Day balance', 60);
  const { good, okay, hard, untracked } = report.dayBalance;
  const columns = [
    { count: good, one: 'Good day', other: 'Good days', color: GAUGE_BANDS[4] },
    { count: okay, one: 'Okay day', other: 'Okay days', color: GAUGE_BANDS[2] },
    { count: hard, one: 'Hard day', other: 'Hard days', color: GAUGE_BANDS[1] },
    { count: untracked, one: 'Untracked day', other: 'Untracked days', color: EMPTY },
  ];
  const top = doc.y;
  const gap = 8;
  const colWidth = (width - gap * 3) / 4;
  columns.forEach((col, i) => {
    const x = PAGE_MARGIN + i * (colWidth + gap);
    doc.save().roundedRect(x, top, colWidth, 52, 6).lineWidth(0.6).strokeColor(RULE).stroke().restore();
    doc.save().circle(x + 12, top + 15, 3.2).fill(col.color).restore();
    doc.font(SERIF_BOLD).fontSize(18).fillColor(INK).text(String(col.count), x + 20, top + 6, { width: colWidth - 26 });
    doc
      .font(SANS)
      .fontSize(8)
      .fillColor(INK_SOFT)
      .text(col.count === 1 ? col.one : col.other, x + 10, top + 32, { width: colWidth - 16 });
  });
  doc.x = PAGE_MARGIN;
  doc.y = top + 52 + 6;
  body(ctx, report.trackingLabel, { color: INK_SOFT, size: 8.5 });
}

/**
 * The wellness trend as bars on the five-band ladder: a day per bar on a week, a week per bar on a
 * month (the page's own choice — thirty-one columns is a smear). An unlogged column is a dash on
 * the baseline, never a zero.
 */
function trendChart(ctx: Ctx, report: WeeklyReportResponse): void {
  const { doc, width } = ctx;
  const isMonthly = report.period === 'monthly';
  section(ctx, isMonthly ? 'How your month looked' : 'How your week looked', 175);

  const points = isMonthly
    ? report.weekBreakdown.map((week) => ({
        label:
          week.startDate === week.endDate
            ? dayMonth(week.startDate)
            : `${parseIso(week.startDate).getDate()}–${dayMonth(week.endDate)}`,
        value: week.wellness,
      }))
    : (report.stats.find((s) => s.key === 'wellness')?.trend ?? []).map((value, i) => ({
        label: addDaysIso(report.seriesStart, i).toLocaleDateString('en-IN', { weekday: 'short' }),
        value,
      }));

  const gutter = 52;
  const plotHeight = 110;
  const plotLeft = PAGE_MARGIN + gutter;
  const plotWidth = width - gutter;
  const top = doc.y + 4;
  const base = top + plotHeight;
  const yFor = (score: number) => base - (score / 100) * plotHeight;

  // Band words down the side, gridlines between bands.
  BAND_WORDS.forEach((word, i) => {
    doc
      .font(SANS)
      .fontSize(7)
      .fillColor(INK_SOFT)
      .text(word, PAGE_MARGIN, yFor(i * 20 + 10) - 4, { width: gutter - 6, align: 'right' });
  });
  for (let score = 0; score <= 100; score += 20) {
    doc.save().moveTo(plotLeft, yFor(score)).lineTo(plotLeft + plotWidth, yFor(score)).lineWidth(0.4).strokeColor(RULE).stroke().restore();
  }

  const slot = plotWidth / Math.max(points.length, 1);
  const barWidth = Math.min(28, slot * 0.55);
  points.forEach((point, i) => {
    const cx = plotLeft + slot * (i + 0.5);
    if (point.value == null) {
      doc.save().moveTo(cx - 5, base - 1.5).lineTo(cx + 5, base - 1.5).lineWidth(1.4).strokeColor(EMPTY).stroke().restore();
    } else {
      const y = yFor(Math.max(point.value, 2));
      doc.save().roundedRect(cx - barWidth / 2, y, barWidth, base - y, 3).fill(gaugeColor(point.value)).restore();
      doc
        .font(SANS_BOLD)
        .fontSize(7.5)
        .fillColor(INK)
        .text(String(Math.round(point.value)), cx - 15, y - 10, { width: 30, align: 'center' });
    }
    doc
      .font(SANS)
      .fontSize(7.5)
      .fillColor(INK_SOFT)
      .text(point.label, cx - slot / 2, base + 5, { width: slot, align: 'center' });
  });

  doc.x = PAGE_MARGIN;
  doc.y = base + 18;
  body(
    ctx,
    isMonthly
      ? 'One bar per week, averaged over the days you logged in it.'
      : 'One bar per day. A dash on the baseline is a day with no check-in.',
    { color: INK_SOFT, size: 8 },
  );
}

function stoodOut(ctx: Ctx, rings: ReportRing[]): void {
  const columns = [
    { tone: 'positive' as const, title: 'Improving' },
    { tone: 'neutral' as const, title: 'Steady' },
    { tone: 'attention' as const, title: 'Needs attention' },
  ]
    .map((column) => ({ ...column, rings: rings.filter((r) => r.pct != null && r.deltaTone === column.tone) }))
    .filter((column) => column.rings.length > 0);
  if (columns.length === 0) return;

  const { doc } = ctx;
  section(ctx, 'What stood out', 60);
  for (const column of columns) {
    ensureSpace(ctx, 16 + column.rings.length * 15);
    doc.font(SANS_BOLD).fontSize(9.5).fillColor(TONE_COLOR[column.tone]).text(column.title, PAGE_MARGIN, doc.y);
    doc.moveDown(0.2);
    for (const ring of column.rings) {
      doc
        .font(SANS)
        .fontSize(9.5)
        .fillColor(INK)
        .text(`•  ${pdfSafe(ring.label)}`, PAGE_MARGIN + 6, doc.y, { continued: true })
        .fillColor(INK_SOFT)
        .text(`   ${pdfSafe(ring.delta)}`);
    }
    doc.moveDown(0.5);
  }
}

function glance(ctx: Ctx, report: WeeklyReportResponse): void {
  if (report.glance.length === 0) return;
  const { doc, width } = ctx;
  section(ctx, 'At a glance', 70);
  const gap = 8;
  const tileWidth = (width - gap) / 2;
  const tileHeight = 64;
  report.glance.forEach((tile, i) => {
    if (i % 2 === 0) ensureSpace(ctx, tileHeight + gap);
    const rowTop = doc.y;
    const x = PAGE_MARGIN + (i % 2) * (tileWidth + gap);
    doc.save().roundedRect(x, rowTop, tileWidth, tileHeight, 6).lineWidth(0.6).strokeColor(RULE).stroke().restore();
    doc
      .font(SANS_BOLD)
      .fontSize(7)
      .fillColor(GOLD)
      .text(pdfSafe(tile.eyebrow).toUpperCase(), x + 10, rowTop + 9, { width: tileWidth - 20, characterSpacing: 0.8 });
    doc.font(SANS_BOLD).fontSize(10.5).fillColor(INK).text(pdfSafe(tile.label), x + 10, rowTop + 21, { width: tileWidth - 20, lineBreak: false, ellipsis: true });
    const detail = [tile.value, tile.note].filter(Boolean).join('  ·  ');
    if (detail) {
      doc.font(SANS).fontSize(8.5).fillColor(INK_SOFT).text(pdfSafe(detail), x + 10, rowTop + 37, { width: tileWidth - 20, height: 22, ellipsis: true });
    }
    doc.x = PAGE_MARGIN;
    doc.y = i % 2 === 1 || i === report.glance.length - 1 ? rowTop + tileHeight + gap : rowTop;
  });
}

function joints(ctx: Ctx, report: WeeklyReportResponse): void {
  const j = report.joints;
  if (!j) return;
  const { doc } = ctx;
  section(ctx, 'Joints & stiffness', 70);
  const direction = j.direction
    ? { improving: 'easing', steady: 'steady', worsening: 'more than before' }[j.direction]
    : null;
  const top = doc.y;
  const figure = pdfSafe(j.averageDiscomfort);
  doc.font(SERIF_BOLD).fontSize(16).fillColor(INK).text(figure, PAGE_MARGIN, top, { lineBreak: false });
  if (direction) {
    const figureWidth = doc.widthOfString(figure);
    doc
      .font(SANS)
      .fontSize(9)
      .fillColor(INK_SOFT)
      .text(direction, PAGE_MARGIN + figureWidth + 8, top + 5, { lineBreak: false });
  }
  doc.x = PAGE_MARGIN;
  doc.y = top + 21;
  body(ctx, 'Average discomfort. Higher means more discomfort.', { color: INK_SOFT, size: 8 });
  doc.moveDown(0.4);
  const rows: [string, string][] = [
    ['Days with discomfort', `${j.daysWithDiscomfort} of ${j.daysInWindow} days`],
    ...(j.mostAffectedArea ? [['Most affected area', j.mostAffectedArea] as [string, string]] : []),
    ...(j.mostCommonSymptom ? [['Most common symptom', j.mostCommonSymptom] as [string, string]] : []),
    ...(j.impact ? [['Impact on your day', j.impact] as [string, string]] : []),
  ];
  for (const [label, value] of rows) {
    doc.font(SANS_BOLD).fontSize(9).fillColor(INK_SOFT).text(`${label}:  `, PAGE_MARGIN, doc.y, { continued: true });
    doc.font(SANS).fillColor(INK).text(pdfSafe(value));
  }
}

function anuInsight(ctx: Ctx, report: WeeklyReportResponse): void {
  const { doc } = ctx;
  section(ctx, "Anu's insight", 60);
  for (const insight of report.insights) {
    ensureSpace(ctx, 40);
    const color = insight.tone === 'attention' ? TONE_COLOR.attention : PLUM;
    doc.font(SANS_BOLD).fontSize(10).fillColor(color).text(pdfSafe(insight.title), PAGE_MARGIN, doc.y, { width: ctx.width });
    doc.moveDown(0.15);
    body(ctx, insight.body);
    doc.moveDown(0.5);
  }
  if (report.anuReflection) {
    ensureSpace(ctx, 30);
    body(ctx, report.anuReflection, { font: SERIF, size: 11, color: PLUM });
  }
}

// ── Document ─────────────────────────────────────────────────

export function periodReportFilename(report: WeeklyReportResponse): string {
  return `anuva-${report.period === 'weekly' ? 'weekly' : 'monthly'}-report-${report.periodStart}.pdf`;
}

export function renderPeriodReportPdf(report: WeeklyReportResponse, generatedAt = new Date()): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const isMonthly = report.period === 'monthly';
    const title = isMonthly ? 'Your month in review' : 'Your week in review';
    const pdf = new PDFDocument({
      size: 'A4',
      margins: { top: PAGE_MARGIN, bottom: PAGE_MARGIN, left: PAGE_MARGIN, right: PAGE_MARGIN },
      info: {
        Title: `Anuva Wellness ${isMonthly ? 'Monthly' : 'Weekly'} Report, ${periodLabel(report)}`,
        Author: 'Anuva Wellness',
        Subject: title,
        Creator: 'Anuva Wellness',
      },
      // See the 14-day renderer: the header hook must exist before the first page.
      autoFirstPage: false,
    });

    const chunks: Buffer[] = [];
    pdf.on('data', (c: Buffer) => chunks.push(c));
    pdf.on('end', () => resolve(Buffer.concat(chunks)));
    pdf.on('error', reject);

    const logo = openLogo(pdf);
    pdf.on('pageAdded', () => drawPageHeader(pdf, logo));
    pdf.addPage();

    const ctx: Ctx = { doc: pdf, width: pdf.page.width - PAGE_MARGIN * 2 };

    // ── Cover ────────────────────────────────────────────
    eyebrow(ctx, `Anuva Wellness · ${isMonthly ? 'Monthly' : 'Weekly'} report`);
    pdf.font(SERIF_BOLD).fontSize(23).fillColor(INK).text(title, PAGE_MARGIN, pdf.y, { width: ctx.width });
    pdf.moveDown(0.3);
    pdf.font(SANS).fontSize(10.5).fillColor(INK_SOFT).text(periodLabel(report), PAGE_MARGIN, pdf.y);
    pdf.moveDown(0.4);
    pdf
      .font(SANS_BOLD)
      .fontSize(7.5)
      .fillColor(INK_SOFT)
      .text(
        `${pdfSafe(report.trackingLabel).toUpperCase()}   ·   GENERATED ${generatedAt
          .toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
          .toUpperCase()}`,
        PAGE_MARGIN,
        pdf.y,
        { characterSpacing: 0.9 },
      );
    hr(ctx);
    tierPanel(ctx, report);

    // ── The page, card by card ───────────────────────────
    // Same order as the summary page (WeeklyReportRoute): the week opens on its day balance and
    // has no headline card; the month opens on its headline, then tiles, insight, chart.
    if (isMonthly) {
      headlineCard(ctx, report);
      glance(ctx, report);
      anuInsight(ctx, report);
      trendChart(ctx, report);
      joints(ctx, report);
    } else {
      dayBalance(ctx, report);
      trendChart(ctx, report);
      stoodOut(ctx, report.rings);
      joints(ctx, report);
      anuInsight(ctx, report);
    }

    if (report.calibrating) {
      pdf.moveDown(0.6);
      panel(
        ctx,
        'Still calibrating',
        'Your first two weeks are still filling in. These numbers settle once fourteen days are logged.',
      );
    }

    // ── Disclaimer ───────────────────────────────────────
    // Measured rather than guessed, so it only moves to a page of its own when it truly will not fit.
    const disclaimer =
      'This report summarises what you logged in Anuva for this period. It is not a diagnosis. ' +
      'If anything here worries you, or a symptom is new or getting worse, talk to your doctor.';
    pdf.font(SANS).fontSize(7.8);
    ensureSpace(ctx, 16 + pdf.heightOfString(disclaimer, { width: ctx.width, lineGap: 1.9 }));
    hr(ctx, 8, 8);
    pdf.fillColor(INK_SOFT).text(disclaimer, PAGE_MARGIN, pdf.y, { width: ctx.width, lineGap: 1.9 });

    pdf.end();
  });
}
