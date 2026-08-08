const API_BASE_URL = import.meta.env.VITE_API_URL?.replace(/\/$/, '') || '';
const TOKEN_KEY = 'anuva_admin_token';

export function getStoredToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setStoredToken(token: string | null): void {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // ignore quota / private mode
  }
}

export type AdminApiError = {
  status: number;
  message: string;
  code?: string;
  details?: unknown;
};

/** In dev (no VITE_API_URL) use Vite `/api` proxy; in prod hit the API origin directly. */
function toUrl(path: string): string {
  if (!API_BASE_URL) {
    return `/api${path}`;
  }
  return `${API_BASE_URL}${path}`;
}

export async function adminFetch<T>(
  path: string,
  options: RequestInit & { token?: string | null } = {},
): Promise<T> {
  const { token = getStoredToken(), ...init } = options;
  const headers = new Headers(init.headers);
  if (!headers.has('Content-Type') && init.body) {
    headers.set('Content-Type', 'application/json');
  }
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const res = await fetch(toUrl(path), { ...init, headers });
  const text = await res.text();
  let body: unknown = null;
  if (text) {
    try {
      body = JSON.parse(text) as unknown;
    } catch {
      body = { error: text };
    }
  }

  if (!res.ok) {
    const errBody = body as { error?: string; code?: string; details?: unknown } | null;
    const err: AdminApiError = {
      status: res.status,
      message: errBody?.error ?? `HTTP ${res.status}`,
      code: errBody?.code,
      details: errBody?.details,
    };
    throw err;
  }

  return body as T;
}
