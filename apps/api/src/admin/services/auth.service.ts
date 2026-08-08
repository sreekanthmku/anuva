import { z } from 'zod';
import {
  getAdminPassword,
  getAdminSessionSecret,
  getAdminSessionTtlHours,
} from '../config.js';
import { UnauthorizedError, ValidationError } from '../errors.js';
import { hmacSign, timingSafeEquals, timingSafeHexEquals } from '../lib/crypto.js';

const loginBodySchema = z.object({
  password: z.string().min(1),
});

export type AdminSessionClaims = {
  sub: 'admin';
  iat: number;
  exp: number;
};

export class AdminAuthService {
  login(body: unknown): { token: string; expiresAt: string; expiresInSeconds: number } {
    const parsed = loginBodySchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError('Validation failed', parsed.error.flatten());
    }

    const password = getAdminPassword();
    const secret = getAdminSessionSecret();

    if (!password || !secret) {
      throw new UnauthorizedError('Admin authentication is not configured');
    }

    if (!timingSafeEquals(parsed.data.password, password)) {
      throw new UnauthorizedError('Invalid credentials');
    }

    const now = Math.floor(Date.now() / 1000);
    const expiresInSeconds = getAdminSessionTtlHours() * 3600;
    const claims: AdminSessionClaims = {
      sub: 'admin',
      iat: now,
      exp: now + expiresInSeconds,
    };

    const payload = Buffer.from(JSON.stringify(claims)).toString('base64url');
    const signature = hmacSign(secret, payload);
    const token = `${payload}.${signature}`;

    return {
      token,
      expiresAt: new Date(claims.exp * 1000).toISOString(),
      expiresInSeconds,
    };
  }

  verifyToken(token: string | undefined | null): AdminSessionClaims {
    if (!token?.trim()) {
      throw new UnauthorizedError('Authentication required');
    }
    const secret = getAdminSessionSecret();
    if (!secret) {
      throw new UnauthorizedError('Admin authentication is not configured');
    }

    const parts = token.trim().split('.');
    if (parts.length !== 2) {
      throw new UnauthorizedError('Invalid token');
    }
    const [payload, signature] = parts;
    if (!payload || !signature) {
      throw new UnauthorizedError('Invalid token');
    }

    const expected = hmacSign(secret, payload);
    if (!timingSafeHexEquals(signature, expected)) {
      throw new UnauthorizedError('Invalid token');
    }

    let claims: AdminSessionClaims;
    try {
      claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as AdminSessionClaims;
    } catch {
      throw new UnauthorizedError('Invalid token');
    }

    if (claims.sub !== 'admin' || typeof claims.exp !== 'number' || typeof claims.iat !== 'number') {
      throw new UnauthorizedError('Invalid token');
    }

    const now = Math.floor(Date.now() / 1000);
    if (claims.exp < now) {
      throw new UnauthorizedError('Token expired');
    }

    return claims;
  }

  me(token: string | undefined | null) {
    const claims = this.verifyToken(token);
    return {
      role: 'admin' as const,
      expiresAt: new Date(claims.exp * 1000).toISOString(),
    };
  }
}
