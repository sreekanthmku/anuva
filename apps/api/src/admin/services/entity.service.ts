import crypto from 'node:crypto';
import type { AdminEntityDefinition } from '../entities/types.js';
import { getEntityByResource } from '../entities/registry.js';
import { stripReadonly } from '../entities/schemaHelpers.js';
import { NotFoundError, ValidationError } from '../errors.js';
import type { ListQuery } from '../lib/pagination.js';
import { serializeRecord, serializeRows } from '../lib/serialize.js';
import type { PrismaEntityRepository } from '../repositories/prisma.repository.js';
import { sha256Hex } from '../lib/crypto.js';
import { logger } from '../../logger.js';
import { completeAnsweredQuestion } from '../../qaNotifications.js';

export class EntityService {
  constructor(private readonly repo: PrismaEntityRepository) {}

  resolve(resource: string): AdminEntityDefinition {
    const entity = getEntityByResource(resource);
    if (!entity) throw new NotFoundError(`Unknown admin resource: ${resource}`);
    return entity;
  }

  async list(resource: string, query: ListQuery) {
    const entity = this.resolve(resource);
    const result = await this.repo.list(entity, query);
    return {
      ...result,
      data: serializeRows(result.data),
    };
  }

  async get(resource: string, id: string) {
    const entity = this.resolve(resource);
    const row = await this.repo.getById(entity, id);
    return serializeRecord(row);
  }

  async create(resource: string, body: unknown) {
    const entity = this.resolve(resource);
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      throw new ValidationError('Body must be a JSON object');
    }
    const stripped = stripReadonly(body as Record<string, unknown>, entity.readonlyFields);
    const parsed = entity.createSchema.safeParse(stripped);
    if (!parsed.success) {
      throw new ValidationError('Validation failed', parsed.error.flatten());
    }
    const row = await this.repo.create(entity, parsed.data);
    await this.afterCreate(resource, row);
    return serializeRecord(row);
  }

  /**
   * Side effects the generic CRUD path cannot infer. An expert answer written here reaches the
   * asker exactly as one written from the specialist portal does: the question is marked answered
   * and she gets the push. Failures are logged, never surfaced — the row is already saved, and an
   * unreachable device must not turn a successful write into a 500.
   */
  private async afterCreate(resource: string, row: unknown) {
    if (resource !== 'expert-answers') {
      return;
    }

    const answer = row as { questionId?: string; expertName?: string } | null;
    if (!answer?.questionId) {
      return;
    }

    try {
      await completeAnsweredQuestion(answer.questionId, answer.expertName ?? '');
    } catch (error) {
      logger.error(
        { err: error, questionId: answer.questionId },
        'Expert answer saved but the asker could not be notified',
      );
    }
  }

  async update(resource: string, id: string, body: unknown) {
    const entity = this.resolve(resource);
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      throw new ValidationError('Body must be a JSON object');
    }
    const stripped = stripReadonly(body as Record<string, unknown>, entity.readonlyFields);
    const parsed = entity.updateSchema.safeParse(stripped);
    if (!parsed.success) {
      throw new ValidationError('Validation failed', parsed.error.flatten());
    }
    if (Object.keys(parsed.data).length === 0) {
      throw new ValidationError('Update body must include at least one field');
    }
    const row = await this.repo.update(entity, id, parsed.data);
    return serializeRecord(row);
  }

  async remove(resource: string, id: string) {
    const entity = this.resolve(resource);
    const row = await this.repo.delete(entity, id);
    return serializeRecord(row);
  }

  async performAction(resource: string, id: string, action: string) {
    const entity = this.resolve(resource);
    const allowed = new Set((entity.actions ?? []).map((a) => a.key));
    if (!allowed.has(action)) {
      throw new ValidationError(`Action not supported: ${action}`);
    }

    // Ensure exists
    await this.repo.getById(entity, id);

    switch (action) {
      case 'enable':
        if (!entity.activeField) throw new ValidationError('Entity does not support enable');
        return serializeRecord(
          await this.repo.update(entity, id, { [entity.activeField]: true }),
        );
      case 'disable':
        if (!entity.activeField) throw new ValidationError('Entity does not support disable');
        return serializeRecord(
          await this.repo.update(entity, id, { [entity.activeField]: false }),
        );
      case 'activate':
        return serializeRecord(await this.repo.update(entity, id, { status: 'ACTIVE' }));
      case 'deactivate':
        return serializeRecord(await this.repo.update(entity, id, { status: 'INACTIVE' }));
      case 'archive':
        if (!entity.softDeleteField) {
          throw new ValidationError('Entity does not support archive');
        }
        return serializeRecord(
          await this.repo.update(entity, id, { [entity.softDeleteField]: new Date() }),
        );
      case 'restore':
        if (!entity.softDeleteField) {
          throw new ValidationError('Entity does not support restore');
        }
        return serializeRecord(
          await this.repo.update(entity, id, { [entity.softDeleteField]: null }),
        );
      case 'rotate-access-key': {
        if (entity.prismaModel !== 'specialist') {
          throw new ValidationError('rotate-access-key is only for specialists');
        }
        const plaintext = crypto.randomBytes(32).toString('base64url');
        const row = await this.repo.update(entity, id, {
          accessKeyHash: sha256Hex(plaintext),
          accessKeyUpdatedAt: new Date(),
        });
        return {
          ...serializeRecord(row),
          accessKey: plaintext,
        };
      }
      default:
        throw new ValidationError(`Unhandled action: ${action}`);
    }
  }
}
