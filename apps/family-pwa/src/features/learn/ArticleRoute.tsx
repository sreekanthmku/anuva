import { useCallback } from 'react';
import { Link, useParams } from 'react-router-dom';
import { fetchFamilyArticle } from '../../shared/lib/familyApi';
import { useFamilyResource } from '../../shared/lib/useFamilyResource';
import { Card, ErrorCard, Eyebrow, SectionLabel, SkeletonCard } from '../shell/ui';
import { ArticleCard } from './ArticleCard';

/**
 * One family article.
 *
 * Everything on this screen is server copy, including the action label, the "Try saying" line and
 * the footer disclaimer — the client picks no wording and knows nothing about who is reading. The
 * server has already chosen the role-specific action, so there is no branch here on partner vs
 * teen; that decision lives in `apps/api/src/family/articles.ts` where the audience rules are.
 */
function ArticleView({ slug }: { slug: string }) {
  // Stable per mount. The route remounts on a slug change (see the `key` below), which is what
  // re-runs the fetch — `useFamilyResource` deliberately loads once.
  const fetcher = useCallback(() => fetchFamilyArticle(slug), [slug]);
  const { data, error, loading, reload } = useFamilyResource(fetcher);

  if (loading && !data) {
    return (
      <div className="space-y-4">
        <SkeletonCard lines={4} />
        <SkeletonCard lines={2} />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="space-y-4">
        <BackLink />
        <ErrorCard
          message={error ?? 'This article is not available.'}
          onRetry={() => void reload()}
        />
      </div>
    );
  }

  const { article, more } = data;

  return (
    <article className="space-y-5">
      <BackLink />

      <header className="animate-[anuvaRise_420ms_cubic-bezier(0.16,1,0.3,1)]">
        <Eyebrow>Topic {String(article.number).padStart(2, '0')}</Eyebrow>
        <h1 className="font-display text-[28px] font-medium leading-[1.14] text-primary">{article.title}</h1>
        <p className="mt-2 text-[15px] leading-[1.5] text-on-surface-variant">{article.teaser}</p>
        <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-outline">
          <span>{article.readingMinutes} min read</span>
          <span aria-hidden>·</span>
          <span>{article.audienceLabel}</span>
        </p>
      </header>

      <div className="space-y-3">
        {article.body.map((paragraph) => (
          <p key={paragraph} className="text-[15px] leading-[1.65] text-on-surface">
            {paragraph}
          </p>
        ))}
      </div>

      {article.action ? (
        <Card tone="quiet" className="px-5 py-5">
          <Eyebrow>{article.action.label}</Eyebrow>
          <p className="text-[14.5px] leading-[1.6] text-on-surface">{article.action.text}</p>
        </Card>
      ) : null}

      {/* The line they can actually say out loud gets the rose ground — it is the one thing on the
          page meant to leave the screen. */}
      <Card tone="accent" className="px-5 py-5">
        <Eyebrow>{article.sayingLabel}</Eyebrow>
        <p className="font-display text-[18px] font-medium italic leading-[1.45] text-primary">
          “{article.saying}”
        </p>
      </Card>

      {more.length > 0 ? (
        <section>
          <SectionLabel>Read next</SectionLabel>
          <ul className="space-y-2">
            {more.map((next) => (
              <ArticleCard key={next.slug} article={next} />
            ))}
          </ul>
        </section>
      ) : null}

      <footer className="space-y-3 border-t border-border-default pt-4">
        <div>
          <SectionLabel>{article.sourcesLabel}</SectionLabel>
          <ul className="space-y-1">
            {article.sources.map((source) => (
              <li key={source} className="text-[12.5px] leading-[1.5] text-on-surface-variant">
                {source}
              </li>
            ))}
          </ul>
        </div>
        <p className="text-[12px] leading-[1.5] text-outline">{article.footer}</p>
      </footer>
    </article>
  );
}

function BackLink() {
  return (
    <Link
      to="/learn"
      className="press inline-flex min-h-[44px] items-center gap-1 rounded-full border border-border-default bg-surface-raised pl-2.5 pr-4 text-[13px] font-semibold text-primary shadow-soft"
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="m15 6-6 6 6 6" />
      </svg>
      Explore topics
    </Link>
  );
}

export function ArticleRoute() {
  const { slug = '' } = useParams<{ slug: string }>();
  // Keyed so navigating between articles re-mounts and re-fetches rather than showing the previous
  // article's body under the new title.
  return <ArticleView key={slug} slug={slug} />;
}
