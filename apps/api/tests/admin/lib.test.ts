import { describe, expect, it } from 'vitest';
import { hmacSign, timingSafeEquals, timingSafeHexEquals } from '../../src/admin/lib/crypto.js';
import { listQuerySchema, parseFilterJson, toPaginatedResult } from '../../src/admin/lib/pagination.js';
import { serializeRecord } from '../../src/admin/lib/serialize.js';

describe('admin crypto', () => {
  it('timingSafeEquals matches equal strings', () => {
    expect(timingSafeEquals('abc', 'abc')).toBe(true);
    expect(timingSafeEquals('abc', 'abd')).toBe(false);
    expect(timingSafeEquals('abc', 'ab')).toBe(false);
  });

  it('hmacSign is deterministic', () => {
    expect(hmacSign('sec', 'pay')).toBe(hmacSign('sec', 'pay'));
    expect(hmacSign('sec', 'pay')).not.toBe(hmacSign('sec', 'other'));
  });

  it('timingSafeHexEquals validates hex digests', () => {
    const a = hmacSign('s', 'p');
    expect(timingSafeHexEquals(a, a)).toBe(true);
    expect(timingSafeHexEquals(a, 'zz')).toBe(false);
  });
});

describe('pagination helpers', () => {
  it('parses list query defaults', () => {
    const q = listQuerySchema.parse({});
    expect(q.page).toBe(1);
    expect(q.pageSize).toBe(25);
    expect(q.order).toBe('desc');
  });

  it('rejects oversized pageSize', () => {
    expect(() => listQuerySchema.parse({ pageSize: 500 })).toThrow();
  });

  it('parseFilterJson accepts objects and rejects arrays', () => {
    expect(parseFilterJson('{"active":true}')).toEqual({ active: true });
    expect(() => parseFilterJson('[1]')).toThrow();
  });

  it('toPaginatedResult computes totalPages', () => {
    const result = toPaginatedResult(
      [{ id: 1 }],
      50,
      { page: 2, pageSize: 25, order: 'asc' },
      'id',
    );
    expect(result.meta.totalPages).toBe(2);
    expect(result.meta.sort).toBe('id');
  });
});

describe('serializeRecord', () => {
  it('redacts sensitive fields and formats dates', () => {
    const out = serializeRecord({
      id: '1',
      tokenHash: 'secret',
      passwordHash: 'scrypt$16384$8$1$aa$bb',
      createdAt: new Date('2024-01-01T00:00:00.000Z'),
      embedding: Buffer.from('abc'),
    });
    expect(out.tokenHash).toBe('[redacted]');
    expect(out.passwordHash).toBe('[redacted]');
    expect(out.createdAt).toBe('2024-01-01T00:00:00.000Z');
    expect(out.embedding).toBe('[binary 3 bytes]');
  });
});
