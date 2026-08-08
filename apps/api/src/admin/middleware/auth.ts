import type { NextFunction, Request, Response } from 'express';
import type { AdminAuthService } from '../services/auth.service.js';
import { UnauthorizedError } from '../errors.js';

const ADMIN_AUTH_FLAG = Symbol('adminAuthenticated');

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      adminToken?: string;
    }
  }
}

export function extractAdminToken(req: Request): string | undefined {
  const header = req.get('authorization')?.trim();
  if (header?.toLowerCase().startsWith('bearer ')) {
    return header.slice(7).trim();
  }
  const alt = req.get('x-admin-token')?.trim();
  return alt || undefined;
}

export function createRequireAdminAuth(authService: AdminAuthService) {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      const token = extractAdminToken(req);
      authService.verifyToken(token);
      req.adminToken = token;
      (req as Request & { [ADMIN_AUTH_FLAG]?: boolean })[ADMIN_AUTH_FLAG] = true;
      if (req.log) {
        req.log = req.log.child({ admin: true });
      }
      next();
    } catch (err) {
      next(err instanceof UnauthorizedError ? err : new UnauthorizedError());
    }
  };
}
