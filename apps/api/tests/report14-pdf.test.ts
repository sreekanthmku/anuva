/**
 * 14-Day Assessment Report — PDF renderer tests.
 *
 * The classifier tests cover which copy is chosen; these cover whether it can
 * actually be drawn. Every one of the 48 documents (12 report IDs x 4 overlay
 * combinations) is rendered, because a layout fault — an unmeasured panel, a
 * bullet that overruns the page — only surfaces at render time and would ship a
 * broken document rather than a wrong one.
 *
 * Uses a temp cache directory so a developer's `.data/` is never touched.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';

let cacheDir: string;
let renderReportPdf: typeof import('../src/report14/render/pdf.js').renderReportPdf;
let buildDocument: typeof import('../src/report14/content/index.js').buildDocument;
let CFG: typeof import('../src/report14/config.js').REPORT14_CONFIG;

beforeAll(async () => {
  cacheDir = await mkdtemp(path.join(tmpdir(), 'report14-pdf-'));
  process.env.REPORT14_CACHE_DIR = cacheDir;
  // Imported after the env var is set — the module reads it at load time.
  ({ renderReportPdf } = await import('../src/report14/render/pdf.js'));
  ({ buildDocument } = await import('../src/report14/content/index.js'));
  ({ REPORT14_CONFIG: CFG } = await import('../src/report14/config.js'));
});

afterAll(async () => {
  await rm(cacheDir, { recursive: true, force: true });
  delete process.env.REPORT14_CACHE_DIR;
});

const STAGES = [1, 2, 3] as const;
const DOMAINS = ['A', 'B', 'C', 'D'] as const;
const OVERLAY_SETS = [[], ['GUT'], ['FAMILY'], ['GUT', 'FAMILY']] as const;

function classificationFor(
  stage: (typeof STAGES)[number],
  domain: (typeof DOMAINS)[number],
  overlays: readonly string[],
  generatedAt = new Date('2026-08-21T09:00:00+05:30'),
) {
  const zero = { raw: 0, answered: 0, max: 0, burden: 0, index: 0 };
  return {
    reportId: `${stage}${domain}`,
    stage,
    domain,
    overlays: [...overlays],
    window: {
      anchorMode: 'day_after_bleeding' as const,
      start: null,
      end: null,
      daysCovered: 14,
      reason: '',
    },
    stageDetail: { stage, rule: 'S5', reason: '', flags: [] },
    domainDetail: {
      domain,
      reason: '',
      assessment: { A: zero, B: zero, C: zero },
      logs: {},
      final: { A: 0, B: 0, C: 0 },
      qol: { A: 0, B: 0, C: 0 },
      tieBreakUsed: 'none' as const,
      blendApplied: false,
      degradedDomains: [],
      flags: [],
    },
    overlayDetail: { overlays: [...overlays], reasons: {} },
    flags: [],
    config: {
      useTrackingData: true,
      logBlendMode: 'relative' as const,
      logBlendWeight: 0.35,
      templateVersion: CFG.templateVersion,
    },
    generatedAt,
  } as never;
}

/** Decodes the drawn text out of a PDFKit document. */
function extractText(bytes: Buffer): string {
  const raw = bytes.toString('latin1');
  const streams: Buffer[] = [];
  const re = /stream\r?\n/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw)) !== null) {
    const start = m.index + m[0].length;
    const end = raw.indexOf('endstream', start);
    if (end < 0) continue;
    try {
      streams.push(zlib.inflateSync(Buffer.from(raw.slice(start, end), 'latin1')));
    } catch {
      // Not a Flate stream (font metrics, etc.). Skip it.
    }
  }
  const content = Buffer.concat(streams).toString('latin1');
  let out = Buffer.alloc(0);
  // PDFKit writes hex strings inside TJ kerning arrays.
  for (const tj of content.matchAll(/\[(.*?)\]\s*TJ/gs)) {
    for (const hex of (tj[1] ?? '').matchAll(/<([0-9a-fA-F]+)>/g)) {
      out = Buffer.concat([out, Buffer.from(hex[1] ?? '', 'hex')]);
    }
    out = Buffer.concat([out, Buffer.from('\n')]);
  }
  return decodeWinAnsi(out);
}

/**
 * WinAnsi (cp1252) differs from latin-1 only in 0x80–0x9F, and that range is
 * exactly where the punctuation in this copy lives — em dash is 0x97, en dash
 * 0x96, curly quotes 0x91–0x94.
 *
 * Mapped by hand rather than with `TextDecoder('windows-1252')`, which on this
 * Node build decodes as latin-1 and turns those bytes into invisible C1 control
 * characters. That made an earlier version of this test report every em dash as
 * missing when the PDF was in fact correct.
 */
const CP1252_HIGH: Record<number, string> = {
  0x80: '€', 0x82: '‚', 0x83: 'ƒ', 0x84: '„', 0x85: '…', 0x86: '†', 0x87: '‡',
  0x88: 'ˆ', 0x89: '‰', 0x8a: 'Š', 0x8b: '‹', 0x8c: 'Œ', 0x8e: 'Ž',
  0x91: '‘', 0x92: '’', 0x93: '“', 0x94: '”', 0x95: '•', 0x96: '–', 0x97: '—',
  0x98: '˜', 0x99: '™', 0x9a: 'š', 0x9b: '›', 0x9c: 'œ', 0x9e: 'ž', 0x9f: 'Ÿ',
};

function decodeWinAnsi(buf: Buffer): string {
  let out = '';
  for (const byte of buf) {
    out += byte >= 0x80 && byte <= 0x9f ? (CP1252_HIGH[byte] ?? '') : String.fromCharCode(byte);
  }
  return out;
}

/**
 * Counts image-draw operators (`Do` against an XObject) across all content
 * streams — one per page if the header hook is wired correctly.
 */
function countLogoDraws(bytes: Buffer): number {
  const raw = bytes.toString('latin1');
  let count = 0;
  const re = /stream\r?\n/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw)) !== null) {
    const start = m.index + m[0].length;
    const end = raw.indexOf('endstream', start);
    if (end < 0) continue;
    try {
      const inflated = zlib
        .inflateSync(Buffer.from(raw.slice(start, end), 'latin1'))
        .toString('latin1');
      count += (inflated.match(/\/I\d+ Do/g) ?? []).length;
    } catch {
      // Not a Flate content stream.
    }
  }
  return count;
}

/**
 * PDF info-dict strings are UTF-16BE whenever they contain a non-ASCII
 * character, and ours carry a middot — so a plain ASCII search would miss them
 * and wrongly report the metadata as absent. Check both encodings.
 */
function metadataContains(bytes: Buffer, needle: string): boolean {
  if (bytes.includes(Buffer.from(needle, 'ascii'))) return true;
  const utf16be = Buffer.from(needle, 'utf16le').swap16();
  return bytes.includes(utf16be);
}

function pageCount(bytes: Buffer): number {
  const s = bytes.toString('latin1');
  return (s.match(/\/Type \/Page[^s]/g) ?? []).length;
}

describe('renderReportPdf', () => {
  it('produces a valid PDF', async () => {
    const doc = buildDocument(classificationFor(2, 'B', []), 'Priya');
    const out = await renderReportPdf(doc);
    expect(out.bytes.subarray(0, 5).toString()).toBe('%PDF-');
    expect(out.bytes.subarray(-6).toString()).toContain('%%EOF');
    expect(out.bytes.length).toBeGreaterThan(4000);
    expect(out.filename).toBe('anuva-assessment-report-2B.pdf');
  });

  it('renders all 12 variants x 4 overlay combinations', async () => {
    for (const stage of STAGES) {
      for (const domain of DOMAINS) {
        for (const overlays of OVERLAY_SETS) {
          const doc = buildDocument(classificationFor(stage, domain, overlays), 'Test User');
          const out = await renderReportPdf(doc);
          expect(out.bytes.subarray(0, 5).toString(), `${stage}${domain} ${overlays}`).toBe(
            '%PDF-',
          );
          // Each overlay gets its own page, so more overlays means more pages.
          expect(pageCount(out.bytes)).toBeGreaterThanOrEqual(1 + overlays.length);
        }
      }
    }
  });

  it('serves a byte-identical copy from cache on the second call', async () => {
    const doc = buildDocument(classificationFor(1, 'A', ['GUT']), 'Cache Test');
    const first = await renderReportPdf(doc);
    const second = await renderReportPdf(doc);
    expect(first.cached).toBe(false);
    expect(second.cached).toBe(true);
    expect(second.bytes.equals(first.bytes)).toBe(true);
    expect(second.cacheKey).toBe(first.cacheKey);
  });

  it('writes exactly one cache file per distinct document', async () => {
    const before = (await readdir(cacheDir)).filter((f) => f.endsWith('.pdf')).length;
    const doc = buildDocument(classificationFor(3, 'C', ['FAMILY']), 'Once Only');
    await renderReportPdf(doc);
    await renderReportPdf(doc);
    await renderReportPdf(doc);
    const after = (await readdir(cacheDir)).filter((f) => f.endsWith('.pdf')).length;
    expect(after - before).toBe(1);
  });

  it('coalesces concurrent renders of the same uncached document', async () => {
    const doc = buildDocument(classificationFor(2, 'D', ['GUT', 'FAMILY']), 'Concurrent');
    const [a, b, c] = await Promise.all([
      renderReportPdf(doc),
      renderReportPdf(doc),
      renderReportPdf(doc),
    ]);
    expect(a.bytes.equals(b.bytes)).toBe(true);
    expect(b.bytes.equals(c.bytes)).toBe(true);
  });

  it('changes the cache key when the name changes', async () => {
    const cls = classificationFor(1, 'B', []);
    const a = await renderReportPdf(buildDocument(cls, 'Asha'));
    const b = await renderReportPdf(buildDocument(cls, 'Beena'));
    expect(a.cacheKey).not.toBe(b.cacheKey);
  });

  it('changes the cache key when the date changes', async () => {
    const a = await renderReportPdf(
      buildDocument(classificationFor(1, 'C', [], new Date('2026-08-21T09:00:00+05:30')), 'Same'),
    );
    const b = await renderReportPdf(
      buildDocument(classificationFor(1, 'C', [], new Date('2026-08-22T09:00:00+05:30')), 'Same'),
    );
    // The date is printed on the document, so a new day is a new document.
    expect(a.cacheKey).not.toBe(b.cacheKey);
  });

  it('draws the name exactly once and nowhere else', async () => {
    const doc = buildDocument(classificationFor(2, 'A', []), 'Zenobia');
    const out = await renderReportPdf(doc);
    const text = extractText(out.bytes);
    expect(text.split('Zenobia').length - 1).toBe(1);
    expect(text).toContain('Dear Zenobia,');
  });

  it('draws the full fixed copy, including the disclaimer and colophon', async () => {
    const doc = buildDocument(classificationFor(2, 'D', ['GUT', 'FAMILY']), 'Priya');
    const text = extractText((await renderReportPdf(doc)).bytes);

    for (const probe of [
      'Mid Perimenopause',
      'Bone density check recommended if not done in last 2 years',
      'Triage your symptoms first',
      'FSH, LH, oestradiol',
      'estrobolome',
      'not a personality change',
      'It is not a diagnosis',
      'REPORT 2D',
    ]) {
      expect(text, probe).toContain(probe);
    }
  });

  it('preserves typographic punctuation rather than dropping it', async () => {
    // Em dashes and middots are all over the copy. WinAnsi carries them; a
    // mis-set encoding would silently drop every one.
    const doc = buildDocument(classificationFor(1, 'A', []), 'Punctuation');
    const text = extractText((await renderReportPdf(doc)).bytes);
    expect(text).toContain('—'); // em dash
    expect(text).toContain('·'); // middot
    // The vasomotor module carries a degree sign and an en dash range.
    expect(text).toContain('18–19°C');
  });

  it('embeds the Anuva logo once per page', async () => {
    const doc = buildDocument(classificationFor(2, 'D', ['GUT', 'FAMILY']), 'Logo');
    const out = await renderReportPdf(doc);
    const s = out.bytes.toString('latin1');

    // One shared XObject for the image, referenced from every page's resources.
    const images = (s.match(/\/Subtype \/Image/g) ?? []).length;
    expect(images).toBeGreaterThan(0);

    const pages = pageCount(out.bytes);
    expect(pages).toBeGreaterThanOrEqual(3);

    // Every page's content stream must draw it, so the mark is not cover-only.
    const draws = countLogoDraws(out.bytes);
    expect(draws).toBe(pages);
  });

  it('does not print the internal template colophon', async () => {
    const doc = buildDocument(classificationFor(3, 'C', []), 'No Colophon');
    const text = extractText((await renderReportPdf(doc)).bytes);
    expect(text).not.toContain('AW-CB-002');
    expect(text).not.toMatch(/TEMPLATE/i);
    // The reader-facing date and report reference on the cover stay.
    expect(text).toContain('REPORT 3C');
  });

  it('keeps the template version out of the PDF metadata too', async () => {
    const doc = buildDocument(classificationFor(3, 'C', []), 'Metadata');
    const bytes = (await renderReportPdf(doc)).bytes;
    // The copy revision is internal — it appears nowhere in the delivered file.
    expect(metadataContains(bytes, 'AW-CB-002')).toBe(false);
    expect(metadataContains(bytes, 'Report 3C')).toBe(true);
  });

  it('keeps every page inside A4 bounds', async () => {
    const doc = buildDocument(classificationFor(3, 'D', ['GUT', 'FAMILY']), 'Bounds');
    const out = await renderReportPdf(doc);
    const s = out.bytes.toString('latin1');
    const boxes = [...s.matchAll(/\/MediaBox \[([^\]]+)\]/g)].map((m) =>
      (m[1] ?? '').trim().split(/\s+/).map(Number),
    );
    expect(boxes.length).toBeGreaterThan(0);
    for (const box of boxes) {
      expect(Math.round(box[2] ?? 0)).toBe(595); // A4 width in points
      expect(Math.round(box[3] ?? 0)).toBe(842); // A4 height
    }
  });
});
