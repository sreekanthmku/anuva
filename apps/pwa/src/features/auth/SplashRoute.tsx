import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const SPLASH_MS = 2000;

export default function SplashRoute() {
  const navigate = useNavigate();

  useEffect(() => {
    const id = window.setTimeout(() => {
      navigate('/login', { replace: true });
    }, SPLASH_MS);
    return () => window.clearTimeout(id);
  }, [navigate]);

  return (
    <main className="relative flex min-h-mobile flex-col items-center justify-center overflow-hidden bg-surface px-6 text-on-surface">
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 h-[min(100vw,28rem)] w-[min(100vw,28rem)] -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{ background: 'radial-gradient(circle, rgba(206, 189, 255, 0.22) 0%, transparent 55%)' }}
      />

      <div className="relative z-10 flex flex-col items-center">
        <img src="/anu.png" alt="Anuva" className="mb-6 h-24 w-24 object-contain sm:h-28 sm:w-28" />
        <p
          className="text-[26px] tracking-[0.2em] text-on-surface"
          style={{
            fontFamily: '"Fraunces Variable", "Fraunces", Georgia, serif',
            fontWeight: 400,
            fontVariationSettings: '"opsz" 144',
          }}
        >
          ANUVA
        </p>
        <p
          className="mt-2 text-[12px] italic text-primary"
          style={{
            fontFamily: '"Fraunces Variable", "Fraunces", Georgia, serif',
            fontStyle: 'italic',
            fontWeight: 400,
            fontVariationSettings: '"opsz" 144',
            letterSpacing: '-0.02em',
          }}
        >
          a soft place to land.
        </p>
      </div>
    </main>
  );
}
