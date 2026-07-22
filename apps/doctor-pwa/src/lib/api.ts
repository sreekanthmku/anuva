const API_BASE_URL = import.meta.env.VITE_API_URL?.replace(/\/$/, '') || '';
const DOCTOR_KEY_STORAGE = 'anuva.doctorKey';

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function getDoctorKey(): string {
  return localStorage.getItem(DOCTOR_KEY_STORAGE) || '';
}

export function setDoctorKey(key: string): void {
  localStorage.setItem(DOCTOR_KEY_STORAGE, key.trim());
}

export function clearDoctorKey(): void {
  localStorage.removeItem(DOCTOR_KEY_STORAGE);
}

function toAbsoluteUrl(input: RequestInfo | URL): RequestInfo | URL {
  if (typeof input !== 'string' || !API_BASE_URL || /^https?:\/\//.test(input)) {
    return input;
  }

  const path = input.replace(/^\/api(?=\/|$)/, '') || '/';
  return `${API_BASE_URL}${path}`;
}

export async function apiFetch<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const response = await fetch(toAbsoluteUrl(input), {
    credentials: 'include',
    ...init,
    headers: {
      'Content-Type': 'application/json',
      'x-doctor-key': getDoctorKey(),
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
