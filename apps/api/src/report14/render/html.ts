/**
 * Renders a report document to self-contained, print-optimised HTML.
 *
 * This is the SECONDARY view. The deliverable users receive is a real PDF built
 * server-side in ./pdf.ts; this page exists to inspect a layout question without
 * regenerating PDFs, and as a fallback surface if PDF rendering ever fails.
 *
 * Fonts follow DESIGN.md (Fraunces for headings, Mulish for body), loaded from
 * Google Fonts with a full local fallback stack so the page degrades to system
 * serif/sans rather than breaking offline. The PDF path deliberately does not
 * depend on this: it embeds no webfonts and needs no network.
 */

import { ANUVA_LOGO_PNG } from '../assets/logo.js';
import type { RecommendationBlock } from '../content/domains.js';
import type { ReportDocument } from '../content/index.js';

/** Inlined so the page stays self-contained — no asset route to authenticate. */
const LOGO_BASE64 = ANUVA_LOGO_PNG.toString('base64');

function esc(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function bullets(items: string[]): string {
  return `<ul>${items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>`;
}

function recommendationBlocks(blocks: RecommendationBlock[]): string {
  return blocks
    .map(
      (block) => `
        <section class="rec">
          <h3>${esc(block.title)}</h3>
          ${bullets(block.bullets)}
        </section>`,
    )
    .join('');
}

const STYLES = `
  :root {
    --surface: #F7F0E8;
    --raised: #FFFDFA;
    --ink: #3E2542;
    --ink-soft: #6B4F6E;
    --plum: #5E3566;
    --rose: #C97E92;
    --gold: #B8923C;
    --rule: rgba(94, 53, 102, 0.18);
  }

  * { box-sizing: border-box; }

  body {
    margin: 0;
    padding: 0;
    background: var(--surface);
    color: var(--ink);
    font-family: "Mulish", -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
    font-size: 15px;
    line-height: 1.62;
    -webkit-text-size-adjust: 100%;
  }

  .sheet {
    max-width: 760px;
    margin: 0 auto;
    padding: 40px 28px 72px;
  }

  .eyebrow {
    font-family: "Space Mono", ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 10.5px;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--gold);
    margin: 0 0 10px;
  }

  h1 {
    font-family: "Fraunces", Georgia, "Times New Roman", serif;
    font-weight: 500;
    font-size: 30px;
    line-height: 1.18;
    margin: 0 0 6px;
    color: var(--ink);
  }

  .subtitle {
    font-size: 13.5px;
    color: var(--ink-soft);
    margin: 0;
  }

  .cover {
    border-bottom: 1px solid var(--rule);
    padding-bottom: 22px;
    margin-bottom: 26px;
  }

  .cover-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 6px 20px;
    margin-top: 16px;
    font-family: "Space Mono", ui-monospace, monospace;
    font-size: 10.5px;
    letter-spacing: 0.06em;
    color: var(--ink-soft);
    text-transform: uppercase;
  }

  .salutation {
    font-family: "Fraunces", Georgia, serif;
    font-size: 19px;
    color: var(--plum);
    margin: 0 0 14px;
  }

  h2 {
    font-family: "Fraunces", Georgia, "Times New Roman", serif;
    font-weight: 500;
    font-size: 20px;
    line-height: 1.3;
    margin: 34px 0 12px;
    color: var(--plum);
  }

  h3 {
    font-family: "Mulish", system-ui, sans-serif;
    font-weight: 700;
    font-size: 14px;
    letter-spacing: 0.01em;
    margin: 20px 0 8px;
    color: var(--ink);
  }

  p { margin: 0 0 12px; }

  ul { margin: 0 0 14px; padding-left: 20px; }
  li { margin-bottom: 7px; }

  .card {
    background: var(--raised);
    border: 1px solid var(--rule);
    border-radius: 16px;
    padding: 18px 20px;
    margin: 0 0 18px;
  }

  .card .label {
    font-family: "Space Mono", ui-monospace, monospace;
    font-size: 10px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--gold);
    margin: 0 0 6px;
  }

  .card p:last-child { margin-bottom: 0; }

  .flags { list-style: none; padding-left: 0; }
  .flags li {
    position: relative;
    padding-left: 20px;
  }
  .flags li::before {
    content: "";
    position: absolute;
    left: 2px;
    top: 0.62em;
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--rose);
  }

  .anu {
    background: rgba(201, 126, 146, 0.1);
    border: 1px solid rgba(201, 126, 146, 0.32);
    border-radius: 16px;
    padding: 18px 20px;
    margin: 24px 0 0;
  }

  .overlay {
    margin-top: 40px;
    padding-top: 26px;
    border-top: 1px solid var(--rule);
  }

  .divider {
    height: 1px;
    background: var(--rule);
    border: 0;
    margin: 34px 0 0;
  }

  .disclaimer {
    margin-top: 34px;
    padding-top: 18px;
    border-top: 1px solid var(--rule);
    font-size: 11.5px;
    line-height: 1.6;
    color: var(--ink-soft);
  }

  .brand {
    display: block;
    width: 34px;
    height: 34px;
    margin-bottom: 12px;
  }

  .toolbar {
    position: sticky;
    top: 0;
    z-index: 5;
    display: flex;
    justify-content: flex-end;
    gap: 10px;
    padding: 12px 28px;
    background: rgba(247, 240, 232, 0.94);
    backdrop-filter: blur(8px);
    border-bottom: 1px solid var(--rule);
  }

  .toolbar button {
    font-family: "Mulish", system-ui, sans-serif;
    font-size: 13px;
    font-weight: 600;
    color: #FFFDFA;
    background: var(--plum);
    border: 0;
    border-radius: 9999px;
    padding: 11px 22px;
    min-height: 44px;
    cursor: pointer;
  }

  @media print {
    .toolbar { display: none !important; }
    body { background: #FFFFFF; font-size: 10.5pt; }
    .sheet { max-width: none; padding: 0; }
    .card, .anu { break-inside: avoid; }
    h2, h3 { break-after: avoid; }
    .overlay { break-before: page; }
    a[href]::after { content: ""; }
  }

  @page {
    size: A4;
    margin: 16mm 15mm 18mm;
  }
`;

export function renderReportHtml(doc: ReportDocument): string {
  const overlays = doc.overlays
    .map(
      (overlay) => `
      <section class="overlay">
        <p class="eyebrow">Additional focus · ${esc(overlay.id)}</p>
        <h2>${esc(overlay.title)}</h2>
        <div class="card">
          <p class="label">${esc(overlay.lens)}</p>
          <p>${esc(overlay.intro)}</p>
        </div>
        ${recommendationBlocks(overlay.recommendations)}
        <aside class="anu">
          <p class="label" style="color: var(--plum)">From ANU</p>
          <p>${esc(overlay.anuNote)}</p>
        </aside>
      </section>`,
    )
    .join('');

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="robots" content="noindex, nofollow" />
<title>Your Assessment Report · Anuva Wellness</title>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link
  href="https://fonts.googleapis.com/css2?family=Fraunces:wght@400;500;600&family=Mulish:wght@400;600;700&family=Space+Mono:wght@400&display=swap"
  rel="stylesheet"
/>
<style>${STYLES}</style>
</head>
<body>
<div class="toolbar">
  <button type="button" onclick="window.print()">Save as PDF</button>
</div>

<main class="sheet">
  <header class="cover">
    <img class="brand" src="data:image/png;base64,${LOGO_BASE64}" alt="Anuva Wellness" />
    <p class="eyebrow">Anuva Wellness · Assessment Report</p>
    <h1>${esc(doc.title)}</h1>
    <p class="subtitle">${esc(doc.stageContext)}</p>
    <div class="cover-meta">
      <span>Report ${esc(doc.reportId)}</span>
      <span>${esc(doc.generatedOn)}</span>
    </div>
  </header>

  <p class="salutation">${esc(doc.salutation)}</p>

  <p>${esc(doc.introduction)}</p>

  <div class="card">
    <p class="label">Your menstrual status</p>
    <p>${esc(doc.menstrualStatus)}</p>
  </div>

  <div class="card">
    <p class="label">Dominant symptom domain</p>
    <p>${esc(doc.dominantDomain)}</p>
  </div>

  <h2>Medical flags to raise with your doctor</h2>
  <ul class="flags">${doc.medicalFlags.map((f) => `<li>${esc(f)}</li>`).join('')}</ul>

  <h2>Your recommendations</h2>
  ${recommendationBlocks(doc.recommendations)}

  <div class="card">
    <p class="label">What ANU will track with you</p>
    <p>${esc(doc.trackerFocus)}</p>
  </div>

  <aside class="anu">
    <p class="label" style="color: var(--plum)">From ANU</p>
    <p>${esc(doc.anuNote)}</p>
  </aside>

  ${overlays}

  <hr class="divider" />

  <p class="disclaimer">${esc(doc.disclaimer)}</p>
</main>
</body>
</html>`;
}
