import { z } from 'zod';

/** Build create/update schemas from a loose field map for catalog-style entities. */

const scalar = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.null(),
  z.array(z.union([z.string(), z.number(), z.boolean()])),
]);

/** Permissive object used when an entity has many optional columns. */
export const looseObjectSchema = z.record(scalar).refine((obj) => Object.keys(obj).length > 0, {
  message: 'Body must include at least one field',
});

export const loosePartialSchema = z.record(scalar);

export function stripReadonly(
  body: Record<string, unknown>,
  readonlyFields: string[],
): Record<string, unknown> {
  const blocked = new Set([...readonlyFields, 'id']);
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(body)) {
    if (!blocked.has(k)) out[k] = v;
  }
  return out;
}

export const dateString = z.union([z.string().datetime(), z.string().regex(/^\d{4}-\d{2}-\d{2}/)]);

export function objectSchema<T extends z.ZodRawShape>(shape: T, partial = false) {
  const base = z.object(shape).strict();
  return partial ? base.partial() : base;
}
