import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react';
import type { DoctorIdentityResponse } from '@anuva/shared';
import { disableDoctorPush } from '../../lib/push';
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
    // Signing out has to take the device's push registration with it, or a shared phone keeps
    // buzzing with the previous doctor's bookings. Done before the session goes: the unregister
    // call is authenticated.
    void disableDoctorPush()
      .catch(() => undefined)
      .finally(() => {
        // Fire-and-forget: the server drops the session, and the UI returns to the form either way.
        void doctorLogout().catch(() => undefined);
      });
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
      <div className="grid min-h-mobile place-items-center bg-surface px-6 text-center">
        <div>
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-primary/25 border-t-primary" />
          <p className="mt-4 text-[13px] text-on-surface-variant">Checking your access…</p>
        </div>
      </div>
    );
  }

  if (state === 'authenticated' && identity) {
    return (
      <DoctorIdentityProvider value={{ ...identity, signOut }}>{children}</DoctorIdentityProvider>
    );
  }

  return (
    <div className="grid min-h-mobile place-items-center bg-surface px-5 py-10 text-on-surface">
      <div className="w-full max-w-[400px]">
        <div className="mb-6 text-center">
          <div className="text-[10.5px] uppercase tracking-[0.2em] text-tertiary">Anuva</div>
          <h1 className="mt-2 font-display text-[30px] leading-[1.1]">
            Specialist <span className="text-primary">portal</span>
          </h1>
          <p className="mx-auto mt-2 max-w-[20rem] text-[13px] leading-[1.55] text-on-surface-variant">
            Sign in to see your consultations, answer questions, and start calls.
          </p>
        </div>

        <form
          onSubmit={onSubmit}
          className="rounded-[24px] border border-border-default bg-surface-raised p-5 shadow-[0_16px_40px_rgba(94,53,102,0.08)]"
        >
          <label
            className="block text-[11px] uppercase tracking-[0.12em] text-outline"
            htmlFor="doctor-username"
          >
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
            className="mt-1.5 min-h-[46px] w-full rounded-[14px] border border-border-default bg-surface-container-low px-3.5 text-[14px] text-on-surface outline-none focus:border-primary focus:ring-0"
          />

          <label
            className="mt-4 block text-[11px] uppercase tracking-[0.12em] text-outline"
            htmlFor="doctor-password"
          >
            Password
          </label>
          <input
            id="doctor-password"
            name="password"
            type="password"
            value={password}
            autoComplete="current-password"
            onChange={(event) => setPassword(event.target.value)}
            className="mt-1.5 min-h-[46px] w-full rounded-[14px] border border-border-default bg-surface-container-low px-3.5 text-[14px] text-on-surface outline-none focus:border-primary focus:ring-0"
          />

          {error ? (
            <div className="mt-3 rounded-[14px] border border-error/20 bg-error-container px-3.5 py-2.5 text-[12.5px] text-on-error-container">
              {error}
            </div>
          ) : null}

          <button
            type="submit"
            className="mt-5 min-h-[48px] w-full rounded-full bg-secondary px-4 text-[14px] font-semibold text-on-secondary transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
            disabled={!username.trim() || !password || submitting}
          >
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p className="mt-5 text-center text-[11.5px] leading-[1.5] text-outline">
          Lost your password? Ask the Anuva team to set a new one for you.
        </p>
      </div>
    </div>
  );
}
