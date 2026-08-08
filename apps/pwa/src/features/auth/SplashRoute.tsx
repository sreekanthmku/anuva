import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './auth-context';
import { getPostAuthPath } from './postAuthPath';

const SPLASH_MS = 2000;

export default function SplashRoute() {
  const navigate = useNavigate();
  const { status, user } = useAuth();

  useEffect(() => {
    if (status === 'loading') {
      return undefined;
    }

    const id = window.setTimeout(() => {
      navigate(status === 'authenticated' && user ? getPostAuthPath(user) : '/login', {
        replace: true,
      });
    }, SPLASH_MS);
    return () => window.clearTimeout(id);
  }, [navigate, status, user]);

  return (
    <main className="relative flex min-h-mobile flex-col items-center justify-center overflow-x-hidden overflow-y-auto bg-surface px-6 text-on-surface">
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 h-[min(100vw,28rem)] w-[min(100vw,28rem)] -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{
          background: 'transparent',
        }}
      />

      <div className="relative z-10 flex flex-col items-center">
        <img src="/anu.png" alt="Anuva" className="mb-6 h-24 w-24 object-contain sm:h-28 sm:w-28" />
        <p
          className="text-[26px] tracking-[0.2em] text-on-surface"
          style={{
            fontFamily: '"Fraunces", serif',
            fontWeight: 500,
          }}
        >
          ANUVA WELLNESS
        </p>
        <p
          className="mt-2 text-[20px] text-secondary"
          style={{
            fontFamily: '"Dancing Script", cursive',
            fontWeight: 600,
          }}
        >
          a soft place to land.
        </p>
      </div>
    </main>
  );
}
