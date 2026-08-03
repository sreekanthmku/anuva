import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { LibraryBlock } from '@anuva/shared';
import { BottomNav } from './components/BottomNav';
import { useLibraryArticle } from './library/useLibrary';
import { FRAUNCES, MULISH, TONE_COLOR } from './library/tone';

function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });
}

function Block({ block, accent }: { block: LibraryBlock; accent: string }) {
  if (block.type === 'heading') {
    return (
      <h2
        className="mt-6 text-[19px] font-medium leading-tight text-on-surface"
        style={{ fontFamily: FRAUNCES }}
      >
        {block.text}
      </h2>
    );
  }

  if (block.type === 'list') {
    return (
      <ul className="mt-4 flex flex-col gap-2.5">
        {block.items.map((item) => (
          <li key={item} className="flex gap-2.5">
            <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: accent }} />
            <span
              className="text-[13.5px] leading-[1.6] text-on-surface-variant"
              style={{ fontFamily: MULISH }}
            >
              {item}
            </span>
          </li>
        ))}
      </ul>
    );
  }

  if (block.type === 'quote') {
    return (
      <blockquote
        className="mt-6 rounded-r-[12px] py-3 pl-4 pr-3"
        style={{ borderLeft: `2px solid ${accent}`, backgroundColor: 'rgba(94, 53, 102, 0.06)' }}
      >
        <p className="text-[15px] leading-[1.5] text-on-surface" style={{ fontFamily: FRAUNCES }}>
          “{block.text}”
        </p>
        {block.attribution && (
          <footer
            className="mt-2 text-[11px] uppercase tracking-[0.12em] text-outline"
            style={{ fontFamily: '"Mulish", sans-serif' }}
          >
            {block.attribution}
          </footer>
        )}
      </blockquote>
    );
  }

  if (block.type === 'callout') {
    return (
      <aside
        className="mt-6 rounded-[20px] border p-4"
        style={{ borderColor: `${accent}55`, backgroundColor: `${accent}14` }}
      >
        <div
          className="mb-1.5 text-[9.5px] uppercase tracking-[0.15em]"
          style={{ fontFamily: '"Mulish", sans-serif', color: accent }}
        >
          {block.title}
        </div>
        <p
          className="text-[13px] leading-[1.55] text-on-surface"
          style={{ fontFamily: MULISH }}
        >
          {block.text}
        </p>
      </aside>
    );
  }

  return (
    <p
      className="mt-4 text-[13.5px] leading-[1.65] text-on-surface-variant"
      style={{ fontFamily: MULISH }}
    >
      {block.text}
    </p>
  );
}

export default function LibraryArticleRoute() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { state, error, data, reload } = useLibraryArticle(slug);

  // Each article opens at the top, even when navigated to from a related card.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [slug]);

  const accent = data ? TONE_COLOR[data.article.tone] : TONE_COLOR.mint;

  return (
    <main className="h-[100dvh] min-h-mobile overflow-x-hidden overflow-y-auto bg-surface pb-28 text-on-surface">
      <header className="sticky top-0 z-30 bg-surface px-3 pb-3 pt-[max(0.875rem,env(safe-area-inset-top))]">
        <button
          type="button"
          onClick={() => navigate('/library')}
          className="flex h-9 items-center gap-2 text-[12px] text-on-surface-variant"
          style={{ fontFamily: MULISH }}
        >
          <span aria-hidden="true">←</span> Library
        </button>
      </header>

      {state === 'loading' && (
        <section className="flex flex-col gap-3 px-3">
          <div className="h-32 animate-pulse rounded-[20px] bg-surface-container-low" />
          <div className="h-4 w-2/3 animate-pulse rounded-full bg-surface-container-low" />
          <div className="h-4 w-full animate-pulse rounded-full bg-surface-container-low" />
          <div className="h-4 w-5/6 animate-pulse rounded-full bg-surface-container-low" />
        </section>
      )}

      {state === 'error' && (
        <section className="px-3 py-6 text-center">
          <p className="text-[13px] text-on-surface-variant" style={{ fontFamily: MULISH }}>
            {error}
          </p>
          <button
            type="button"
            onClick={() => void reload()}
            className="mt-3 h-11 rounded-full bg-primary px-6 text-[13px] text-on-primary"
            style={{ fontFamily: MULISH }}
          >
            Try again
          </button>
        </section>
      )}

      {state === 'ready' && data && (
        <>
          <article className="px-3">
            <div
              className="relative flex h-[150px] items-end overflow-hidden rounded-[20px] border border-border-default"
              style={{ background: accent }}
            >
              <span
                className="absolute bottom-2.5 left-3 right-3 text-[9.5px] uppercase tracking-[0.12em] text-on-surface/80"
                style={{ fontFamily: '"Mulish", sans-serif' }}
              >
                {data.article.heroCaption}
              </span>
            </div>

            <div
              className="mt-4 text-[9.5px] uppercase tracking-[0.15em]"
              style={{ fontFamily: '"Mulish", sans-serif', color: accent }}
            >
              {data.article.categoryLabel} · {data.article.readMinutes} min read
            </div>

            <h1
              className="mt-2 text-[26px] font-medium leading-[1.15] text-on-surface"
              style={{ fontFamily: FRAUNCES }}
            >
              {data.article.title}
            </h1>

            <p
              className="mt-2.5 text-[13.5px] leading-[1.55] text-on-surface-variant"
              style={{ fontFamily: MULISH }}
            >
              {data.article.dek}
            </p>

            <div className="mt-4 flex items-center gap-2.5 border-y border-border-default py-3">
              <div className="h-8 w-8 rounded-full border border-border-default bg-surface-container-high" />
              <div className="min-w-0">
                <div className="text-[12px] text-on-surface" style={{ fontFamily: MULISH }}>
                  {data.article.author.name}
                </div>
                <div className="text-[10.5px] text-outline" style={{ fontFamily: MULISH }}>
                  {data.article.author.credential} · {formatDate(data.article.publishedAt)}
                </div>
              </div>
            </div>

            {data.article.keyTakeaways.length > 0 && (
              <section className="mt-5 rounded-[20px] border border-border-default bg-surface-raised p-4">
                <div
                  className="mb-2.5 text-[9.5px] uppercase tracking-[0.15em] text-outline"
                  style={{ fontFamily: '"Mulish", sans-serif' }}
                >
                  In short
                </div>
                <ul className="flex flex-col gap-2">
                  {data.article.keyTakeaways.map((takeaway) => (
                    <li key={takeaway} className="flex gap-2.5">
                      <span
                        className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full"
                        style={{ background: accent }}
                      />
                      <span
                        className="text-[12.5px] leading-[1.55] text-on-surface"
                        style={{ fontFamily: MULISH }}
                      >
                        {takeaway}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <div className="pt-1">
              {data.article.blocks.map((block, i) => (
                <Block key={i} block={block} accent={accent} />
              ))}
            </div>

            {data.article.tags.length > 0 && (
              <div className="mt-6 flex flex-wrap gap-2">
                {data.article.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full border border-border-default bg-surface-raised px-3 py-1.5 text-[11px] text-on-surface-variant"
                    style={{ fontFamily: MULISH }}
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}

            <p
              className="mt-6 rounded-[20px] border border-border-default bg-surface-container-low p-3.5 text-[11.5px] leading-[1.5] text-outline"
              style={{ fontFamily: MULISH }}
            >
              Educational content, not a diagnosis. Talk to a clinician about your own symptoms —
              you can book a consultation from the More menu.
            </p>
          </article>

          {data.related.length > 0 && (
            <section className="px-3 pt-7">
              <div
                className="mb-2 flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-outline"
                style={{ fontFamily: '"Mulish", sans-serif' }}
              >
                <span className="h-px w-3 bg-outline/60" />
                Read next
              </div>
              <div className="flex flex-col gap-2.5">
                {data.related.map((related) => (
                  <button
                    key={related.slug}
                    type="button"
                    onClick={() => navigate(`/library/${related.slug}`)}
                    className="flex items-center gap-3 rounded-[20px] border border-border-default bg-surface-raised p-3 text-left"
                  >
                    <div
                      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[20px] border border-border-default bg-surface-container-low"
                      style={{
                        fontFamily: FRAUNCES,
                        fontSize: 20,
                        color: TONE_COLOR[related.tone],
                      }}
                    >
                      {related.glyph}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div
                        className="mb-0.5 text-[9.5px] uppercase tracking-[0.15em]"
                        style={{
                          fontFamily: '"Mulish", sans-serif',
                          color: TONE_COLOR[related.tone],
                        }}
                      >
                        {related.categoryLabel}
                      </div>
                      <div
                        className="text-[14px] font-medium leading-tight text-on-surface"
                        style={{ fontFamily: FRAUNCES }}
                      >
                        {related.title}
                      </div>
                      <div className="text-[11px] text-outline" style={{ fontFamily: MULISH }}>
                        {related.readMinutes} min read
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </section>
          )}
        </>
      )}

      <BottomNav />
    </main>
  );
}
