import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react';
import type { DoctorIdentityResponse } from '@anuva/shared';
import { doctorLogin, doctorLogout, fetchDoctorIdentity } from './api';
import { DoctorIdentityProvider } from './identity';

type GateState = 'checking' | 'unauthenticated' | 'authenticated';

/**
 * The /doctor API routes are gated behind a signed-in session. The session itself lives in an
 * httpOnly cookie the client cannot read, so the only way to know whether one exists is to ask:
 * every load starts in `checking` and calls /doctor/me, and a 401 falls through to the form.
 * The identity behind the session (which doctor, or admin) is then known to every screen below.
 */
export function DoctorLoginGate({ children }: { children: ReactNode }) {
  const [state, setState] = useState<GateState>('checking');
  const [identity, setIdentity] = useState<DoctorIdentityResponse | null>(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const signOut = useCallback(() => {
    // Fire-and-forget: the server drops the session, and the UI returns to the form either way.
    void doctorLogout().catch(() => undefined);
    setIdentity(null);
    setUsername('');
    setPassword('');
    setError(null);
    setState('unauthenticated');
  }, []);

  // Resolves an existing cookie session. An expired or revoked one drops back to the form.
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
        setState('unauthenticated');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [state]);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!username.trim() || !password || submitting) {
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const resolved = await doctorLogin(username.trim(), password);
      setIdentity(resolved);
      setPassword('');
      setState('authenticated');
    } catch (err) {
      setPassword('');
      setError(err instanceof Error ? err.message : 'Unable to sign in.');
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
        <h1 className="text-lg font-semibold text-slate-900">Doctor sign in</h1>
        <p className="mt-1 text-sm text-slate-500">
          Sign in to view your bookings and start consultations.
        </p>

        <label className="mt-4 block text-sm font-medium text-slate-700" htmlFor="doctor-username">
          Username
        </label>
        <input
          id="doctor-username"
          name="username"
          type="text"
          value={username}
          autoFocus
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          onChange={(event) => setUsername(event.target.value)}
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
        />

        <label className="mt-3 block text-sm font-medium text-slate-700" htmlFor="doctor-password">
          Password
        </label>
        <input
          id="doctor-password"
          name="password"
          type="password"
          value={password}
          autoComplete="current-password"
          onChange={(event) => setPassword(event.target.value)}
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
        />

        {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}

        <button
          type="submit"
          className="mt-4 w-full rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
          disabled={!username.trim() || !password || submitting}
        >
          {submitting ? 'Signing in...' : 'Sign in'}
        </button>

        <p className="mt-4 text-xs text-slate-400">
          Lost your password? Ask the Anuva team to set a new one for you.
        </p>
      </form>
    </div>
  );
}
