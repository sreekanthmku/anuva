import express from 'express';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createAdminRouter } from '../../src/admin/index.js';

function buildApp(prisma: unknown = {}) {
  const app = express();
  app.use(express.json());
  app.use('/admin', createAdminRouter({ prisma: prisma as never }));
  return app;
}

describe('Admin auth API', () => {
  const prev = { ...process.env };

  beforeEach(() => {
    process.env.ADMIN_PASSWORD = 'test-admin-password';
    process.env.ADMIN_SESSION_SECRET = 'test-session-secret-32chars-min';
    process.env.ADMIN_SESSION_TTL_HOURS = '12';
  });

  afterEach(() => {
    process.env = { ...prev };
  });

  it('GET /admin/health is public', async () => {
    const res = await request(buildApp()).get('/admin/health');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it('POST /admin/auth/login rejects bad password', async () => {
    const res = await request(buildApp()).post('/admin/auth/login').send({ password: 'wrong' });
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('UNAUTHORIZED');
  });

  it('POST /admin/auth/login rejects empty body', async () => {
    const res = await request(buildApp()).post('/admin/auth/login').send({});
    expect(res.status).toBe(400);
  });

  it('login → me → entities meta round-trip', async () => {
    const app = buildApp();
    const login = await request(app)
      .post('/admin/auth/login')
      .send({ password: 'test-admin-password' });
    expect(login.status).toBe(200);
    const token = login.body.token as string;

    const me = await request(app).get('/admin/auth/me').set('Authorization', `Bearer ${token}`);
    expect(me.status).toBe(200);
    expect(me.body.role).toBe('admin');

    const meta = await request(app)
      .get('/admin/entities/meta')
      .set('x-admin-token', token);
    expect(meta.status).toBe(200);
    expect(Array.isArray(meta.body.entities)).toBe(true);
    expect(meta.body.entities.length).toBeGreaterThan(50);
  });

  it('protects entity routes without a token', async () => {
    const res = await request(buildApp()).get('/admin/entities/users');
    expect(res.status).toBe(401);
  });

  it('POST /admin/auth/logout requires auth', async () => {
    const res = await request(buildApp()).post('/admin/auth/logout');
    expect(res.status).toBe(401);
  });
});

describe('Admin entity CRUD API (mocked prisma)', () => {
  const prev = { ...process.env };
  let token: string;

  const userRow = {
    id: 'u1',
    phone: '+15551234567',
    name: 'Ada',
    email: null,
    onboardingCompleted: false,
    dieticianPlanAssigned: false,
    familyFeatureOptOut: false,
    createdAt: new Date('2024-01-01T00:00:00.000Z'),
    updatedAt: new Date('2024-01-01T00:00:00.000Z'),
  };

  const userDelegate = {
    findMany: vi.fn(async () => [userRow]),
    count: vi.fn(async () => 1),
    findUnique: vi.fn(async ({ where }: { where: { id: string } }) =>
      where.id === 'u1' ? userRow : null,
    ),
    create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({
      ...userRow,
      ...data,
      id: 'u2',
    })),
    update: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({
      ...userRow,
      ...data,
    })),
    delete: vi.fn(async () => userRow),
  };

  const prisma = { user: userDelegate };

  beforeEach(async () => {
    process.env.ADMIN_PASSWORD = 'test-admin-password';
    process.env.ADMIN_SESSION_SECRET = 'test-session-secret-32chars-min';
    vi.clearAllMocks();
    const login = await request(buildApp(prisma))
      .post('/admin/auth/login')
      .send({ password: 'test-admin-password' });
    token = login.body.token as string;
  });

  afterEach(() => {
    process.env = { ...prev };
  });

  function get(url: string) {
    return request(buildApp(prisma)).get(url).set('Authorization', `Bearer ${token}`);
  }
  function post(url: string, body?: object) {
    const req = request(buildApp(prisma)).post(url).set('Authorization', `Bearer ${token}`);
    return body ? req.send(body) : req;
  }
  function patch(url: string, body: object) {
    return request(buildApp(prisma)).patch(url).set('Authorization', `Bearer ${token}`).send(body);
  }
  function del(url: string) {
    return request(buildApp(prisma)).delete(url).set('Authorization', `Bearer ${token}`);
  }

  it('lists users with pagination meta', async () => {
    const res = await get('/admin/entities/users');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.meta.total).toBe(1);
    expect(userDelegate.findMany).toHaveBeenCalled();
  });

  it('gets a user by id', async () => {
    const res = await get('/admin/entities/users/u1');
    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe('u1');
  });

  it('returns 404 for missing user', async () => {
    const res = await get('/admin/entities/users/missing');
    expect(res.status).toBe(404);
  });

  it('creates a user with validation', async () => {
    const bad = await post('/admin/entities/users', { phone: 'x' });
    expect(bad.status).toBe(400);

    const ok = await post('/admin/entities/users', { phone: '+15559876543', name: 'Grace' });
    expect(ok.status).toBe(201);
    expect(ok.body.data.phone).toBe('+15559876543');
  });

  it('updates and deletes a user', async () => {
    const patched = await patch('/admin/entities/users/u1', { name: 'Ada Lovelace' });
    expect(patched.status).toBe(200);
    expect(patched.body.data.name).toBe('Ada Lovelace');

    const deleted = await del('/admin/entities/users/u1');
    expect(deleted.status).toBe(200);
    expect(userDelegate.delete).toHaveBeenCalled();
  });

  it('rejects unknown resources', async () => {
    const res = await get('/admin/entities/not-a-thing');
    expect(res.status).toBe(404);
  });

  it('falls back to the default sort when the field is not sortable', async () => {
    // Deliberate: a stale sort carried over from another entity should not 400 the whole list.
    // See PrismaEntityRepository.list.
    const res = await get('/admin/entities/users?sort=password');
    expect(res.status).toBe(200);
    expect(res.body.meta.sort).toBe('createdAt');
  });
});
