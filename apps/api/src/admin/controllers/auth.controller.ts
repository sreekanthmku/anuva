import type { Request, Response, NextFunction } from 'express';
import type { AdminAuthService } from '../services/auth.service.js';
import { extractAdminToken } from '../middleware/auth.js';

export class AuthController {
  constructor(private readonly authService: AdminAuthService) {}

  login = (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = this.authService.login(req.body);
      res.json(result);
    } catch (e) {
      next(e);
    }
  };

  me = (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = this.authService.me(extractAdminToken(req) ?? req.adminToken);
      res.json(result);
    } catch (e) {
      next(e);
    }
  };

  logout = (_req: Request, res: Response) => {
    // Tokens are stateless HMAC; client discards the token.
    res.json({ ok: true });
  };
}
