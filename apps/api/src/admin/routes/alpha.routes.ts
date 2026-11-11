import { Router } from 'express';
import type { prisma as prismaSingleton } from '@anuva/database';
import { readAlphaAccessConfig } from '../../alphaAccess.js';

/** Most recent alpha sign-ups listed in the summary; counts always cover every one. */
const RECENT_LIMIT = 500;

/**
 * GET /admin/alpha/summary — sign-ups per alpha access code, for tracking who brought in whom.
 *
 * Every configured code is listed, including ones nobody has used yet, plus any code found on an
 * account that is no longer configured (a code retired from ALPHA_CODES still has its sign-ups).
 */
export function createAlphaRoutes(prisma: typeof prismaSingleton): Router {
  const router = Router();

  router.get('/summary', async (_req, res, next) => {
    try {
      const config = readAlphaAccessConfig();
      const [grouped, recent] = await Promise.all([
        prisma.user.groupBy({
          by: ['alphaCode'],
          where: { alphaCode: { not: null } },
          _count: { _all: true },
        }),
        prisma.user.findMany({
          where: { alphaCode: { not: null } },
          orderBy: { createdAt: 'desc' },
          take: RECENT_LIMIT,
          select: {
            id: true,
            name: true,
            phone: true,
            email: true,
            alphaCode: true,
            onboardingCompleted: true,
            erasedAt: true,
            createdAt: true,
          },
        }),
      ]);

      const counts = new Map(grouped.map((g) => [g.alphaCode as string, g._count._all]));
      const codes = [...new Set([...config.codes, ...counts.keys()])].map((code) => ({
        code,
        count: counts.get(code) ?? 0,
        configured: config.codes.includes(code),
      }));

      res.json({
        enabled: config.enabled,
        total: grouped.reduce((sum, g) => sum + g._count._all, 0),
        codes,
        recent,
      });
    } catch (e) {
      next(e);
    }
  });

  return router;
}
