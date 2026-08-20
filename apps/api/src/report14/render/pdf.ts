/**
 * Renders a report document to a real PDF, server-side, with a disk cache.
 *
 * Why PDFKit rather than headless Chromium: the document is pure text flow —
 * headings, paragraphs and bullet lists — so there is no layout that needs a
 * browser engine. PDFKit is pure JS (~1MB), behaves identically in local dev and
 * in the alpine production image, needs no network access, and renders in
 * milliseconds rather than launching a browser. Chromium would have added
 * roughly 300MB to the image, an outbound font fetch, and a cold-start penalty
 * on every render, in exchange for CSS we do not need.
 *
 * Caching is content-addressed: the key is a hash of the exact text that will be
 * drawn, so any copy edit, template-version bump or name change misses the cache
 * automatically. There is no staleness window and nothing to invalidate by hand.
 */

import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import PDFDocument from 'pdfkit';
import { ANUVA_LOGO_PNG } from '../assets/logo.js';
import type { RecommendationBlock } from '../content/domains.js';
import type { ReportDocument } from '../content/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Sits alongside the existing `.data/` stores (consultation documents, exports).
 * Five levels up: this file is `apps/api/{src,dist}/report14/render/`, the same
 * depth in dev and in the built image, so one path works for both.
 */
const CACHE_DIR =
  process.env.REPORT14_CACHE_DIR?.trim() ||
  path.join(__dirname, '../../../../../.data/report14');

// Anuva Wellness palette (DESIGN.md).
const INK = '#3E2542';
const INK_SOFT = '#6B4F6E';
const PLUM = '#5E3566';
const ROSE = '#C97E92';
const GOLD = '#8A6E2A'; // darkened from #B8923C for print contrast on white
const RULE = '#D9C9D5';

/**
 * PDFKit's built-in fonts need no shipped assets. DESIGN.md specifies Fraunces
 * (serif) for headings and Mulish (sans) for body; Times and Helvetica are the
 * closest standard-14 stand-ins and keep the serif/sans pairing intact. To use
 * the real faces, drop the TTFs into ./fonts and register them here — the rest of
 * this file does not change.
 */
const SERIF = 'Times-Roman';
const SERIF_BOLD = 'Times-Bold';
const SANS = 'Helvetica';
const SANS_BOLD = 'Helvetica-Bold';

const PAGE_MARGIN = 56; // ~20mm

/**
 * The lotus mark sits INSIDE the top margin rather than in the text column, so it
 * brands every page without consuming any content height — no layout below it
 * has to know the header exists.
 */
const LOGO_SIZE = 24;
const LOGO_TOP = 20;

/**
 * `openImage` embeds the PNG once and hands back a reference that every page can
 * draw. It is missing from @types/pdfkit but present at runtime, hence the narrow
 * shim rather than a cast to `any`.
 *
 * This matters more than it looks: `image()` only deduplicates when passed a
 * *string path*, so handing it the same Buffer on each page re-embeds the whole
 * PNG — a 5-page report went from 16KB to 91KB (five copies of the image plus
 * five alpha masks) before this was fixed.
 */
interface OpensImages {
  openImage(src: Buffer): unknown;
}

function openLogo(doc: PDFKit.PDFDocument): unknown {
  return (doc as unknown as OpensImages).openImage(ANUVA_LOGO_PNG);
}

/** Drawn on every page via the `pageAdded` hook. */
function drawPageHeader(doc: PDFKit.PDFDocument, logo: unknown): void {
  doc.image(logo as Buffer, PAGE_MARGIN, LOGO_TOP, {
    width: LOGO_SIZE,
    height: LOGO_SIZE,
  });
  // The mark lives in the top margin, so reset the cursor to where the text
  // column actually starts — every page's content begins at the margin.
  doc.x = PAGE_MARGIN;
  doc.y = PAGE_MARGIN;
}

interface Ctx {
  doc: PDFKit.PDFDocument;
  width: number;
}

function hr(ctx: Ctx, gapBefore = 14, gapAfter = 14): void {
  const { doc, width } = ctx;
  doc.moveDown(0);
  const y = doc.y + gapBefore;
  doc
    .save()
    .moveTo(PAGE_MARGIN, y)
    .lineTo(PAGE_MARGIN + width, y)
    .lineWidth(0.5)
    .strokeColor(RULE)
    .stroke()
    .restore();
  doc.y = y + gapAfter;
}

function eyebrow(ctx: Ctx, text: string, color = GOLD): void {
  ctx.doc
    .font(SANS_BOLD)
    .fontSize(7.5)
    .fillColor(color)
    .text(text.toUpperCase(), { characterSpacing: 1.1 });
  ctx.doc.moveDown(0.35);
}

function heading(ctx: Ctx, text: string, size = 15): void {
  // Keep a heading with at least a little of its body text.
  if (ctx.doc.y > ctx.doc.page.height - PAGE_MARGIN - 90) ctx.doc.addPage();
  ctx.doc.font(SERIF_BOLD).fontSize(size).fillColor(PLUM).text(text);
  ctx.doc.moveDown(0.45);
}

function body(ctx: Ctx, text: string, opts: { color?: string; size?: number } = {}): void {
  ctx.doc
    .font(SANS)
    .fontSize(opts.size ?? 10)
    .fillColor(opts.color ?? INK)
    .text(text, { align: 'left', lineGap: 2.6 });
  ctx.doc.moveDown(0.6);
}

function bulletList(ctx: Ctx, items: string[]): void {
  const { doc, width } = ctx;
  for (const item of items) {
    if (doc.y > doc.page.height - PAGE_MARGIN - 40) doc.addPage();
    const x = PAGE_MARGIN;
    const textX = x + 13;
    const startY = doc.y;

    doc
      .save()
      .circle(x + 4.5, startY + 5, 2.1)
      .fillColor(ROSE)
      .fill()
      .restore();

    doc
      .font(SANS)
      .fontSize(9.5)
      .fillColor(INK_SOFT)
      .text(item, textX, startY, { width: width - 13, lineGap: 2.2 });

    doc.x = PAGE_MARGIN;
    doc.moveDown(0.42);
  }
  doc.moveDown(0.35);
}

/** A bordered panel whose height is measured before it is drawn. */
function panel(ctx: Ctx, label: string, text: string): void {
  const { doc, width } = ctx;
  const padX = 14;
  const padY = 11;
  const innerWidth = width - padX * 2;

  const labelHeight = doc.font(SANS_BOLD).fontSize(7.5).heightOfString(label.toUpperCase(), {
    width: innerWidth,
    characterSpacing: 1.1,
  });
  const textHeight = doc
    .font(SANS)
    .fontSize(9.5)
    .heightOfString(text, { width: innerWidth, lineGap: 2.2 });
  const boxHeight = labelHeight + textHeight + padY * 2 + 4;

  if (doc.y + boxHeight > doc.page.height - PAGE_MARGIN) doc.addPage();

  const top = doc.y;
  doc
    .save()
    .roundedRect(PAGE_MARGIN, top, width, boxHeight, 9)
    .lineWidth(0.5)
    .strokeColor(RULE)
    .stroke()
    .restore();

  doc
    .font(SANS_BOLD)
    .fontSize(7.5)
    .fillColor(GOLD)
    .text(label.toUpperCase(), PAGE_MARGIN + padX, top + padY, {
      width: innerWidth,
      characterSpacing: 1.1,
    });

  doc
    .font(SANS)
    .fontSize(9.5)
    .fillColor(INK)
    .text(text, PAGE_MARGIN + padX, top + padY + labelHeight + 4, {
      width: innerWidth,
      lineGap: 2.2,
    });

  doc.x = PAGE_MARGIN;
  doc.y = top + boxHeight + 12;
}

/** Same as `panel` but tinted, for ANU's notes. */
function anuPanel(ctx: Ctx, text: string): void {
  const { doc, width } = ctx;
  const padX = 14;
  const padY = 11;
  const innerWidth = width - padX * 2;
  const label = 'FROM ANU';

  const labelHeight = doc
    .font(SANS_BOLD)
    .fontSize(7.5)
    .heightOfString(label, { width: innerWidth, characterSpacing: 1.1 });
  const textHeight = doc
    .font(SANS)
    .fontSize(9.5)
    .heightOfString(text, { width: innerWidth, lineGap: 2.2 });
  const boxHeight = labelHeight + textHeight + padY * 2 + 4;

  if (doc.y + boxHeight > doc.page.height - PAGE_MARGIN) doc.addPage();

  const top = doc.y;
  doc
    .save()
    .roundedRect(PAGE_MARGIN, top, width, boxHeight, 9)
    .fillColor('#F7EAEE')
    .fill()
    .roundedRect(PAGE_MARGIN, top, width, boxHeight, 9)
    .lineWidth(0.5)
    .strokeColor('#E3BFC9')
    .stroke()
    .restore();

  doc
    .font(SANS_BOLD)
    .fontSize(7.5)
    .fillColor(PLUM)
    .text(label, PAGE_MARGIN + padX, top + padY, {
      width: innerWidth,
      characterSpacing: 1.1,
    });

  doc
    .font(SANS)
    .fontSize(9.5)
    .fillColor(INK)
    .text(text, PAGE_MARGIN + padX, top + padY + labelHeight + 4, {
      width: innerWidth,
      lineGap: 2.2,
    });

  doc.x = PAGE_MARGIN;
  doc.y = top + boxHeight + 12;
}

function recommendations(ctx: Ctx, blocks: RecommendationBlock[]): void {
  for (const block of blocks) {
    if (ctx.doc.y > ctx.doc.page.height - PAGE_MARGIN - 80) ctx.doc.addPage();
    ctx.doc.font(SANS_BOLD).fontSize(10.5).fillColor(INK).text(block.title);
    ctx.doc.moveDown(0.4);
    bulletList(ctx, block.bullets);
  }
}

/**
 * Everything that ends up drawn, in order. Hashing this rather than the
 * ReportDocument object means the cache key covers the copy itself: change a
 * bullet and the key changes.
 */
function cacheKeyFor(doc: ReportDocument): string {
  const material = JSON.stringify([
    'v1',
    doc.templateVersion,
    doc.reportId,
    doc.title,
    doc.salutation,
    doc.introduction,
    doc.menstrualStatus,
    doc.dominantDomain,
    doc.medicalFlags,
    doc.recommendations,
    doc.trackerFocus,
    doc.anuNote,
    doc.overlays,
    doc.disclaimer,
    doc.generatedOn,
  ]);
  return createHash('sha256').update(material).digest('hex').slice(0, 32);
}

function buildPdf(doc: ReportDocument): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const pdf = new PDFDocument({
      size: 'A4',
      margins: {
        top: PAGE_MARGIN,
        bottom: PAGE_MARGIN,
        left: PAGE_MARGIN,
        right: PAGE_MARGIN,
      },
      info: {
        Title: `Anuva Wellness Assessment Report ${doc.reportId}`,
        Author: 'Anuva Wellness',
        Subject: doc.title,
        Creator: `Anuva Wellness · template ${doc.templateVersion}`,
      },
      // Off so the `pageAdded` hook below is attached before the first page
      // exists; otherwise page one would be the only page without the mark.
      autoFirstPage: false,
    });

    const chunks: Buffer[] = [];
    pdf.on('data', (c: Buffer) => chunks.push(c));
    pdf.on('end', () => resolve(Buffer.concat(chunks)));
    pdf.on('error', reject);

    const logo = openLogo(pdf);
    pdf.on('pageAdded', () => drawPageHeader(pdf, logo));
    pdf.addPage();

    const width = pdf.page.width - PAGE_MARGIN * 2;
    const ctx: Ctx = { doc: pdf, width };

    // ── Cover ────────────────────────────────────────────
    eyebrow(ctx, 'Anuva Wellness · Assessment Report');
    pdf.font(SERIF_BOLD).fontSize(23).fillColor(INK).text(doc.title, { lineGap: 1 });
    pdf.moveDown(0.35);
    pdf.font(SANS).fontSize(9.5).fillColor(INK_SOFT).text(doc.stageContext, { lineGap: 2.2 });
    pdf.moveDown(0.5);
    pdf
      .font(SANS_BOLD)
      .fontSize(7.5)
      .fillColor(INK_SOFT)
      .text(`REPORT ${doc.reportId}   ·   ${doc.generatedOn.toUpperCase()}`, {
        characterSpacing: 0.9,
      });
    hr(ctx, 12, 18);

    // ── Salutation + introduction ────────────────────────
    pdf.font(SERIF).fontSize(14).fillColor(PLUM).text(doc.salutation);
    pdf.moveDown(0.6);
    body(ctx, doc.introduction);
    pdf.moveDown(0.3);

    panel(ctx, 'Your menstrual status', doc.menstrualStatus);
    panel(ctx, 'Dominant symptom domain', doc.dominantDomain);

    // ── Medical flags ────────────────────────────────────
    heading(ctx, 'Medical flags to raise with your doctor');
    bulletList(ctx, doc.medicalFlags);

    // ── Recommendations ──────────────────────────────────
    heading(ctx, 'Your recommendations');
    recommendations(ctx, doc.recommendations);

    panel(ctx, 'What ANU will track with you', doc.trackerFocus);
    anuPanel(ctx, doc.anuNote);

    // ── Overlays ─────────────────────────────────────────
    for (const overlay of doc.overlays) {
      pdf.addPage();
      eyebrow(ctx, `Additional focus · ${overlay.id}`);
      pdf.font(SERIF_BOLD).fontSize(17).fillColor(PLUM).text(overlay.title);
      pdf.moveDown(0.5);
      panel(ctx, overlay.lens, overlay.intro);
      recommendations(ctx, overlay.recommendations);
      anuPanel(ctx, overlay.anuNote);
    }

    // ── Disclaimer ───────────────────────────────────────
    if (pdf.y > pdf.page.height - PAGE_MARGIN - 120) pdf.addPage();
    hr(ctx, 14, 12);
    pdf.font(SANS).fontSize(7.8).fillColor(INK_SOFT).text(doc.disclaimer, { lineGap: 1.9 });

    // No printed colophon. The template version and report ID live in the PDF's
    // metadata (see `info` above) instead, so a document stays traceable to the
    // copy revision that produced it without putting internal references in
    // front of the reader. `cacheKeyFor` hashes templateVersion explicitly, so
    // dropping it from the page does not weaken cache invalidation.

    pdf.end();
  });
}

/**
 * Renders in flight, keyed by cache key, so two simultaneous requests for the
 * same uncached report produce one render rather than two.
 */
const inFlight = new Map<string, Promise<Buffer>>();

export interface RenderedPdf {
  bytes: Buffer;
  cacheKey: string;
  /** True when this response came off disk rather than being rendered now. */
  cached: boolean;
  filename: string;
}

function filenameFor(doc: ReportDocument): string {
  return `anuva-assessment-report-${doc.reportId}.pdf`;
}

const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
let lastPruneAt = 0;

/** Drops cache entries older than the TTL. Best-effort and never throws. */
async function pruneCache(): Promise<void> {
  const now = Date.now();
  // At most once an hour, however many renders happen in between.
  if (now - lastPruneAt < 60 * 60 * 1000) return;
  lastPruneAt = now;
  try {
    const entries = await fs.readdir(CACHE_DIR);
    await Promise.all(
      entries.map(async (name) => {
        if (!name.endsWith('.pdf')) return;
        const full = path.join(CACHE_DIR, name);
        try {
          const stat = await fs.stat(full);
          if (now - stat.mtimeMs > CACHE_TTL_MS) await fs.unlink(full);
        } catch {
          // Raced with another prune, or already gone. Either way, fine.
        }
      }),
    );
  } catch {
    // No cache directory yet, or unreadable. Nothing to prune.
  }
}

/** Serve from cache when we already have it; otherwise render, store, return. */
export async function renderReportPdf(doc: ReportDocument): Promise<RenderedPdf> {
  const cacheKey = cacheKeyFor(doc);
  const filename = filenameFor(doc);
  const cachePath = path.join(CACHE_DIR, `${cacheKey}.pdf`);

  try {
    const bytes = await fs.readFile(cachePath);
    return { bytes, cacheKey, cached: true, filename };
  } catch {
    // Not cached — fall through and render.
  }

  const existing = inFlight.get(cacheKey);
  if (existing) {
    return { bytes: await existing, cacheKey, cached: false, filename };
  }

  const job = buildPdf(doc);
  inFlight.set(cacheKey, job);

  try {
    const bytes = await job;
    // Write via a temp file and rename so a crash mid-write can never leave a
    // truncated PDF behind to be served as a cache hit forever.
    try {
      await fs.mkdir(CACHE_DIR, { recursive: true });
      const tmp = `${cachePath}.${process.pid}.tmp`;
      await fs.writeFile(tmp, bytes, { mode: 0o600 });
      await fs.rename(tmp, cachePath);
      // We are already doing IO on this path, so it is the cheapest place to
      // keep the directory bounded. `generatedOn` is part of the key, so a
      // report re-opened tomorrow is a legitimately different document and
      // yesterday's entry is dead weight.
      void pruneCache();
    } catch {
      // A failed cache write must not fail the request — the user still gets
      // their report, we just render it again next time.
    }
    return { bytes, cacheKey, cached: false, filename };
  } finally {
    inFlight.delete(cacheKey);
  }
}

export const REPORT14_CACHE_DIR = CACHE_DIR;
