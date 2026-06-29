import { BottomNav } from './components/BottomNav';

const articles = [
  {
    cat: 'Nutrition',
    title: 'Phytoestrogens: the Indian kitchen edition',
    time: '6 min',
    glyph: '◇',
    tone: 'mint' as const,
  },
  {
    cat: 'Movement',
    title: 'Why strength training matters after 40',
    time: '8 min',
    glyph: '◯',
    tone: 'butter' as const,
  },
  {
    cat: 'Mind',
    title: 'The rage is real — and it has a name',
    time: '5 min',
    glyph: '◆',
    tone: 'blush' as const,
  },
  {
    cat: 'Clinical',
    title: 'HRT in India: myths vs. medicine',
    time: '11 min',
    glyph: '✦',
    tone: 'lilac' as const,
  },
];

const toneColor: Record<(typeof articles)[number]['tone'], string> = {
  mint: '#5E3566',
  butter: '#C97E92',
  blush: '#B8923C',
  lilac: '#5B82C4',
};

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

export default function LibraryRoute() {
  return (
    <main className="h-[100dvh] min-h-mobile overflow-x-hidden overflow-y-auto bg-surface pb-28 text-on-surface">
      <header className="sticky top-0 z-30 shrink-0 bg-surface px-2 pb-[18px] pt-[max(0.875rem,env(safe-area-inset-top))]">
        <Eyebrow mint>Library</Eyebrow>
        <h1 className="font-display text-[32px] leading-[1.05] text-on-surface">
          Know your{' '}
          <em
            className="not-italic font-light text-primary"
            style={{ fontFamily: '"Fraunces", sans-serif' }}
          >
            body
          </em>
          .
        </h1>
        <p
          className="mt-2 text-[12px] text-on-surface-variant"
          style={{ fontFamily: '"Mulish", -apple-system, system-ui, sans-serif' }}
        >
          Expert-written. Translated for real life. Always free.
        </p>
      </header>

      <section className="px-2">
        <article
          className="rounded-[20px] border border-border-default bg-secondary-container p-[18px]"
          style={{}}
        >
          <div
            className="relative flex h-[130px] items-end overflow-hidden rounded-[20px] border border-border-default"
            style={{
              background: '#5E3566',
            }}
          >
            <span
              className="absolute bottom-2.5 left-3 right-3 text-[9.5px] uppercase tracking-[0.12em] text-on-surface/80"
              style={{ fontFamily: '"Mulish", sans-serif' }}
            >
              editorial · hands holding turmeric
            </span>
          </div>
          <div className="mt-3.5">
            <Eyebrow mint>This week&apos;s feature · 9 min</Eyebrow>
            <h2 className="font-display mb-2 text-[22px] leading-[1.2] text-on-surface">
              The{' '}
              <em
                className="not-italic text-primary"
                style={{ fontFamily: '"Fraunces", sans-serif' }}
              >
                forty-something
              </em>{' '}
              edit: what your body actually needs.
            </h2>
            <p
              className="mb-3.5 text-[12px] leading-[1.5] text-on-surface-variant"
              style={{ fontFamily: '"Mulish", -apple-system, system-ui, sans-serif' }}
            >
              A quiet revolution in perimenopausal care is rewriting what Indian women eat, sleep,
              and expect.
            </p>
            <div className="flex items-center justify-between border-t border-border-default pt-3">
              <div className="flex items-center gap-2">
                <div className="h-6 w-6 rounded-full border border-[rgba(180, 159, 176,0.35)] bg-surface-container-high" />
                <span
                  className="text-[11px] text-on-surface"
                  style={{ fontFamily: '"Mulish", -apple-system, system-ui, sans-serif' }}
                >
                  Dr. Meera Rao
                </span>
              </div>
              <span
                className="text-[12px] font-medium text-primary"
                style={{ fontFamily: '"Mulish", -apple-system, system-ui, sans-serif' }}
              >
                Read →
              </span>
            </div>
          </div>
        </article>
      </section>

      <section className="px-2 pt-3.5">
        <div
          className="flex items-center gap-3.5 rounded-[20px] border p-4"
          style={{
            backgroundColor: 'rgba(91, 130, 196, 0.16)',
            borderColor: 'rgba(91, 130, 196, 0.3)',
          }}
        >
          <div
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[20px]"
            style={{ backgroundColor: '#5B82C4' }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="#3E2542" aria-hidden="true">
              <polygon points="8,5 20,12 8,19" />
            </svg>
          </div>
          <div className="min-w-0 flex-1">
            <div
              className="mb-1 text-[9.5px] uppercase tracking-[0.15em]"
              style={{ fontFamily: '"Mulish", sans-serif', color: '#5B82C4' }}
            >
              ● Live · May Masterclass
            </div>
            <div
              className="text-base font-medium leading-tight text-on-surface"
              style={{ fontFamily: '"Fraunces", sans-serif' }}
            >
              Sleep as medicine
            </div>
            <div
              className="mt-0.5 text-[11px] text-on-surface-variant"
              style={{ fontFamily: '"Mulish", -apple-system, system-ui, sans-serif' }}
            >
              May 12 · 7:30 PM · Free
            </div>
          </div>
        </div>
      </section>

      <section className="px-2 py-[22px]">
        <Eyebrow>Recent</Eyebrow>
        <div className="flex flex-col gap-2.5">
          {articles.map((a) => {
            const c = toneColor[a.tone];
            return (
              <article
                key={a.title}
                className="flex items-center gap-3 rounded-[20px] border border-border-default bg-surface-container-low p-3"
              >
                <div
                  className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[20px] border border-border-default bg-surface-container-low"
                  style={{
                    fontFamily: '"Fraunces", sans-serif',
                    fontSize: 22,
                    color: c,
                  }}
                >
                  {a.glyph}
                </div>
                <div className="min-w-0 flex-1">
                  <div
                    className="mb-1 text-[9.5px] uppercase tracking-[0.15em]"
                    style={{ fontFamily: '"Mulish", sans-serif', color: c }}
                  >
                    {a.cat}
                  </div>
                  <h3
                    className="mb-0.5 text-[15px] font-medium leading-tight text-on-surface"
                    style={{ fontFamily: '"Fraunces", sans-serif' }}
                  >
                    {a.title}
                  </h3>
                  <div
                    className="text-[11px] text-outline"
                    style={{ fontFamily: '"Mulish", -apple-system, system-ui, sans-serif' }}
                  >
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
