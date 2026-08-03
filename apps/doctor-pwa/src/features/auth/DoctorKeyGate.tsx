import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react';
import type { DoctorIdentityResponse } from '@anuva/shared';
import { clearDoctorKey, getDoctorKey, setDoctorKey } from '../../lib/api';
import { fetchDoctorIdentity } from './api';
import { DoctorIdentityProvider } from './identity';

type GateState = 'checking' | 'unauthenticated' | 'authenticated';

/**
 * The /doctor API routes are gated behind an access key — either a doctor's own key or the shared
 * admin key. This collects it once and keeps it in localStorage; apiFetch sends it as x-doctor-key
 * on every request. The key is verified against /doctor/me before the app renders, so the identity
 * behind it (which doctor, or admin) is known to every screen below.
 */
export function DoctorKeyGate({ children }: { children: ReactNode }) {
  const [state, setState] = useState<GateState>(() =>
    getDoctorKey() ? 'checking' : 'unauthenticated',
  );
  const [identity, setIdentity] = useState<DoctorIdentityResponse | null>(null);
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const signOut = useCallback(() => {
    clearDoctorKey();
    setIdentity(null);
    setValue('');
    setError(null);
    setState('unauthenticated');
  }, []);

  // Verifies a key already in localStorage. A stale or revoked key drops back to the form.
  useEffect(() => {
    if (state !== 'checking') {
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        const resolved = await fetchDoctorIdentity();
        if (cancelled) return;
        setIdentity(resolved);
        setState('authenticated');
      } catch {
        if (cancelled) return;
        clearDoctorKey();
        setState('unauthenticated');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [state]);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const key = value.trim();
    if (!key || submitting) {
      return;
    }

    setSubmitting(true);
    setError(null);
    setDoctorKey(key);

    try {
      const resolved = await fetchDoctorIdentity();
      setIdentity(resolved);
      setState('authenticated');
    } catch (err) {
      clearDoctorKey();
      setError(err instanceof Error ? err.message : 'Unable to verify that access key.');
    } finally {
      setSubmitting(false);
    }
  };

  if (state === 'checking') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6 text-sm text-slate-500">
        Checking access...
      </div>
    );
  }

  if (state === 'authenticated' && identity) {
    return (
      <DoctorIdentityProvider value={{ ...identity, signOut }}>{children}</DoctorIdentityProvider>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <form onSubmit={onSubmit} className="w-full max-w-sm rounded-2xl bg-white p-6 shadow">
        <h1 className="text-lg font-semibold text-slate-900">Doctor access</h1>
        <p className="mt-1 text-sm text-slate-500">
          Enter your access key to view your bookings and start consultations.
        </p>

        <input
          type="password"
          value={value}
          autoFocus
          onChange={(event) => setValue(event.target.value)}
          placeholder="Access key"
          className="mt-4 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
        />

        {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}

        <button
          type="submit"
          className="mt-4 w-full rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
          disabled={!value.trim() || submitting}
        >
          {submitting ? 'Verifying...' : 'Continue'}
        </button>
      </form>
    </div>
  );
}
