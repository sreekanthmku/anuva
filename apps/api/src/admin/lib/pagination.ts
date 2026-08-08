import { z } from 'zod';

export const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  sort: z.string().min(1).optional(),
  order: z.enum(['asc', 'desc']).default('desc'),
  q: z.string().trim().min(1).optional(),
  filter: z.string().optional(), // JSON object of equality filters
});

export type ListQuery = z.infer<typeof listQuerySchema>;

export type PaginatedResult<T> = {
  data: T[];
  meta: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    sort: string | null;
    order: 'asc' | 'desc';
  };
};

export function parseFilterJson(raw: string | undefined): Record<string, unknown> {
  if (!raw?.trim()) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    throw new Error('filter must be a JSON object');
  } catch (e) {
    throw new Error(e instanceof Error ? e.message : 'Invalid filter JSON');
  }
}

export function toPaginatedResult<T>(
  data: T[],
  total: number,
  query: ListQuery,
  sort: string | null,
): PaginatedResult<T> {
  return {
    data,
    meta: {
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
      sort,
      order: query.order,
    },
  };
}
