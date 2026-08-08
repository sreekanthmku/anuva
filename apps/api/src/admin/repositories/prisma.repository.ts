import type { prisma as prismaSingleton } from '@anuva/database';
import type { AdminEntityDefinition } from '../entities/types.js';
import { ConflictError, NotFoundError, ValidationError } from '../errors.js';
import {
  parseFilterJson,
  toPaginatedResult,
  type ListQuery,
  type PaginatedResult,
} from '../lib/pagination.js';

export type AdminPrismaClient = typeof prismaSingleton;

type Delegate = {
  findMany: (args: unknown) => Promise<unknown[]>;
  findUnique: (args: unknown) => Promise<unknown | null>;
  create: (args: unknown) => Promise<unknown>;
  update: (args: unknown) => Promise<unknown>;
  delete: (args: unknown) => Promise<unknown>;
  count: (args: unknown) => Promise<number>;
};

type PrismaKnownError = {
  code: string;
  meta?: unknown;
  message: string;
};

function isPrismaKnownError(err: unknown): err is PrismaKnownError {
  return (
    typeof err === 'object' &&
    err !== null &&
    (err as { name?: string }).name === 'PrismaClientKnownRequestError' &&
    typeof (err as { code?: unknown }).code === 'string'
  );
}

function isPrismaValidationError(err: unknown): err is { message: string } {
  return (
    typeof err === 'object' &&
    err !== null &&
    (err as { name?: string }).name === 'PrismaClientValidationError' &&
    typeof (err as { message?: unknown }).message === 'string'
  );
}

function getDelegate(prisma: AdminPrismaClient, model: string): Delegate {
  const delegate = (prisma as unknown as Record<string, Delegate | undefined>)[model];
  if (!delegate || typeof delegate !== 'object') {
    throw new ValidationError(`Unknown Prisma model: ${model}`);
  }
  return delegate;
}

function buildSearchWhere(
  entity: AdminEntityDefinition,
  q: string | undefined,
): Record<string, unknown> | undefined {
  if (!q || entity.searchFields.length === 0) return undefined;
  return {
    OR: entity.searchFields.map((field) => ({
      [field]: { contains: q, mode: 'insensitive' },
    })),
  };
}

function buildFilterWhere(
  entity: AdminEntityDefinition,
  filterRaw: string | undefined,
): Record<string, unknown> {
  let parsed: Record<string, unknown>;
  try {
    parsed = parseFilterJson(filterRaw);
  } catch (e) {
    throw new ValidationError(e instanceof Error ? e.message : 'Invalid filter');
  }

  const where: Record<string, unknown> = {};
  const allowed = new Set(entity.filterFields);
  for (const [key, value] of Object.entries(parsed)) {
    if (!allowed.has(key)) {
      throw new ValidationError(`Filter field not allowed: ${key}`);
    }
    where[key] = value;
  }
  return where;
}

function coerceDates(data: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...data };
  for (const [k, v] of Object.entries(out)) {
    if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v) && Number.isNaN(Number(v))) {
      const d = new Date(v);
      if (!Number.isNaN(d.getTime())) out[k] = d;
    }
  }
  if (typeof out.embedding === 'string') {
    out.embedding = Buffer.from(out.embedding, 'base64');
  }
  return out;
}

function mapPrismaError(err: unknown): never {
  if (isPrismaKnownError(err)) {
    if (err.code === 'P2025') throw new NotFoundError('Record not found');
    if (err.code === 'P2002') {
      throw new ConflictError('Unique constraint violated', err.meta);
    }
    if (err.code === 'P2003') {
      throw new ValidationError('Foreign key constraint failed', err.meta);
    }
    throw new ValidationError(`Database error: ${err.message}`, { code: err.code });
  }
  if (isPrismaValidationError(err)) {
    throw new ValidationError(err.message);
  }
  throw err;
}

export class PrismaEntityRepository {
  constructor(private readonly prisma: AdminPrismaClient) {}

  async list(
    entity: AdminEntityDefinition,
    query: ListQuery,
  ): Promise<PaginatedResult<Record<string, unknown>>> {
    const delegate = getDelegate(this.prisma, entity.prismaModel);
    // Stale sort from a previous entity (e.g. completedAt) should fall back quietly.
    const sortField =
      query.sort && entity.sortableFields.includes(query.sort)
        ? query.sort
        : entity.defaultSort;

    const searchWhere = buildSearchWhere(entity, query.q);
    const filterWhere = buildFilterWhere(entity, query.filter);
    const where = {
      ...filterWhere,
      ...(searchWhere ?? {}),
    };

    const skip = (query.page - 1) * query.pageSize;
    const listArgs: Record<string, unknown> = {
      where,
      orderBy: { [sortField]: query.order },
      skip,
      take: query.pageSize,
    };
    if (entity.listInclude && Object.keys(entity.listInclude).length > 0) {
      listArgs.include = entity.listInclude;
    }

    try {
      const [rows, total] = await Promise.all([
        delegate.findMany(listArgs),
        delegate.count({ where }),
      ]);

      return toPaginatedResult(rows as Record<string, unknown>[], total, query, sortField);
    } catch (err) {
      if (query.q && searchWhere) {
        try {
          const equalsWhere = {
            ...filterWhere,
            OR: entity.searchFields.map((field) => ({ [field]: query.q })),
          };
          const equalsArgs: Record<string, unknown> = {
            where: equalsWhere,
            orderBy: { [sortField]: query.order },
            skip,
            take: query.pageSize,
          };
          if (entity.listInclude && Object.keys(entity.listInclude).length > 0) {
            equalsArgs.include = entity.listInclude;
          }
          const [rows, total] = await Promise.all([
            delegate.findMany(equalsArgs),
            delegate.count({ where: equalsWhere }),
          ]);
          return toPaginatedResult(rows as Record<string, unknown>[], total, query, sortField);
        } catch (inner) {
          mapPrismaError(inner);
        }
      }
      mapPrismaError(err);
    }
  }

  async getById(entity: AdminEntityDefinition, id: string): Promise<Record<string, unknown>> {
    const delegate = getDelegate(this.prisma, entity.prismaModel);
    try {
      const row = await delegate.findUnique({
        where: { [entity.idField]: id },
      });
      if (!row) throw new NotFoundError(`${entity.label} not found`);
      return row as Record<string, unknown>;
    } catch (err) {
      if (err instanceof NotFoundError) throw err;
      mapPrismaError(err);
    }
  }

  async create(
    entity: AdminEntityDefinition,
    data: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const delegate = getDelegate(this.prisma, entity.prismaModel);
    try {
      const row = await delegate.create({ data: coerceDates(data) });
      return row as Record<string, unknown>;
    } catch (err) {
      mapPrismaError(err);
    }
  }

  async update(
    entity: AdminEntityDefinition,
    id: string,
    data: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const delegate = getDelegate(this.prisma, entity.prismaModel);
    try {
      const row = await delegate.update({
        where: { [entity.idField]: id },
        data: coerceDates(data),
      });
      return row as Record<string, unknown>;
    } catch (err) {
      mapPrismaError(err);
    }
  }

  async delete(entity: AdminEntityDefinition, id: string): Promise<Record<string, unknown>> {
    const delegate = getDelegate(this.prisma, entity.prismaModel);
    try {
      const row = await delegate.delete({
        where: { [entity.idField]: id },
      });
      return row as Record<string, unknown>;
    } catch (err) {
      mapPrismaError(err);
    }
  }
}
