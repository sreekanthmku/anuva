import { BottomNav } from './components/BottomNav';

const articles = [
  { cat: 'Nutrition', title: 'Phytoestrogens: the Indian kitchen edition', time: '6 min', glyph: '◇', tone: 'mint' as const },
  { cat: 'Movement', title: 'Why strength training matters after 40', time: '8 min', glyph: '◯', tone: 'butter' as const },
  { cat: 'Mind', title: 'The rage is real — and it has a name', time: '5 min', glyph: '◆', tone: 'blush' as const },
  { cat: 'Clinical', title: 'HRT in India: myths vs. medicine', time: '11 min', glyph: '✦', tone: 'lilac' as const },
];

const toneColor: Record<(typeof articles)[number]['tone'], string> = {
  mint: '#cebdff',
  butter: '#e2c62d',
  blush: '#dbc839',
  lilac: '#60A5FA',
};

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

export default function LibraryRoute() {
  return (
    <main className="h-[100dvh] min-h-mobile overflow-x-hidden overflow-y-auto bg-surface pb-28 text-on-surface">
      <header className="sticky top-0 z-30 shrink-0 bg-surface px-[22px] pb-[18px] pt-[max(0.875rem,env(safe-area-inset-top))] shadow-[0_1px_0_0_rgba(167,139,250,0.2)]">
        <Eyebrow mint>Library</Eyebrow>
        <h1
          className="text-[32px] leading-[1.05] text-on-surface"
          style={{ fontFamily: '"Fraunces Variable", "Fraunces", Georgia, serif', fontWeight: 400, fontVariationSettings: '"opsz" 144' }}
        >
          Know your{' '}
          <em className="not-italic font-light text-primary" style={{ fontFamily: '"Fraunces Variable", "Fraunces", Georgia, serif', fontStyle: 'italic' }}>
            body
          </em>
          .
        </h1>
        <p className="mt-2 text-[12px] text-on-surface-variant" style={{ fontFamily: '"Geist", -apple-system, system-ui, sans-serif' }}>
          Expert-written. Translated for real life. Always free.
        </p>
      </header>

      <section className="px-[22px]">
        <article
          className="rounded-[24px] border border-border-default bg-gradient-to-br from-surface-raised to-deep-space p-[18px]"
          style={{ boxShadow: '0 12px 32px rgba(0,0,0,0.35)' }}
        >
          <div
            className="relative flex h-[130px] items-end overflow-hidden rounded-starchart-lg border border-border-default"
            style={{
              background:
                'linear-gradient(145deg, rgba(206,189,255,0.25) 0%, rgba(226,198,45,0.35) 45%, rgba(30,27,75,0.9) 100%), radial-gradient(ellipse 80% 60% at 30% 40%, rgba(219,200,57,0.5), transparent)',
            }}
          >
            <span
              className="absolute bottom-2.5 left-3 right-3 text-[9.5px] uppercase tracking-[0.12em] text-on-surface/80"
              style={{ fontFamily: '"Geist Mono", ui-monospace, monospace' }}
            >
              editorial · hands holding turmeric
            </span>
          </div>
          <div className="mt-3.5">
            <Eyebrow mint>This week&apos;s feature · 9 min</Eyebrow>
            <h2
              className="mb-2 text-[22px] leading-[1.2] text-on-surface"
              style={{ fontFamily: '"Fraunces Variable", "Fraunces", Georgia, serif', fontWeight: 400, fontVariationSettings: '"opsz" 144' }}
            >
              The{' '}
              <em className="not-italic text-primary" style={{ fontFamily: '"Fraunces Variable", "Fraunces", Georgia, serif', fontStyle: 'italic' }}>
                forty-something
              </em>{' '}
              edit: what your body actually needs.
            </h2>
            <p
              className="mb-3.5 text-[12px] leading-[1.5] text-on-surface-variant"
              style={{ fontFamily: '"Geist", -apple-system, system-ui, sans-serif' }}
            >
              A quiet revolution in perimenopausal care is rewriting what Indian women eat, sleep, and expect.
            </p>
            <div className="flex items-center justify-between border-t border-border-default pt-3">
              <div className="flex items-center gap-2">
                <div className="h-6 w-6 rounded-full border border-[rgba(148,142,157,0.35)] bg-surface-container-high" />
                <span className="text-[11px] text-on-surface" style={{ fontFamily: '"Geist", -apple-system, system-ui, sans-serif' }}>
                  Dr. Meera Rao
                </span>
              </div>
              <span className="text-[12px] font-medium text-primary" style={{ fontFamily: '"Geist", -apple-system, system-ui, sans-serif' }}>
                Read →
              </span>
            </div>
          </div>
        </article>
      </section>

      <section className="px-[22px] pt-3.5">
        <div
          className="flex items-center gap-3.5 rounded-starchart-lg border p-4"
          style={{
            backgroundColor: 'rgba(96, 165, 250, 0.16)',
            borderColor: 'rgba(96, 165, 250, 0.3)',
          }}
        >
          <div
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-starchart-lg"
            style={{ backgroundColor: '#60A5FA' }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="#322f37" aria-hidden="true">
              <polygon points="8,5 20,12 8,19" />
            </svg>
          </div>
          <div className="min-w-0 flex-1">
            <div
              className="mb-1 text-[9.5px] uppercase tracking-[0.15em]"
              style={{ fontFamily: '"Geist Mono", ui-monospace, monospace', color: '#60A5FA' }}
            >
              ● Live · May Masterclass
            </div>
            <div
              className="text-base font-medium leading-tight text-on-surface"
              style={{ fontFamily: '"Fraunces Variable", "Fraunces", Georgia, serif' }}
            >
              Sleep as medicine
            </div>
            <div className="mt-0.5 text-[11px] text-on-surface-variant" style={{ fontFamily: '"Geist", -apple-system, system-ui, sans-serif' }}>
              May 12 · 7:30 PM · Free
            </div>
          </div>
        </div>
      </section>

      <section className="px-[22px] py-[22px]">
        <Eyebrow>Recent</Eyebrow>
        <div className="flex flex-col gap-2.5">
          {articles.map((a) => {
            const c = toneColor[a.tone];
            return (
              <article
                key={a.title}
                className="flex items-center gap-3 rounded-starchart-lg border border-border-default bg-surface-container-low p-3"
              >
                <div
                  className="flex h-14 w-14 shrink-0 items-center justify-center rounded-starchart-lg border border-border-default bg-surface-container-low"
                  style={{
                    fontFamily: '"Fraunces Variable", "Fraunces", Georgia, serif',
                    fontSize: 22,
                    color: c,
                  }}
                >
                  {a.glyph}
                </div>
                <div className="min-w-0 flex-1">
                  <div
                    className="mb-1 text-[9.5px] uppercase tracking-[0.15em]"
                    style={{ fontFamily: '"Geist Mono", ui-monospace, monospace', color: c }}
                  >
                    {a.cat}
                  </div>
                  <h3
                    className="mb-0.5 text-[15px] font-medium leading-tight text-on-surface"
                    style={{ fontFamily: '"Fraunces Variable", "Fraunces", Georgia, serif' }}
                  >
                    {a.title}
                  </h3>
                  <div className="text-[11px] text-outline" style={{ fontFamily: '"Geist", -apple-system, system-ui, sans-serif' }}>
                    {a.time} read
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <BottomNav />
    </main>
  );
}
