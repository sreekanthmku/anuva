import { describe, expect, it } from 'vitest';
import {
  AdminError,
  ConflictError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from '../../src/admin/errors.js';
import express from 'express';
import request from 'supertest';
import { adminErrorHandler } from '../../src/admin/middleware/errorHandler.js';
import { ZodError, z } from 'zod';

describe('AdminError subclasses', () => {
  it('carry status and code', () => {
    expect(new UnauthorizedError().status).toBe(401);
    expect(new NotFoundError().status).toBe(404);
    expect(new ValidationError('bad', { a: 1 }).details).toEqual({ a: 1 });
    expect(new ConflictError().code).toBe('CONFLICT');
    expect(new AdminError(418, 'teapot', 'TEAPOT').status).toBe(418);
  });
});

describe('adminErrorHandler', () => {
  function appWith(err: unknown) {
    const app = express();
    app.get('/boom', (_req, _res, next) => next(err));
    app.use(adminErrorHandler);
    return app;
  }

  it('maps AdminError', async () => {
    const res = await request(appWith(new NotFoundError('gone'))).get('/boom');
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('NOT_FOUND');
  });

  it('maps ZodError', async () => {
    let zodErr: ZodError;
    try {
      z.object({ a: z.string() }).parse({});
      throw new Error('unreachable');
    } catch (e) {
      zodErr = e as ZodError;
    }
    const res = await request(appWith(zodErr!)).get('/boom');
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('maps unknown errors to 500', async () => {
    const res = await request(appWith(new Error('explode'))).get('/boom');
    expect(res.status).toBe(500);
    expect(res.body.code).toBe('INTERNAL_ERROR');
  });
});
