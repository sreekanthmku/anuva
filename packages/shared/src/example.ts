import { z } from 'zod';

/** Body for POST /examples */
export const createExampleBodySchema = z.object({
  name: z.string().min(1).max(256),
});

export type CreateExampleBody = z.infer<typeof createExampleBodySchema>;

export const exampleResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  createdAt: z.string().datetime(),
});

export type ExampleResponse = z.infer<typeof exampleResponseSchema>;
