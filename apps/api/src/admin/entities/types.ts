import type { z } from 'zod';

export type AdminEntityAction = {
  /** URL segment, e.g. "enable" → POST /admin/entities/:resource/:id/actions/enable */
  key: string;
  label: string;
  description?: string;
};

export type AdminEntityDefinition = {
  /** URL resource name (kebab-case plural), e.g. "users" */
  resource: string;
  /** Human label */
  label: string;
  /** Prisma client delegate key, e.g. "user" */
  prismaModel: string;
  /** Primary key field */
  idField: string;
  /** Fields that can be searched with `q` (OR contains / equals) */
  searchFields: string[];
  /** Fields allowed for equality filtering */
  filterFields: string[];
  /** Fields allowed for sorting */
  sortableFields: string[];
  /** Default sort field */
  defaultSort: string;
  /** Fields that must never be accepted on create/update */
  readonlyFields: string[];
  /** Soft-delete field if supported */
  softDeleteField?: string;
  /** Boolean field for enable/disable */
  activeField?: string;
  /** Extra admin actions beyond CRUD */
  actions?: AdminEntityAction[];
  /** Zod schema for create body (after readonly strip) */
  createSchema: z.ZodType<Record<string, unknown>>;
  /** Zod schema for update body (partial) */
  updateSchema: z.ZodType<Record<string, unknown>>;
  /** Group for UI navigation */
  group: string;
};
