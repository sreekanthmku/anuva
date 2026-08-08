import type { Request, Response, NextFunction } from 'express';
import { listQuerySchema } from '../lib/pagination.js';
import type { EntityService } from '../services/entity.service.js';
import { listEntityMeta } from '../entities/registry.js';
import { ValidationError } from '../errors.js';

export class EntityController {
  constructor(private readonly entityService: EntityService) {}

  meta = (_req: Request, res: Response) => {
    res.json({ entities: listEntityMeta() });
  };

  list = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query = listQuerySchema.parse(req.query);
      const result = await this.entityService.list(req.params.resource!, query);
      res.json(result);
    } catch (e) {
      next(e);
    }
  };

  get = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = req.params.id;
      if (!id) throw new ValidationError('id is required');
      const result = await this.entityService.get(req.params.resource!, id);
      res.json({ data: result });
    } catch (e) {
      next(e);
    }
  };

  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.entityService.create(req.params.resource!, req.body);
      res.status(201).json({ data: result });
    } catch (e) {
      next(e);
    }
  };

  update = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = req.params.id;
      if (!id) throw new ValidationError('id is required');
      const result = await this.entityService.update(req.params.resource!, id, req.body);
      res.json({ data: result });
    } catch (e) {
      next(e);
    }
  };

  remove = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = req.params.id;
      if (!id) throw new ValidationError('id is required');
      const result = await this.entityService.remove(req.params.resource!, id);
      res.json({ data: result });
    } catch (e) {
      next(e);
    }
  };

  action = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = req.params.id;
      const action = req.params.action;
      if (!id || !action) throw new ValidationError('id and action are required');
      const result = await this.entityService.performAction(req.params.resource!, id, action);
      res.json({ data: result });
    } catch (e) {
      next(e);
    }
  };
}
