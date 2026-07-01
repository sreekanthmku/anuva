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
      <span style={{ fontFamily: '"Mulish", sans-serif' }}>{children}</span>
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
      <header className="sticky top-0 z-30 shrink-0 bg-surface px-3 pb-[22px] pt-[max(0.875rem,env(safe-area-inset-top))] text-center">
        <div className="mb-3.5 inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/15 px-3 py-1">
          <span className="h-1 w-1 rounded-full bg-primary" />
          <span
            className="text-[9.5px] uppercase tracking-[0.15em] text-primary"
            style={{ fontFamily: '"Mulish", sans-serif' }}
          >
            Week 1 · Care path ready
          </span>
        </div>
        <h1 className="font-display mb-2 text-[28px] leading-[1.15] text-on-surface">
          We&apos;ve found the right{' '}
          <em className="not-italic text-primary" style={{ fontFamily: '"Fraunces", sans-serif' }}>
            direction
          </em>{' '}
          for you.
        </h1>
        <p
          className="px-3 text-[12px] leading-[1.5] text-on-surface-variant"
          style={{ fontFamily: '"Mulish", -apple-system, system-ui, sans-serif' }}
        >
          Based on 7 days of tracking and your benchmark, we recommend a dual-focus care path.
        </p>
      </header>

      <section className="px-3 pt-2">
        <article
          className="rounded-[20px] border border-border-default bg-primary-container p-[22px]"
          style={{}}
        >
          <Eyebrow mint>{`Recommended for ${firstName}`}</Eyebrow>
          <h2 className="font-display mb-4 text-[26px] leading-[1.15] text-on-surface">
            Combined:{' '}
            <em
              className="not-italic text-primary"
              style={{ fontFamily: '"Fraunces", sans-serif' }}
            >
              Gynec + Nutrition
            </em>
          </h2>
          <div className="mb-3.5 flex flex-wrap gap-1.5">
            {focusTags.map((t) => (
              <span
                key={t}
                className="rounded-full border border-primary/30 bg-primary/15 px-2.5 py-1 text-[10.5px] text-primary"
                style={{ fontFamily: '"Mulish", -apple-system, system-ui, sans-serif' }}
              >
                {t}
              </span>
            ))}
          </div>
          <p
            className="border-t border-border-default pt-3 text-[12px] leading-[1.5] text-on-surface-variant"
            style={{ fontFamily: '"Mulish", -apple-system, system-ui, sans-serif' }}
          >
            Pairs a clinical gynaecologist with a nutritionist for the next 12 weeks. Weekly
            check-ins with ANU.
          </p>
        </article>
      </section>

      <section className="px-3 pt-[18px]">
        <Eyebrow>Other paths available</Eyebrow>
        <div className="grid grid-cols-2 gap-2">
          {paths.map((p) => {
            const isActive = activePath === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setActivePath(p.id)}
                className="rounded-[20px] border p-3.5 text-left transition-colors"
                style={{
                  backgroundColor: isActive ? '#FFFFFF' : '#FBF6F0',
                  borderColor: isActive ? '#5E3566' : 'rgba(94, 53, 102, 0.2)',
                }}
              >
                <div
                  className="mb-1.5 text-[22px]"
                  style={{
                    color: isActive ? '#5E3566' : '#3E2542',
                    fontFamily: '"Fraunces", sans-serif',
                  }}
                >
                  {p.glyph}
                </div>
                <div
                  className="text-[13px] font-medium text-on-surface"
                  style={{ fontFamily: '"Mulish", -apple-system, system-ui, sans-serif' }}
                >
                  {p.label}
                </div>
                <div
                  className="mt-1 text-[9.5px] uppercase tracking-[0.1em]"
                  style={{
                    color: isActive ? '#5E3566' : '#B49FB0',
                    fontFamily: '"Mulish", sans-serif',
                  }}
                >
                  {p.tag}
                </div>
              </button>
            );
          })}
        </div>
      </section>

      <section className="px-3 py-[22px]">
        <article className="rounded-[20px] border border-border-default bg-surface-raised p-4">
          <Eyebrow>Your journey</Eyebrow>
          <div className="relative pl-1">
          {timeline.map((t, i) => {
            const isLast = i === timeline.length - 1;
            const dotBg =
              t.status === 'done' ? '#5E3566' : t.status === 'active' ? '#5E3566' : 'transparent';
            const dotBorder = t.status === 'upcoming' ? '#B49FB0' : dotBg;

            return (
              <div key={t.stage} className="relative flex gap-3.5 pb-3.5">
                {!isLast && (
                  <div
                    className="absolute bottom-0 left-[9px] top-[19px] w-px"
                    style={{
                      background: t.status === 'done' ? '#5E3566' : 'rgba(94, 53, 102, 0.2)',
                    }}
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
                      <path
                        d="M5 12l5 5L20 7"
                        stroke="#3E2542"
                        strokeWidth="3"
                        strokeLinecap="round"
                      />
                    </svg>
                  )}
                  {t.status === 'active' && (
                    <span className="h-1.5 w-1.5 rounded-full bg-inverse-on-surface" />
                  )}
                </div>
                <div className="flex-1 pt-px">
                  <p
                    className="text-[13px] text-on-surface"
                    style={{
                      fontFamily: '"Mulish", -apple-system, system-ui, sans-serif',
                      fontWeight: t.status === 'active' ? 500 : 400,
                      color: t.status === 'upcoming' ? '#B49FB0' : '#3E2542',
                    }}
                  >
                    {t.stage}
                  </p>
                  {t.status === 'active' && (
                    <p
                      className="mt-0.5 text-[9.5px] uppercase tracking-[0.1em] text-secondary"
                      style={{ fontFamily: '"Mulish", sans-serif' }}
                    >
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
            className="mt-2.5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-secondary px-2 py-[14px] text-[14px] font-semibold text-on-secondary"
            style={{
              fontFamily: '"Mulish", -apple-system, system-ui, sans-serif',
              letterSpacing: '-0.005em',
            }}
          >
            Book My Free Consultation
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M5 12h14M13 6l6 6-6 6"
                stroke="#3E2542"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </article>
      </section>

      <BottomNav />
    </main>
  );
}
