/**
 * Admin configuration — all secrets loaded from environment variables.
 * Never hardcode credentials here.
 *
 * Values are read lazily so dotenv in the host app can populate process.env
 * before the first auth attempt (ESM imports run before the host module body).
 */

function read(name: string): string {
  return process.env[name]?.trim() ?? '';
}

export function getAdminPassword(): string {
  return read('ADMIN_PASSWORD');
}

export function getAdminSessionSecret(): string {
  const explicit = read('ADMIN_SESSION_SECRET');
  if (explicit) return explicit;
  if (process.env.NODE_ENV === 'production') {
    return '';
  }
  const password = getAdminPassword();
  return password ? `dev-derived:${password}` : '';
}

export function getAdminSessionTtlHours(): number {
  return Math.max(1, Number(process.env.ADMIN_SESSION_TTL_HOURS || 12));
}

export function isAdminAuthConfigured(): boolean {
  return Boolean(getAdminPassword() && getAdminSessionSecret());
}
