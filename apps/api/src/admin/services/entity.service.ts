import type { AdminEntityDefinition } from '../entities/types.js';
import { getEntityByResource } from '../entities/registry.js';
import { stripReadonly } from '../entities/schemaHelpers.js';
import { NotFoundError, ValidationError } from '../errors.js';
import type { ListQuery } from '../lib/pagination.js';
import { flattenListRows } from '../lib/listDisplay.js';
import { serializeRecord, serializeRows } from '../lib/serialize.js';
import type { PrismaEntityRepository } from '../repositories/prisma.repository.js';
import { hashDoctorPassword } from '../../doctorAuth.js';
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
      data: serializeRows(flattenListRows(result.data)),
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
    const row = await this.repo.create(entity, await this.prepareWrite(entity, parsed.data, 'create'));
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
    const data = await this.prepareWrite(entity, parsed.data, 'update');
    const row = await this.repo.update(entity, id, data);

    // An admin resetting a doctor's password is nearly always responding to a lost or leaked one,
    // so the old sessions must not survive it. The doctor's own change path does the same.
    if (entity.prismaModel === 'doctorAccount' && 'passwordHash' in data) {
      await this.repo.revokeDoctorSessions(id);
    }

    return serializeRecord(row);
  }

  /**
   * Model-specific massaging the generic CRUD path cannot infer. Today that is only the doctor
   * portal login: a plaintext `password` is turned into a scrypt `passwordHash` so the column
   * never sees a raw password, and the doctor/admin split is enforced here rather than in the Zod
   * schema, which cannot see the row's existing role on a partial update.
   */
  private async prepareWrite(
    entity: AdminEntityDefinition,
    data: Record<string, unknown>,
    mode: 'create' | 'update',
  ): Promise<Record<string, unknown>> {
    // A support reply stamps its own timestamp — leaving that to whoever types the answer means a
    // ticket that reads as answered with no record of when.
    if (entity.prismaModel === 'supportTicket') {
      const next: Record<string, unknown> = { ...data };
      if (typeof next.response === 'string' && next.response.trim() && !next.respondedAt) {
        next.respondedAt = new Date();
        if (!next.status) {
          next.status = 'resolved';
        }
      }
      return next;
    }

    if (entity.prismaModel !== 'doctorAccount') {
      return data;
    }

    const next: Record<string, unknown> = { ...data };

    if (typeof next.username === 'string') {
      next.username = next.username.trim().toLowerCase();
    }

    if ('password' in next) {
      const password = next.password;
      delete next.password;
      if (typeof password !== 'string') {
        throw new ValidationError('password must be a string');
      }
      next.passwordHash = await hashDoctorPassword(password);
      next.passwordUpdatedAt = new Date();
    }

    const role = mode === 'create' ? (next.role ?? 'doctor') : next.role;

    if (role === 'admin' && next.specialistId) {
      throw new ValidationError('An admin account must not be tied to a specialist');
    }
    if (role === 'doctor' && (mode === 'create' ? !next.specialistId : next.specialistId === null)) {
      throw new ValidationError('A doctor account needs a specialist');
    }
    // On update the role may be unchanged and therefore absent, so clearing the specialist has to
    // be paired with an explicit switch to admin — otherwise the account is left unable to log in.
    if (mode === 'update' && role === undefined && next.specialistId === null) {
      throw new ValidationError('Set role to admin to clear the specialist');
    }

    return next;
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
      case 'revoke-sessions': {
        if (entity.prismaModel !== 'doctorAccount') {
          throw new ValidationError('revoke-sessions is only for doctor accounts');
        }
        const revoked = await this.repo.revokeDoctorSessions(id);
        return { id, revoked };
      }
      default:
        throw new ValidationError(`Unhandled action: ${action}`);
    }
  }
}
