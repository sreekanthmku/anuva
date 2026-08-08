import { Router } from 'express';
import type { EntityController } from '../controllers/entity.controller.js';

export function createEntityRoutes(entityController: EntityController): Router {
  const router = Router();

  router.get('/meta', entityController.meta);
  router.get('/:resource', entityController.list);
  router.get('/:resource/:id', entityController.get);
  router.post('/:resource', entityController.create);
  router.patch('/:resource/:id', entityController.update);
  router.put('/:resource/:id', entityController.update);
  router.delete('/:resource/:id', entityController.remove);
  router.post('/:resource/:id/actions/:action', entityController.action);

  return router;
}
