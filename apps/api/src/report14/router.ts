/**
 * 14-Day Assessment Report — HTTP surface.
 *
 * Self-contained: auth is injected rather than imported, so the module has no
 * dependency on the API's entry point and stays independently testable. It also
 * carries its own error middleware, so wiring it up never touches the global
 * error handler.
 *
 *   GET /report14            classification + document as JSON (for the PWA)
 *   GET /report14/document   the same report as print-ready HTML
 */

import { Router } from 'express';
import type { Request, RequestHandler, Response, NextFunction } from 'express';
import { classifyUser } from './classify/index.js';
import { buildDocument } from './content/index.js';
import { renderReportHtml } from './render/html.js';
import { renderReportPdf } from './render/pdf.js';
import { Report14Error } from './types.js';

export interface Report14Deps {
  /** Resolves the signed-in user, or throws. Supplied by the host app. */
  resolveUserId: (req: Request) => Promise<string>;
}

function noStore(res: Response): void {
  // The document is health data. Never let a shared cache hold it.
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.setHeader('Pragma', 'no-cache');
}

/**
 * Diagnostics explain the classification without putting anything about her into
 * the document itself. Useful for support and for validating the classifier
 * against clinician judgement later.
 */
function diagnostics(result: Awaited<ReturnType<typeof classifyUser>>) {
  const { classification: c } = result;
  return {
    reportId: c.reportId,
    stage: c.stage,
    domain: c.domain,
    overlays: c.overlays,
    flags: c.flags,
    window: {
      anchorMode: c.window.anchorMode,
      start: c.window.start?.toISOString() ?? null,
      end: c.window.end?.toISOString() ?? null,
      daysCovered: c.window.daysCovered,
      reason: c.window.reason,
    },
    stage_detail: {
      rule: c.stageDetail.rule,
      reason: c.stageDetail.reason,
    },
    domain_detail: {
      reason: c.domainDetail.reason,
      tieBreakUsed: c.domainDetail.tieBreakUsed,
      blendApplied: c.domainDetail.blendApplied,
      degradedDomains: c.domainDetail.degradedDomains,
      assessmentIndex: {
        A: round(c.domainDetail.assessment.A.index),
        B: round(c.domainDetail.assessment.B.index),
        C: round(c.domainDetail.assessment.C.index),
      },
      logIndex: {
        A: c.domainDetail.logs.A ? round(c.domainDetail.logs.A.index) : null,
        B: c.domainDetail.logs.B ? round(c.domainDetail.logs.B.index) : null,
        C: null,
      },
      finalIndex: {
        A: round(c.domainDetail.final.A),
        B: round(c.domainDetail.final.B),
        C: round(c.domainDetail.final.C),
      },
      qolImpact: {
        A: round(c.domainDetail.qol.A),
        B: round(c.domainDetail.qol.B),
        C: round(c.domainDetail.qol.C),
      },
    },
    overlay_detail: c.overlayDetail.reasons,
    config: c.config,
    generatedAt: c.generatedAt.toISOString(),
  };
}

function round(n: number): number {
  return Math.round(n * 1000) / 1000;
}

export function createReport14Router(deps: Report14Deps): Router {
  const router = Router();

  const handleJson: RequestHandler = async (req, res, next) => {
    try {
      noStore(res);
      const userId = await deps.resolveUserId(req);
      const result = await classifyUser(userId);
      const doc = buildDocument(result.classification, result.source.userName);
      res.json({ document: doc, diagnostics: diagnostics(result) });
    } catch (e) {
      next(e);
    }
  };

  const handleHtml: RequestHandler = async (req, res, next) => {
    try {
      noStore(res);
      const userId = await deps.resolveUserId(req);
      const result = await classifyUser(userId);
      const doc = buildDocument(result.classification, result.source.userName);
      res.type('html').send(renderReportHtml(doc));
    } catch (e) {
      next(e);
    }
  };

  /**
   * The real deliverable: a PDF built server-side. Served straight from the
   * disk cache when we already have it, rendered and stored when we do not —
   * the cache key is a hash of the drawn text, so a copy edit or a new date
   * misses automatically and there is nothing to invalidate by hand.
   */
  const handlePdf: RequestHandler = async (req, res, next) => {
    try {
      noStore(res);
      const userId = await deps.resolveUserId(req);
      const result = await classifyUser(userId);
      const doc = buildDocument(result.classification, result.source.userName);
      const pdf = await renderReportPdf(doc);

      req.log?.info?.(
        {
          reportId: doc.reportId,
          cacheKey: pdf.cacheKey,
          cached: pdf.cached,
          bytes: pdf.bytes.length,
        },
        'report14: pdf served',
      );

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Length', String(pdf.bytes.length));
      // `inline` so a phone opens it in the viewer, where Share and Save both
      // live, rather than dropping a file into Downloads with no preview.
      res.setHeader('Content-Disposition', `inline; filename="${pdf.filename}"`);
      res.setHeader('X-Report-Cache', pdf.cached ? 'hit' : 'miss');
      res.end(pdf.bytes);
    } catch (e) {
      next(e);
    }
  };

  router.get('/', handleJson);
  router.get('/pdf', handlePdf);
  // Kept as the HTML view of the same document: useful for debugging a layout
  // question without regenerating PDFs, and a fallback if PDF rendering fails.
  router.get('/document', handleHtml);

  // Module-local error handling. Keeps the global handler untouched, and means a
  // Report14Error surfaces as its intended status rather than a 500.
  router.use(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    (err: unknown, req: Request, res: Response, _next: NextFunction) => {
      if (err instanceof Report14Error) {
        req.log?.warn?.({ status: err.status, code: err.code }, `report14: ${err.message}`);
        res.status(err.status).json({ error: err.message, code: err.code });
        return;
      }
      // Anything with a numeric status came from the injected auth resolver
      // (a 401 for an expired session, typically) — pass its intent through.
      if (
        typeof err === 'object' &&
        err !== null &&
        typeof (err as { status?: unknown }).status === 'number'
      ) {
        const status = (err as { status: number }).status;
        const message =
          (err as { message?: unknown }).message ?? 'Request could not be completed.';
        res.status(status).json({ error: String(message) });
        return;
      }
      req.log?.error?.({ err }, 'report14: unhandled failure');
      res.status(500).json({ error: 'Your report could not be generated. Please try again.' });
    },
  );

  return router;
}
