const API_BASE_URL = import.meta.env.VITE_API_URL?.replace(/\/$/, '') || '';

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/** The absolute URL for an `/api/...` path — needed where fetch is bypassed, e.g. an XHR upload. */
export function apiUrl(path: string): string {
  return String(toAbsoluteUrl(path));
}

function toAbsoluteUrl(input: RequestInfo | URL): RequestInfo | URL {
  if (typeof input !== 'string' || !API_BASE_URL || /^https?:\/\//.test(input)) {
    return input;
  }

  const path = input.replace(/^\/api(?=\/|$)/, '') || '/';
  return `${API_BASE_URL}${path}`;
}

/**
 * The doctor session lives in an httpOnly cookie, so nothing here reads or attaches a credential —
 * `credentials: 'include'` is the whole of it. The API is a separate origin in production, which
 * is why every request needs it explicitly.
 */
export async function apiFetch<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const response = await fetch(toAbsoluteUrl(input), {
    credentials: 'include',
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
  });

  const contentType = response.headers.get('content-type') || '';
  const isJson = contentType.includes('application/json');
  const payload = isJson ? await response.json() : null;

  if (!response.ok) {
    const message =
      payload &&
      typeof payload === 'object' &&
      'error' in payload &&
      typeof payload.error === 'string'
        ? payload.error
        : `Request failed with status ${response.status}`;

    throw new ApiError(response.status, message);
  }

  return payload as T;
}
