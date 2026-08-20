/**
 * 14-Day Assessment Report module.
 *
 * Classifies a user into one of twelve pre-written report variants
 * (3 perimenopause stages x 4 symptom domains) plus any triggered overlays, and
 * renders the corresponding fixed copy as a PDF, built server-side.
 *
 * Design notes worth knowing before changing anything here:
 *
 *  - The twelve variants are really 3 stage blocks x 4 domain blocks. The domain
 *    copy is byte-identical across stages in the source brief, so it is stored
 *    once (content/domains.ts) rather than duplicated twelve times.
 *  - Nothing about the user appears in the document except her name. Classification
 *    decides WHICH fixed copy she receives; it never generates prose.
 *  - Stage boundaries follow STRAW+10; domain severity follows the Menopause
 *    Rating Scale's published per-subscale cut-offs. See
 *    feature-docs/14dayreports/REPORT14_LOGIC.md.
 *  - The module owns no database tables and writes no rows. Reports are
 *    recomputed from stored answers on every request, which keeps them exactly
 *    reproducible but means there is no immutable record of what was issued —
 *    the first thing to revisit if reports start being shared with doctors.
 *  - Rendered PDFs are cached on disk under `.data/report14/`, keyed by a hash
 *    of the drawn text. A copy edit or a new date misses the cache on its own,
 *    so there is nothing to invalidate by hand.
 *
 * Wiring is a single line in the API entry point; nothing else is touched.
 */

export { createReport14Router, type Report14Deps } from './router.js';
export { REPORT14_CONFIG, type Report14Config } from './config.js';
export { classifyUser } from './classify/index.js';
export { buildDocument, type ReportDocument } from './content/index.js';
export { renderReportHtml } from './render/html.js';
export { renderReportPdf, REPORT14_CACHE_DIR } from './render/pdf.js';
export { Report14Error } from './types.js';
export type { Classification, Domain, ReportId, Stage } from './types.js';
