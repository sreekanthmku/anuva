import { describe, expect, it } from 'vitest';
import { createExampleBodySchema, exampleResponseSchema } from '../src/example.js';

describe('createExampleBodySchema', () => {
  it('accepts a non-empty name', () => {
    expect(createExampleBodySchema.parse({ name: 'Hello' })).toEqual({ name: 'Hello' });
  });

  it('rejects empty and overlong names', () => {
    expect(createExampleBodySchema.safeParse({ name: '' }).success).toBe(false);
    expect(createExampleBodySchema.safeParse({ name: 'x'.repeat(257) }).success).toBe(false);
  });

  it('rejects missing name', () => {
    expect(createExampleBodySchema.safeParse({}).success).toBe(false);
  });
});

describe('exampleResponseSchema', () => {
  it('accepts a valid example response', () => {
    expect(
      exampleResponseSchema.parse({
        id: 'ex_1',
        name: 'Hello',
        createdAt: '2026-03-15T10:00:00.000Z',
      }),
    ).toMatchObject({ id: 'ex_1', name: 'Hello' });
  });

  it('rejects non-datetime createdAt', () => {
    expect(
      exampleResponseSchema.safeParse({
        id: 'ex_1',
        name: 'Hello',
        createdAt: '2026-03-15',
      }).success,
    ).toBe(false);
  });
});
