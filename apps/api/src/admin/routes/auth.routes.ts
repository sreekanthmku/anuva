import { Router } from 'express';
import type { AuthController } from '../controllers/auth.controller.js';
import { createRequireAdminAuth } from '../middleware/auth.js';
import type { AdminAuthService } from '../services/auth.service.js';

export function createAuthRoutes(
  authController: AuthController,
  authService: AdminAuthService,
): Router {
  const router = Router();
  const requireAuth = createRequireAdminAuth(authService);

  router.post('/login', authController.login);
  router.post('/logout', requireAuth, authController.logout);
  router.get('/me', requireAuth, authController.me);

  return router;
}
