import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, apiFetch } from '../src/shared/lib/api';

function jsonResponse(
  body: unknown,
  init: { status?: number; contentType?: string | null } = {},
): Response {
  const status = init.status ?? 200;
  const headers = new Headers();
  if (init.contentType !== null) {
    headers.set('content-type', init.contentType ?? 'application/json');
  }
  return {
    ok: status >= 200 && status < 300,
    status,
    headers,
    json: async () => body,
  } as Response;
}

describe('ApiError', () => {
  it('extends Error and exposes status + message', () => {
    const err = new ApiError(404, 'Not found');
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(404);
    expect(err.message).toBe('Not found');
    expect(err.name).toBe('Error');
  });
});

describe('apiFetch', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns parsed JSON on ok responses', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true, id: 'abc' }));

    const result = await apiFetch<{ ok: boolean; id: string }>('/api/health');

    expect(result).toEqual({ ok: true, id: 'abc' });
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('/api/health');
    expect(init).toMatchObject({
      credentials: 'include',
      headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
    });
  });

  it('merges caller headers and init over defaults', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({}));

    await apiFetch('/api/x', {
      method: 'POST',
      headers: { Authorization: 'Bearer t', 'Content-Type': 'text/plain' },
      body: 'raw',
    });

    const [, init] = fetchMock.mock.calls[0]!;
    expect(init).toMatchObject({
      method: 'POST',
      credentials: 'include',
      body: 'raw',
      headers: {
        'Content-Type': 'text/plain',
        Authorization: 'Bearer t',
      },
    });
  });

  it('returns null when response is ok but not JSON', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(null, { status: 204, contentType: 'text/plain' }),
    );

    const result = await apiFetch<null>('/api/empty');
    expect(result).toBeNull();
  });

  it('throws ApiError with payload.error on non-ok JSON', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ error: 'Invalid session' }, { status: 401 }),
    );

    try {
      await apiFetch('/api/me');
      expect.unreachable('should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError);
      expect((error as ApiError).status).toBe(401);
      expect((error as ApiError).message).toBe('Invalid session');
    }
  });

  it('throws ApiError with status fallback when payload has no error string', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ detail: 'nope' }, { status: 500 }));

    try {
      await apiFetch('/api/boom');
      expect.unreachable('should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError);
      expect((error as ApiError).status).toBe(500);
      expect((error as ApiError).message).toBe('Request failed with status 500');
    }
  });

  it('throws ApiError with status fallback when content-type is not JSON', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(null, { status: 502, contentType: 'text/html' }),
    );

    await expect(apiFetch('/api/gateway')).rejects.toMatchObject({
      status: 502,
      message: 'Request failed with status 502',
    });
  });

  it('propagates network failures from fetch', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));

    await expect(apiFetch('/api/offline')).rejects.toThrow('Failed to fetch');
  });
});
