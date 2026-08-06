import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type ApiModule = typeof import('../src/lib/api');

function mockLocalStorage() {
  const store = new Map<string, string>();
  const localStorage = {
    getItem: vi.fn((key: string) => store.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store.set(key, value);
    }),
    removeItem: vi.fn((key: string) => {
      store.delete(key);
    }),
    clear: vi.fn(() => {
      store.clear();
    }),
  };
  vi.stubGlobal('localStorage', localStorage);
  return { store, localStorage };
}

async function loadApi(env?: { VITE_API_URL?: string }): Promise<ApiModule> {
  vi.resetModules();
  if (env?.VITE_API_URL !== undefined) {
    vi.stubEnv('VITE_API_URL', env.VITE_API_URL);
  } else {
    vi.unstubAllEnvs();
  }
  return import('../src/lib/api');
}

function jsonResponse(body: unknown, init?: { status?: number; contentType?: string | null }) {
  const status = init?.status ?? 200;
  const contentType = init?.contentType === undefined ? 'application/json' : init.contentType;
  const headers = new Headers();
  if (contentType) {
    headers.set('content-type', contentType);
  }
  return {
    ok: status >= 200 && status < 300,
    status,
    headers,
    json: vi.fn(async () => body),
  };
}

describe('ApiError', () => {
  it('stores status and message on the error instance', async () => {
    mockLocalStorage();
    const { ApiError } = await loadApi();
    const err = new ApiError(403, 'Forbidden');
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(403);
    expect(err.message).toBe('Forbidden');
  });
});

describe('doctor key storage', () => {
  beforeEach(() => {
    mockLocalStorage();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('returns empty string when no key is stored', async () => {
    const { getDoctorKey } = await loadApi();
    expect(getDoctorKey()).toBe('');
  });

  it('trims and persists the doctor key', async () => {
    const { getDoctorKey, setDoctorKey } = await loadApi();
    setDoctorKey('  secret-key  ');
    expect(getDoctorKey()).toBe('secret-key');
  });

  it('clears the stored doctor key', async () => {
    const { getDoctorKey, setDoctorKey, clearDoctorKey } = await loadApi();
    setDoctorKey('to-clear');
    clearDoctorKey();
    expect(getDoctorKey()).toBe('');
  });
});

describe('apiUrl', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('returns the path unchanged when VITE_API_URL is unset', async () => {
    mockLocalStorage();
    const { apiUrl } = await loadApi({ VITE_API_URL: '' });
    expect(apiUrl('/api/doctor/bookings')).toBe('/api/doctor/bookings');
  });

  it('strips /api and prefixes the remote base URL', async () => {
    mockLocalStorage();
    const { apiUrl } = await loadApi({ VITE_API_URL: 'https://api.example.com/' });
    expect(apiUrl('/api/doctor/bookings')).toBe('https://api.example.com/doctor/bookings');
    expect(apiUrl('/api')).toBe('https://api.example.com/');
  });

  it('leaves absolute http(s) URLs untouched', async () => {
    mockLocalStorage();
    const { apiUrl } = await loadApi({ VITE_API_URL: 'https://api.example.com' });
    expect(apiUrl('https://cdn.example.com/file.pdf')).toBe('https://cdn.example.com/file.pdf');
  });
});

describe('apiFetch', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockLocalStorage();
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('sends credentials, JSON content-type, and the doctor key header', async () => {
    const { apiFetch, setDoctorKey } = await loadApi({ VITE_API_URL: '' });
    setDoctorKey('doc-key-1');
    fetchMock.mockResolvedValue(jsonResponse({ ok: true }));

    await apiFetch('/api/doctor/me');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/doctor/me');
    expect(init.credentials).toBe('include');
    const headers = init.headers as Record<string, string>;
    expect(headers['Content-Type']).toBe('application/json');
    expect(headers['x-doctor-key']).toBe('doc-key-1');
  });

  it('merges caller headers over defaults', async () => {
    const { apiFetch } = await loadApi({ VITE_API_URL: '' });
    fetchMock.mockResolvedValue(jsonResponse({ ok: true }));

    await apiFetch('/api/x', {
      headers: { 'Content-Type': 'text/plain', 'x-custom': '1' },
    });

    const init = fetchMock.mock.calls[0][1] as RequestInit;
    const headers = init.headers as Record<string, string>;
    expect(headers['Content-Type']).toBe('text/plain');
    expect(headers['x-custom']).toBe('1');
  });

  it('returns parsed JSON on success', async () => {
    const { apiFetch } = await loadApi({ VITE_API_URL: '' });
    fetchMock.mockResolvedValue(jsonResponse({ bookings: [1] }));

    await expect(apiFetch<{ bookings: number[] }>('/api/doctor/bookings')).resolves.toEqual({
      bookings: [1],
    });
  });

  it('returns null when the response is not JSON', async () => {
    const { apiFetch } = await loadApi({ VITE_API_URL: '' });
    fetchMock.mockResolvedValue(jsonResponse(null, { contentType: 'text/plain' }));

    await expect(apiFetch('/api/doctor/ping')).resolves.toBeNull();
  });

  it('throws ApiError with payload.error when the response is not ok', async () => {
    const { apiFetch, ApiError } = await loadApi({ VITE_API_URL: '' });
    fetchMock.mockResolvedValue(jsonResponse({ error: 'Invalid doctor key' }, { status: 401 }));

    await expect(apiFetch('/api/doctor/me')).rejects.toSatisfy((err: unknown) => {
      expect(err).toBeInstanceOf(ApiError);
      expect(err).toMatchObject({ status: 401, message: 'Invalid doctor key' });
      return true;
    });
  });

  it('throws a status fallback message when error payload is missing', async () => {
    const { apiFetch, ApiError } = await loadApi({ VITE_API_URL: '' });
    fetchMock.mockResolvedValue(jsonResponse({ detail: 'nope' }, { status: 500 }));

    await expect(apiFetch('/api/doctor/me')).rejects.toSatisfy((err: unknown) => {
      expect(err).toBeInstanceOf(ApiError);
      expect(err).toMatchObject({
        status: 500,
        message: 'Request failed with status 500',
      });
      return true;
    });
  });

  it('rewrites relative /api paths when VITE_API_URL is set', async () => {
    const { apiFetch } = await loadApi({ VITE_API_URL: 'https://api.example.com' });
    fetchMock.mockResolvedValue(jsonResponse({ ok: true }));

    await apiFetch('/api/doctor/bookings');

    expect(fetchMock.mock.calls[0][0]).toBe('https://api.example.com/doctor/bookings');
  });
});
