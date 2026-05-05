import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { TrustStrip } from '../onboarding/components/TrustStrip';
import { isLoggedIn, tryLogin } from './session';

function userAvatarGlyph(username: string): string {
  const t = username.trim();
  if (!t) return '?';
  return t[0]!.toUpperCase();
}

export default function LoginRoute() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);

  useEffect(() => {
    if (isLoggedIn()) navigate('/home', { replace: true });
  }, [navigate]);

  const avatarLetter = useMemo(() => userAvatarGlyph(username), [username]);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(false);
    if (tryLogin(username, password)) {
      navigate('/home', { replace: true });
      return;
    }
    setError(true);
  }

  return (
    <main className="relative min-h-mobile overflow-hidden bg-surface text-on-surface">
      <div
        className="pointer-events-none absolute left-1/2 top-[-180px] h-[460px] w-[460px] -translate-x-1/2 rounded-full"
        style={{ background: 'radial-gradient(circle, rgba(206, 189, 255, 0.15) 0%, transparent 60%)' }}
      />

      <section className="relative z-10 flex flex-col items-center px-6 pt-8">
        <div className="flex items-end justify-center gap-5">
          <div className="flex flex-col items-center">
            <img src="/anu.png" alt="Anuva logo" className="h-20 w-20 object-contain" />
            <span
              className="mt-2 text-[10px] uppercase tracking-[0.14em] text-outline"
              style={{ fontFamily: '"Geist Mono", ui-monospace, monospace' }}
            >
              ANU
            </span>
          </div>
          <span
            className="mb-1 text-[34px] leading-none text-primary"
            style={{ fontFamily: '"Fraunces Variable", "Fraunces", Georgia, serif', fontWeight: 500 }}
            aria-hidden
          >
            {avatarLetter}
          </span>
        </div>
        <p
          className="mt-4 text-[22px] tracking-[0.18em] text-on-surface"
          style={{
            fontFamily: '"Fraunces Variable", "Fraunces", Georgia, serif',
            fontWeight: 400,
            fontVariationSettings: '"opsz" 144',
            letterSpacing: '0.18em',
          }}
        >
          ANUVA
        </p>
        <p
          className="mt-0.5 text-[13px] italic tracking-normal text-primary"
          style={{
            fontFamily: '"Fraunces Variable", "Fraunces", Georgia, serif',
            fontStyle: 'italic',
            fontWeight: 400,
            fontVariationSettings: '"opsz" 144',
            letterSpacing: '-0.02em',
          }}
        >
          Sign in to continue
        </p>
      </section>

      <section
        className="relative z-10 mt-6 flex min-h-[calc(100svh-220px)] flex-col rounded-t-[32px] border border-b-0 border-border-default bg-surface px-[22px] pb-[22px] pt-[26px]"
        style={{ minHeight: 'calc(100dvh - 220px)' }}
      >
        <div
          className="mb-5 flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-primary"
          style={{ fontFamily: '"Geist Mono", ui-monospace, monospace', fontWeight: 400 }}
        >
          <span className="h-px w-3 bg-primary/60" />
          Welcome back
        </div>

        <form onSubmit={onSubmit} className="flex flex-1 flex-col">
          <label className="mb-1.5 block text-[11px] uppercase tracking-[0.12em] text-outline" style={{ fontFamily: '"Geist Mono", ui-monospace, monospace' }}>
            Username
          </label>
          <input
            type="text"
            name="username"
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="mb-4 w-full rounded-starchart-lg border border-border-default bg-surface-container-low px-4 py-3.5 text-[15px] text-on-surface outline-none ring-primary/40 placeholder:text-outline focus:ring-2"
            style={{ fontFamily: '"Geist", -apple-system, system-ui, sans-serif' }}
            placeholder="anuva"
          />

          <label className="mb-1.5 block text-[11px] uppercase tracking-[0.12em] text-outline" style={{ fontFamily: '"Geist Mono", ui-monospace, monospace' }}>
            Password
          </label>
          <input
            type="password"
            name="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mb-2 w-full rounded-starchart-lg border border-border-default bg-surface-container-low px-4 py-3.5 text-[15px] text-on-surface outline-none ring-primary/40 placeholder:text-outline focus:ring-2"
            style={{ fontFamily: '"Geist", -apple-system, system-ui, sans-serif' }}
            placeholder="••••••"
          />

          {error && (
            <p className="mb-3 text-[13px] text-error" style={{ fontFamily: '"Geist", -apple-system, system-ui, sans-serif' }}>
              Username or password is incorrect.
            </p>
          )}

          <div className="mb-4 mt-2">
            <TrustStrip />
          </div>

          <button
            type="submit"
            className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-secondary px-[22px] py-[14px] text-[14px] font-medium text-inverse-on-surface"
            style={{ fontFamily: '"Geist", -apple-system, system-ui, sans-serif', fontWeight: 500, letterSpacing: '-0.005em' }}
          >
            Sign in
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M5 12h14M13 6l6 6-6 6"
                stroke="#322f37"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>

          <button
            type="button"
            onClick={() => navigate('/assessment')}
            className="mt-3 w-full bg-transparent py-3 text-[13px] font-medium text-on-surface-variant"
            style={{ fontFamily: '"Geist", -apple-system, system-ui, sans-serif' }}
          >
            New here? Start assessment
          </button>
        </form>
      </section>
    </main>
  );
}
