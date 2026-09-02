import type { FamilyArticleSummary } from '@anuva/shared';
import { Link } from 'react-router-dom';

/**
 * A row in the article list.
 *
 * The audience label is only rendered when it narrows the audience — every article is tagged
 * "Partners and teens" and repeating that on fifteen cards is noise. "Teens only" and "Adult
 * partners only" are worth saying, because they tell the reader why the list they see is not the
 * same as the one someone else in the house sees.
 */
export function ArticleCard({ article }: { article: FamilyArticleSummary }) {
  const restricted = article.audience !== 'everyone';

  return (
    <li>
      <Link
        to={`/learn/${article.slug}`}
        className="flex min-h-[44px] items-start gap-3 rounded-[18px] border border-border-default bg-surface-raised px-4 py-4 transition-colors active:bg-surface-container"
      >
        <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary-fixed text-[12px] font-semibold tabular-nums text-primary">
          {String(article.number).padStart(2, '0')}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-display text-[16px] leading-snug text-on-surface">
            {article.title}
          </span>
          <span className="mt-1 block text-[13px] leading-[1.5] text-on-surface-variant">
            {article.teaser}
          </span>
          <span className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-outline">
            <span>{article.readingMinutes} min read</span>
            {restricted ? (
              <>
                <span aria-hidden>·</span>
                <span className="rounded-full bg-surface-container px-2 py-0.5 text-tertiary">
                  {article.audienceLabel}
                </span>
              </>
            ) : null}
          </span>
        </span>
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="mt-3 shrink-0 text-outline"
          aria-hidden
        >
          <path d="m9 6 6 6-6 6" />
        </svg>
      </Link>
    </li>
  );
}
