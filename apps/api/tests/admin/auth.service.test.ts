import { createHmac } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AdminAuthService } from '../../src/admin/services/auth.service.js';

describe('AdminAuthService', () => {
  const prev = { ...process.env };

  beforeEach(() => {
    process.env.ADMIN_PASSWORD = 'test-admin-password';
    process.env.ADMIN_SESSION_SECRET = 'test-session-secret-32chars-min';
    process.env.ADMIN_SESSION_TTL_HOURS = '1';
  });

  afterEach(() => {
    process.env = { ...prev };
  });

  it('rejects empty login body', () => {
    const svc = new AdminAuthService();
    expect(() => svc.login({})).toThrow(/Validation failed/);
  });

  it('rejects wrong password', () => {
    const svc = new AdminAuthService();
    expect(() => svc.login({ password: 'nope' })).toThrow(/Invalid credentials/);
  });

  it('rejects when password is unset', () => {
    delete process.env.ADMIN_PASSWORD;
    const svc = new AdminAuthService();
    expect(() => svc.login({ password: 'x' })).toThrow(/not configured/);
  });

  it('issues a verifiable token on success', () => {
    const svc = new AdminAuthService();
    const result = svc.login({ password: 'test-admin-password' });
    expect(result.token).toContain('.');
    expect(result.expiresInSeconds).toBe(3600);
    const me = svc.me(result.token);
    expect(me.role).toBe('admin');
  });

  it('rejects tampered tokens', () => {
    const svc = new AdminAuthService();
    const { token } = svc.login({ password: 'test-admin-password' });
    const [payload] = token.split('.');
    expect(() => svc.verifyToken(`${payload}.deadbeef`)).toThrow(/Invalid token/);
  });

  it('rejects missing token', () => {
    const svc = new AdminAuthService();
    expect(() => svc.verifyToken(undefined)).toThrow(/Authentication required/);
  });

  it('rejects expired tokens', () => {
    const svc = new AdminAuthService();
    const secret = process.env.ADMIN_SESSION_SECRET!;
    const claims = { sub: 'admin', iat: 1, exp: 2 };
    const payload = Buffer.from(JSON.stringify(claims)).toString('base64url');
    const signature = createHmac('sha256', secret).update(payload).digest('hex');
    expect(() => svc.verifyToken(`${payload}.${signature}`)).toThrow(/Token expired/);
  });
});
