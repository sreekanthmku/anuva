import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/auth-context';
import { BottomNav } from './components/BottomNav';

type PathId = 'diet' | 'psych' | 'gynec' | 'combined';

const paths: { id: PathId; label: string; tag: string; glyph: string }[] = [
  { id: 'diet', label: 'Diet', tag: 'Nutritionist', glyph: '◇' },
  { id: 'psych', label: 'Psychological', tag: 'Therapy', glyph: '◯' },
  { id: 'gynec', label: 'Gynaec', tag: 'Clinical', glyph: '◇' },
  { id: 'combined', label: 'Combined', tag: 'Recommended', glyph: '✦' },
];

const timeline: { stage: string; status: 'done' | 'active' | 'upcoming' }[] = [
  { stage: 'Pre-assessment', status: 'done' },
  { stage: '7-day tracking', status: 'done' },
  { stage: 'First benchmark', status: 'done' },
  { stage: 'Care path match', status: 'active' },
  { stage: 'Free consultation', status: 'upcoming' },
  { stage: '12-week programme', status: 'upcoming' },
];

const focusTags = ['Vasomotor', 'Sleep support', 'Hormone balance', 'Mediterranean diet'];

function Eyebrow({ children, mint = false }: { children: string; mint?: boolean }) {
  return (
    <div
      className={`mb-2 flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] ${mint ? 'text-primary' : 'text-outline'}`}
    >
      <span className={`h-px w-3 ${mint ? 'bg-primary/60' : 'bg-outline/60'}`} />
      <span style={{ fontFamily: '"Geist Mono", ui-monospace, monospace' }}>{children}</span>
    </div>
  );
}

export default function CareDirectionRoute() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activePath, setActivePath] = useState<PathId>('combined');
  const firstName = user?.name?.trim().split(/\s+/)[0] || 'you';

  return (
    <main className="h-[100dvh] min-h-mobile overflow-x-hidden overflow-y-auto bg-surface pb-28 text-on-surface">
      <header className="sticky top-0 z-30 shrink-0 bg-surface px-[22px] pb-[22px] pt-[max(0.875rem,env(safe-area-inset-top))] text-center shadow-[0_1px_0_0_rgba(167,139,250,0.2)]">
        <div className="mb-3.5 inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/15 px-3 py-1">
          <span className="h-1 w-1 rounded-full bg-primary shadow-[0_0_8px_#cebdff]" />
          <span className="text-[9.5px] uppercase tracking-[0.15em] text-primary" style={{ fontFamily: '"Geist Mono", ui-monospace, monospace' }}>
            Week 1 · Care path ready
          </span>
        </div>
        <h1
          className="font-display mb-2 text-[28px] leading-[1.15] text-on-surface"
        >
          We&apos;ve found the right{' '}
          <em className="not-italic text-primary" style={{ fontFamily: '"DM Sans", sans-serif', fontStyle: 'italic' }}>
            direction
          </em>{' '}
          for you.
        </h1>
        <p className="px-3 text-[12px] leading-[1.5] text-on-surface-variant" style={{ fontFamily: '"Geist", -apple-system, system-ui, sans-serif' }}>
          Based on 7 days of tracking and your benchmark, we recommend a dual-focus care path.
        </p>
      </header>

      <section className="px-[22px] pt-2">
        <article
          className="rounded-[24px] border border-border-default bg-gradient-to-br from-surface-raised to-deep-space p-[22px]"
          style={{ boxShadow: '0 12px 32px rgba(0,0,0,0.45)' }}
        >
          <Eyebrow mint>{`Recommended for ${firstName}`}</Eyebrow>
          <h2
            className="font-display mb-4 text-[26px] leading-[1.15] text-on-surface"
          >
            Combined:{' '}
            <em className="not-italic text-primary" style={{ fontFamily: '"DM Sans", sans-serif', fontStyle: 'italic' }}>
              Gynec + Nutrition
            </em>
          </h2>
          <div className="mb-3.5 flex flex-wrap gap-1.5">
            {focusTags.map((t) => (
              <span
                key={t}
                className="rounded-full border border-primary/30 bg-primary/15 px-2.5 py-1 text-[10.5px] text-primary"
                style={{ fontFamily: '"Geist", -apple-system, system-ui, sans-serif' }}
              >
                {t}
              </span>
            ))}
          </div>
          <p
            className="border-t border-border-default pt-3 text-[12px] leading-[1.5] text-on-surface-variant"
            style={{ fontFamily: '"Geist", -apple-system, system-ui, sans-serif' }}
          >
            Pairs a clinical gynaecologist with a nutritionist for the next 12 weeks. Weekly check-ins with ANU.
          </p>
        </article>
      </section>

      <section className="px-[22px] pt-[18px]">
        <Eyebrow>Other paths available</Eyebrow>
        <div className="grid grid-cols-2 gap-2">
          {paths.map((p) => {
            const isActive = activePath === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setActivePath(p.id)}
                className="rounded-starchart-lg border p-3.5 text-left transition-colors"
                style={{
                  backgroundColor: isActive ? '#2E2A6E' : '#141219',
                  borderColor: isActive ? '#cebdff' : 'rgba(167, 139, 250, 0.2)',
                }}
              >
                <div
                  className="mb-1.5 text-[22px]"
                  style={{
                    color: isActive ? '#cebdff' : '#e6e0ea',
                    fontFamily: '"DM Sans", sans-serif',
                  }}
                >
                  {p.glyph}
                </div>
                <div className="text-[13px] font-medium text-on-surface" style={{ fontFamily: '"Geist", -apple-system, system-ui, sans-serif' }}>
                  {p.label}
                </div>
                <div
                  className="mt-1 text-[9.5px] uppercase tracking-[0.1em]"
                  style={{
                    color: isActive ? '#cebdff' : '#948e9d',
                    fontFamily: '"Geist Mono", ui-monospace, monospace',
                  }}
                >
                  {p.tag}
                </div>
              </button>
            );
          })}
        </div>
      </section>

      <section className="px-[22px] py-[22px]">
        <Eyebrow>Your journey</Eyebrow>
        <div className="relative pl-1">
          {timeline.map((t, i) => {
            const isLast = i === timeline.length - 1;
            const dotBg = t.status === 'done' ? '#cebdff' : t.status === 'active' ? '#e2c62d' : 'transparent';
            const dotBorder = t.status === 'upcoming' ? '#948e9d' : dotBg;

            return (
              <div key={t.stage} className="relative flex gap-3.5 pb-3.5">
                {!isLast && (
                  <div
                    className="absolute bottom-0 left-[9px] top-[19px] w-px"
                    style={{ background: t.status === 'done' ? '#cebdff' : 'rgba(167, 139, 250, 0.2)' }}
                  />
                )}
                <div
                  className="relative z-[1] mt-px flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full"
                  style={{
                    background: dotBg,
                    border: `1.5px solid ${dotBorder}`,
                  }}
                >
                  {t.status === 'done' && (
                    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path d="M5 12l5 5L20 7" stroke="#322f37" strokeWidth="3" strokeLinecap="round" />
                    </svg>
                  )}
                  {t.status === 'active' && <span className="h-1.5 w-1.5 rounded-full bg-inverse-on-surface" />}
                </div>
                <div className="flex-1 pt-px">
                  <p
                    className="text-[13px] text-on-surface"
                    style={{
                      fontFamily: '"Geist", -apple-system, system-ui, sans-serif',
                      fontWeight: t.status === 'active' ? 500 : 400,
                      color: t.status === 'upcoming' ? '#948e9d' : '#e6e0ea',
                    }}
                  >
                    {t.stage}
                  </p>
                  {t.status === 'active' && (
                    <p className="mt-0.5 text-[9.5px] uppercase tracking-[0.1em] text-secondary" style={{ fontFamily: '"Geist Mono", ui-monospace, monospace' }}>
                      In progress now
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => navigate('/booking')}
          className="mt-2.5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-secondary px-[22px] py-[14px] text-[14px] font-medium text-inverse-on-surface"
          style={{ fontFamily: '"Geist", -apple-system, system-ui, sans-serif', letterSpacing: '-0.005em' }}
        >
          Book My Free Consultation
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M5 12h14M13 6l6 6-6 6" stroke="#322f37" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </section>

      <BottomNav />
    </main>
  );
}
