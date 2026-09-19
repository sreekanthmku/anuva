import i18n from '../../i18n';
const API_BASE_URL = import.meta.env.VITE_API_URL?.replace(/\/$/, '') || '';

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function toAbsoluteUrl(input: RequestInfo | URL): RequestInfo | URL {
  if (typeof input !== 'string' || !API_BASE_URL || /^https?:\/\//.test(input)) {
    return input;
  }

  // Dev vite proxy strips /api before forwarding; remote API routes omit /api prefix.
  const path = input.replace(/^\/api(?=\/|$)/, '') || '/';
  return `${API_BASE_URL}${path}`;
}

/**
 * The same URL resolution as `apiFetch`, for the rare response that is not JSON — a file download
 * has to be fetched as a blob, so it cannot go through `apiFetch` but must still land on the same
 * origin with the same `/api` handling.
 */
export function apiUrl(path: string): string {
  return toAbsoluteUrl(path) as string;
}

export async function apiFetch<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const response = await fetch(toAbsoluteUrl(input), {
    credentials: 'include',
    ...init,
    headers: {
      'Content-Type': 'application/json',
      // The language she chose in the toggle, not the browser's. The API does not localise yet;
      // sending it now means server-built copy can follow without another client release.
      // `Accept-Language` is CORS-safelisted, so this adds no preflight.
      'Accept-Language': i18n.language,
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
        : i18n.t('errors.requestFailed', { status: response.status });

    throw new ApiError(response.status, message);
  }

  return payload as T;
}
