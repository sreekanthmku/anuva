import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { AdminError } from '../errors.js';
import { logger } from '../../logger.js';

/**
 * Admin-scoped error handler. Mounted on the admin router so failures stay
 * consistent without depending on the host app's error middleware shape.
 */
export function adminErrorHandler(
  err: unknown,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction,
): void {
  const log = req.log ?? logger;

  if (err instanceof ZodError) {
    log.warn({ issues: err.flatten() }, 'Admin request rejected: validation failed');
    res.status(400).json({ error: 'Validation failed', code: 'VALIDATION_ERROR', issues: err.flatten() });
    return;
  }

  if (err instanceof AdminError) {
    log.warn({ status: err.status, code: err.code, details: err.details }, `Admin rejected: ${err.message}`);
    res.status(err.status).json({
      error: err.message,
      code: err.code,
      ...(err.details !== undefined ? { details: err.details } : {}),
    });
    return;
  }

  log.error({ err }, 'Unhandled admin error');
  res.status(500).json({ error: 'Internal server error', code: 'INTERNAL_ERROR' });
}
