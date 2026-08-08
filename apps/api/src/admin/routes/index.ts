import { Router } from 'express';
import type { prisma as prismaSingleton } from '@anuva/database';
import { AuthController } from '../controllers/auth.controller.js';
import { EntityController } from '../controllers/entity.controller.js';
import { createRequireAdminAuth } from '../middleware/auth.js';
import { adminErrorHandler } from '../middleware/errorHandler.js';
import { PrismaEntityRepository } from '../repositories/prisma.repository.js';
import { AdminAuthService } from '../services/auth.service.js';
import { EntityService } from '../services/entity.service.js';
import { createAuthRoutes } from './auth.routes.js';
import { createEntityRoutes } from './entity.routes.js';

export type AdminDeps = {
  prisma: typeof prismaSingleton;
  authService?: AdminAuthService;
  entityService?: EntityService;
};

/**
 * Builds the isolated Admin API router.
 *
 * Mount at `/admin` on the host Express app. Does not depend on any
 * patient or doctor routes.
 */
export function createAdminRouter(deps: AdminDeps): Router {
  const authService = deps.authService ?? new AdminAuthService();
  const repo = new PrismaEntityRepository(deps.prisma);
  const entityService = deps.entityService ?? new EntityService(repo);

  const authController = new AuthController(authService);
  const entityController = new EntityController(entityService);

  const router = Router();

  router.get('/health', (_req, res) => {
    res.json({ ok: true, service: 'admin' });
  });

  router.use('/auth', createAuthRoutes(authController, authService));

  const protectedEntities = Router();
  protectedEntities.use(createRequireAdminAuth(authService));
  protectedEntities.use(createEntityRoutes(entityController));
  router.use('/entities', protectedEntities);

  router.use(adminErrorHandler);

  return router;
}
