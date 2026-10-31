/**
 * The Anuva look shared by every PDF the API draws — the 14-day assessment report and the weekly
 * and monthly summary reports: palette, type, margins, and the lotus mark on every page.
 */

import { ANUVA_LOGO_PNG } from '../report14/assets/logo.js';

// Anuva Wellness palette (DESIGN.md).
export const INK = '#3E2542';
export const INK_SOFT = '#6B4F6E';
export const PLUM = '#5E3566';
export const ROSE = '#C97E92';
export const GOLD = '#8A6E2A'; // darkened from #B8923C for print contrast on white
export const RULE = '#D9C9D5';

/**
 * PDFKit's built-in fonts need no shipped assets. DESIGN.md specifies Fraunces
 * (serif) for headings and Mulish (sans) for body; Times and Helvetica are the
 * closest standard-14 stand-ins and keep the serif/sans pairing intact. To use
 * the real faces, register the TTFs here — the renderers do not change.
 */
export const SERIF = 'Times-Roman';
export const SERIF_BOLD = 'Times-Bold';
export const SANS = 'Helvetica';
export const SANS_BOLD = 'Helvetica-Bold';

export const PAGE_MARGIN = 56; // ~20mm

/**
 * The lotus mark sits INSIDE the top margin rather than in the text column, so it
 * brands every page without consuming any content height — no layout below it
 * has to know the header exists.
 */
export const LOGO_SIZE = 24;
export const LOGO_TOP = 20;

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

export function openLogo(doc: PDFKit.PDFDocument): unknown {
  return (doc as unknown as OpensImages).openImage(ANUVA_LOGO_PNG);
}

/** Drawn on every page via the `pageAdded` hook. */
export function drawPageHeader(doc: PDFKit.PDFDocument, logo: unknown): void {
  doc.image(logo as Buffer, PAGE_MARGIN, LOGO_TOP, {
    width: LOGO_SIZE,
    height: LOGO_SIZE,
  });
  // The mark lives in the top margin, so reset the cursor to where the text
  // column actually starts — every page's content begins at the margin.
  doc.x = PAGE_MARGIN;
  doc.y = PAGE_MARGIN;
}
