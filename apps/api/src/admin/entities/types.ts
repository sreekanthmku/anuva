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
  /**
   * Preferred list-table columns (human-readable keys after relation flatten).
   * When omitted, the admin UI hides id / *Id fields by default.
   */
  listFields?: string[];
  /**
   * Prisma `include` for list queries so related labels (user, specialist, …)
   * can be flattened into display columns.
   */
  listInclude?: Record<string, unknown>;
  /** Fields that must never be accepted on create/update */
  readonlyFields: string[];
  /** Soft-delete field if supported */
  softDeleteField?: string;
  /** Boolean field for enable/disable */
  activeField?: string;
  /** Extra admin actions beyond CRUD */
  actions?: AdminEntityAction[];
  /**
   * When false, the admin UI hides Create for this resource.
   * Defaults to true when createFields can be derived from the Zod schema.
   */
  canCreate?: boolean;
  /** Zod schema for create body (after readonly strip) */
  createSchema: z.ZodType<Record<string, unknown>>;
  /** Zod schema for update body (partial) */
  updateSchema: z.ZodType<Record<string, unknown>>;
  /** Group for UI navigation */
  group: string;
};
