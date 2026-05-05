import { BottomNav } from './components/BottomNav';

const quickLogItems = [
  { label: 'Hot flash', sub: 'Log now', tone: '#F87171', count: '2 TODAY' },
  { label: 'Sleep', sub: 'Rate last night', tone: '#cebdff' },
  { label: 'Mood', sub: 'How are you?', tone: '#dbc839' },
  { label: 'Cycle', sub: 'Day 24', tone: '#e2c62d' },
];

const score = 72;
const circumference = 2 * Math.PI * 42;
const scoreDash = (score / 100) * circumference;

export default function AnuDashboardRoute() {
  return (
    <main className="min-h-mobile overflow-auto bg-surface pb-28 pt-[20px] text-on-surface">
      <section className="px-[22px] pb-[14px]">
        <header className="mb-[18px] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src="/anu.png" alt="Anuva logo" className="h-5 w-5 object-contain" />
            <span
              className="text-[16px] tracking-[0.16em] text-on-surface"
              style={{ fontFamily: '"Fraunces Variable", "Fraunces", Georgia, serif', fontWeight: 500 }}
            >
              ANUVA
            </span>
          </div>
          <span
            className="inline-flex h-[34px] w-[34px] items-center justify-center rounded-full border text-[14px] text-primary"
            style={{
              background: '#1d1a21',
              borderColor: 'rgba(148, 142, 157, 0.35)',
              fontFamily: '"Fraunces Variable", "Fraunces", Georgia, serif',
              fontWeight: 500,
            }}
          >
            P
          </span>
        </header>

        <div className="mb-2 flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-primary">
          <span className="h-px w-3 bg-primary/60" />
          <span style={{ fontFamily: '"Geist Mono", ui-monospace, monospace' }}>Good morning</span>
        </div>

        <h1
          className="mb-2.5 text-[44px] leading-[0.95] text-on-surface"
          style={{ fontFamily: '"Fraunces Variable", "Fraunces", Georgia, serif', fontWeight: 400, fontVariationSettings: '"opsz" 144' }}
        >
          <em className="not-italic text-primary" style={{ fontStyle: 'italic', fontWeight: 300 }}>
            Priya
          </em>
        </h1>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10.5px] uppercase tracking-[0.12em] text-outline" style={{ fontFamily: '"Geist Mono", ui-monospace, monospace' }}>
            Day 8 · Week 2
          </span>
          <span className="text-outline/40">·</span>
          <span
            className="rounded-full border px-[9px] py-[3px] text-[9.5px] uppercase tracking-[0.1em]"
            style={{
              background: 'rgba(219, 200, 57, 0.16)',
              borderColor: 'rgba(219, 200, 57, 0.3)',
              color: '#dbc839',
              fontFamily: '"Geist Mono", ui-monospace, monospace',
            }}
          >
            ● Perimenopause
          </span>
        </div>
      </section>

      <section className="px-[22px]">
        <article className="flex items-center gap-4 rounded-[24px] border border-border-default bg-gradient-to-br from-surface-raised to-deep-space px-5 py-[18px]">
          <div className="relative h-24 w-24 shrink-0">
            <svg width="96" height="96" viewBox="0 0 96 96" aria-hidden="true">
              <circle cx="48" cy="48" r="42" fill="none" stroke="#2b2930" strokeWidth="6" />
              <circle
                cx="48"
                cy="48"
                r="42"
                fill="none"
                stroke="#cebdff"
                strokeWidth="6"
                strokeDasharray={`${scoreDash} ${circumference}`}
                strokeLinecap="round"
                transform="rotate(-90 48 48)"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span
                className="text-[30px] leading-none text-on-surface"
                style={{ fontFamily: '"Fraunces Variable", "Fraunces", Georgia, serif', fontWeight: 500, fontVariationSettings: '"opsz" 96' }}
              >
                {score}
              </span>
              <span className="mt-1 text-[8.5px] uppercase tracking-[0.18em] text-outline" style={{ fontFamily: '"Geist Mono", ui-monospace, monospace' }}>
                balance
              </span>
            </div>
          </div>

          <div className="flex-1">
            <div className="mb-1.5 flex items-center gap-2 text-[9.5px] uppercase tracking-[0.18em] text-primary">
              <span className="h-px w-3 bg-primary/60" />
              <span style={{ fontFamily: '"Geist Mono", ui-monospace, monospace' }}>Today&apos;s wellness</span>
            </div>
            <p
              className="mb-2 text-[18px] leading-[1.25] text-on-surface"
              style={{ fontFamily: '"Fraunces Variable", "Fraunces", Georgia, serif', fontStyle: 'italic' }}
            >
              Steady, with gentle friction.
            </p>
            <div className="flex flex-wrap gap-2.5">
              <span className="inline-flex items-center gap-1.5 text-[11px] text-primary" style={{ fontFamily: '"Geist", -apple-system, system-ui, sans-serif' }}>
                <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                Sleep +12%
              </span>
              <span className="inline-flex items-center gap-1.5 text-[11px] text-error" style={{ fontFamily: '"Geist", -apple-system, system-ui, sans-serif' }}>
                <span className="h-1.5 w-1.5 rounded-full bg-error" />
                Hot flashes ↑
              </span>
            </div>
          </div>
        </article>
      </section>

      <section className="px-[22px] pt-[14px]">
        <article className="rounded-[24px] border border-border-default bg-surface-container-low px-[18px] py-4">
          <div className="flex items-start gap-3.5">
            <img src="/anu.png" alt="ANU avatar" className="mt-0.5 h-[26px] w-[26px] shrink-0 object-contain" />
            <div className="flex-1">
              <div className="mb-2 flex items-center gap-2 text-[9.5px] uppercase tracking-[0.18em] text-primary">
                <span className="h-px w-3 bg-primary/60" />
                <span style={{ fontFamily: '"Geist Mono", ui-monospace, monospace' }}>ANU · just now</span>
              </div>
              <p
                className="text-[16px] leading-[1.4] text-on-surface"
                style={{ fontFamily: '"Fraunces Variable", "Fraunces", Georgia, serif', fontStyle: 'italic' }}
              >
                &quot;You logged two hot flashes yesterday. Want me to suggest a 3-minute cooling ritual for tonight?&quot;
              </p>
              <div className="mt-3 flex gap-1.5">
                <button type="button" className="rounded-full border border-primary/30 bg-primary/15 px-3 py-1.5 text-[12px] text-primary" style={{ fontFamily: '"Geist", -apple-system, system-ui, sans-serif' }}>
                  Yes, show me
                </button>
                <button type="button" className="rounded-full border border-border-default bg-surface px-3 py-1.5 text-[12px] text-on-surface-variant" style={{ fontFamily: '"Geist", -apple-system, system-ui, sans-serif' }}>
                  Later
                </button>
              </div>
            </div>
          </div>
        </article>
      </section>

      <section className="px-[22px] pt-4">
        <div className="mb-2.5 flex items-baseline justify-between">
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-outline">
            <span className="h-px w-3 bg-outline/60" />
            <span style={{ fontFamily: '"Geist Mono", ui-monospace, monospace' }}>Quick log</span>
          </div>
          <span className="text-[10px] uppercase tracking-[0.1em] text-outline" style={{ fontFamily: '"Geist Mono", ui-monospace, monospace' }}>
            Tap to track
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          {quickLogItems.map((item) => (
            <article key={item.label} className="rounded-[20px] border border-border-default bg-surface-container-low p-[14px]">
              <div className="mb-3 flex items-center justify-between">
                <span className="h-[30px] w-[30px] rounded-full" style={{ background: item.tone }} />
                {item.count && (
                  <span className="text-[9.5px] uppercase tracking-[0.08em] text-error" style={{ fontFamily: '"Geist Mono", ui-monospace, monospace' }}>
                    {item.count}
                  </span>
                )}
              </div>
              <p className="text-[13px] font-medium text-on-surface" style={{ fontFamily: '"Geist", -apple-system, system-ui, sans-serif' }}>
                {item.label}
              </p>
              <p className="mt-0.5 text-[11px] text-outline" style={{ fontFamily: '"Geist", -apple-system, system-ui, sans-serif' }}>
                {item.sub}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className="px-[22px] pb-[22px] pt-4">
        <article className="rounded-[24px] border px-[18px] py-4" style={{ background: 'rgba(219, 200, 57, 0.16)', borderColor: 'rgba(219, 200, 57, 0.3)' }}>
          <div className="mb-2.5 flex items-center gap-2 text-[10px] uppercase tracking-[0.18em]" style={{ color: '#dbc839' }}>
            <span className="h-px w-3 bg-[#dbc839]/70" />
            <span style={{ fontFamily: '"Geist Mono", ui-monospace, monospace' }}>Today&apos;s insight</span>
          </div>
          <p className="text-[17px] leading-[1.4] text-on-surface" style={{ fontFamily: '"Fraunces Variable", "Fraunces", Georgia, serif', fontStyle: 'italic' }}>
            Cooling the bedroom to 22°C before sleep can reduce night sweats by up to 40%.
          </p>
          <div className="mt-3 flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-[0.1em] text-on-surface-variant" style={{ fontFamily: '"Geist Mono", ui-monospace, monospace' }}>
              Dr. Meera Rao · AIIMS
            </span>
            <span className="text-[12px] font-medium" style={{ color: '#dbc839', fontFamily: '"Geist", -apple-system, system-ui, sans-serif' }}>
              Read →
            </span>
          </div>
        </article>
      </section>

      <BottomNav />
    </main>
  );
}

