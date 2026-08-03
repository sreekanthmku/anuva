import { useNavigate } from 'react-router-dom';
import type { LibraryArticleSummary } from '@anuva/shared';
import { BottomNav } from './components/BottomNav';
import { useLibraryFeed } from './library/useLibrary';
import { FRAUNCES, MULISH, TONE_COLOR } from './library/tone';

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

function FeatureCard({
  article,
  onOpen,
}: {
  article: LibraryArticleSummary;
  onOpen: () => void;
}) {
  return (
    <article
      role="link"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpen();
        }
      }}
      className="cursor-pointer rounded-[20px] border border-border-default bg-primary-container p-[18px] text-left"
    >
      <div
        className="relative flex h-[130px] items-end overflow-hidden rounded-[20px] border border-border-default"
        style={{ background: TONE_COLOR[article.tone] }}
      >
        <span
          className="absolute bottom-2.5 left-3 right-3 text-[9.5px] uppercase tracking-[0.12em] text-on-surface/80"
          style={{ fontFamily: '"Mulish", sans-serif' }}
        >
          {article.categoryLabel}
        </span>
      </div>
      <div className="mt-3.5">
        <Eyebrow mint>{`This week's feature · ${article.readMinutes} min`}</Eyebrow>
        <h2 className="font-display mb-2 text-[22px] leading-[1.2] text-on-surface">
          {article.title}
        </h2>
        <p
          className="mb-3.5 text-[12px] leading-[1.5] text-on-surface-variant"
          style={{ fontFamily: MULISH }}
        >
          {article.dek}
        </p>
        <div className="flex items-center justify-between border-t border-border-default pt-3">
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 rounded-full border border-border-default bg-surface-container-high" />
            <span className="text-[11px] text-on-surface" style={{ fontFamily: MULISH }}>
              {article.author.name}
            </span>
          </div>
          <span className="text-[12px] font-medium text-primary" style={{ fontFamily: MULISH }}>
            Read →
          </span>
        </div>
      </div>
    </article>
  );
}

function ArticleRow({ article, onOpen }: { article: LibraryArticleSummary; onOpen: () => void }) {
  const color = TONE_COLOR[article.tone];

  return (
    <article
      role="link"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpen();
        }
      }}
      className="flex cursor-pointer items-center gap-3 rounded-[20px] border border-border-default bg-surface-raised p-3"
    >
      <div
        className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[20px] border border-border-default bg-surface-container-low"
        style={{ fontFamily: FRAUNCES, fontSize: 22, color }}
      >
        {article.glyph}
      </div>
      <div className="min-w-0 flex-1">
        <div
          className="mb-1 text-[9.5px] uppercase tracking-[0.15em]"
          style={{ fontFamily: '"Mulish", sans-serif', color }}
        >
          {article.categoryLabel}
        </div>
        <h3
          className="mb-0.5 text-[15px] font-medium leading-tight text-on-surface"
          style={{ fontFamily: FRAUNCES }}
        >
          {article.title}
        </h3>
        <div className="text-[11px] text-outline" style={{ fontFamily: MULISH }}>
          {article.readMinutes} min read
        </div>
      </div>
    </article>
  );
}

export default function LibraryRoute() {
  const navigate = useNavigate();
  const { state, error, feed, category, search, setCategory, setSearch, reload } =
    useLibraryFeed();

  const open = (slug: string) => navigate(`/library/${slug}`);
  const filtering = Boolean(category || search.trim());

  return (
    <main className="h-[100dvh] min-h-mobile overflow-x-hidden overflow-y-auto bg-surface pb-28 text-on-surface">
      <header className="sticky top-0 z-30 shrink-0 bg-surface px-3 pb-[18px] pt-[max(0.875rem,env(safe-area-inset-top))]">
        <Eyebrow mint>Library</Eyebrow>
        <h1 className="font-display text-[32px] leading-[1.05] text-on-surface">
          Know your{' '}
          <em className="not-italic font-light text-primary" style={{ fontFamily: FRAUNCES }}>
            body
          </em>
          .
        </h1>
        <p className="mt-2 text-[12px] text-on-surface-variant" style={{ fontFamily: MULISH }}>
          Expert-written. Translated for real life. Always free.
        </p>
      </header>

      <section className="px-3 pb-3">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search articles"
          aria-label="Search articles"
          className="h-11 w-full rounded-full border border-border-default bg-surface-raised px-4 text-[13px] text-on-surface outline-none placeholder:text-outline focus:border-primary/50"
          style={{ fontFamily: MULISH }}
        />
      </section>

      {feed && feed.categories.length > 0 && (
        <section className="pb-1">
          <div className="flex gap-2 overflow-x-auto px-3 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <button
              type="button"
              onClick={() => setCategory(null)}
              className={`h-9 shrink-0 rounded-full border px-4 text-[12px] ${
                category === null
                  ? 'border-primary bg-primary text-on-primary'
                  : 'border-border-default bg-surface-raised text-on-surface-variant'
              }`}
              style={{ fontFamily: MULISH }}
            >
              All
            </button>
            {feed.categories.map((facet) => {
              const active = category === facet.key;
              return (
                <button
                  key={facet.key}
                  type="button"
                  onClick={() => setCategory(active ? null : facet.key)}
                  className={`h-9 shrink-0 rounded-full border px-4 text-[12px] ${
                    active
                      ? 'border-primary bg-primary text-on-primary'
                      : 'border-border-default bg-surface-raised text-on-surface-variant'
                  }`}
                  style={{ fontFamily: MULISH }}
                >
                  {facet.label} · {facet.count}
                </button>
              );
            })}
          </div>
        </section>
      )}

      {state === 'loading' && (
        <section className="flex flex-col gap-2.5 px-3 py-4">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-20 animate-pulse rounded-[20px] border border-border-default bg-surface-container-low"
            />
          ))}
        </section>
      )}

      {state === 'error' && (
        <section className="px-3 py-6 text-center">
          <p className="text-[13px] text-on-surface-variant" style={{ fontFamily: MULISH }}>
            {error}
          </p>
          <button
            type="button"
            onClick={reload}
            className="mt-3 h-11 rounded-full bg-primary px-6 text-[13px] text-on-primary"
            style={{ fontFamily: MULISH }}
          >
            Try again
          </button>
        </section>
      )}

      {state === 'ready' && feed && (
        <>
          {feed.feature && (
            <section className="px-3">
              <FeatureCard article={feed.feature} onOpen={() => open(feed.feature!.slug)} />
            </section>
          )}

          {feed.session && !filtering && (
            <section className="px-3 pt-3.5">
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
                    {feed.session.live ? '● ' : ''}
                    {feed.session.kicker}
                  </div>
                  <div
                    className="text-base font-medium leading-tight text-on-surface"
                    style={{ fontFamily: FRAUNCES }}
                  >
                    {feed.session.title}
                  </div>
                  <div
                    className="mt-0.5 text-[11px] text-on-surface-variant"
                    style={{ fontFamily: MULISH }}
                  >
                    {feed.session.dateLabel}
                  </div>
                </div>
              </div>
            </section>
          )}

          <section className="px-3 py-[22px]">
            <Eyebrow>{filtering ? `${feed.articles.length} articles` : 'Recent'}</Eyebrow>
            {feed.articles.length === 0 ? (
              <p
                className="rounded-[20px] border border-border-default bg-surface-raised p-4 text-[12.5px] text-on-surface-variant"
                style={{ fontFamily: MULISH }}
              >
                Nothing here yet. Try another category or search term.
              </p>
            ) : (
              <div className="flex flex-col gap-2.5">
                {feed.articles.map((article) => (
                  <ArticleRow
                    key={article.slug}
                    article={article}
                    onOpen={() => open(article.slug)}
                  />
                ))}
              </div>
            )}
          </section>
        </>
      )}

      <BottomNav />
    </main>
  );
}
