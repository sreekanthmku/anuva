import { fetchLearn } from '../../shared/lib/familyApi';
import { useFamilyResource } from '../../shared/lib/useFamilyResource';
import { Card, ErrorCard, PageIntro, SectionLabel, SkeletonCard } from '../shell/ui';
import { ArticleCard } from './ArticleCard';

/**
 * The Learn tab: this week's two rotating cards, then the family article index.
 *
 * The list is whatever the server sent. It is already filtered to this member's relationship — a
 * teen's list and a partner's list are genuinely different — so the client neither filters nor
 * sorts. These are the family app's own articles; her library in `apps/pwa` is a separate corpus
 * behind a separate endpoint and nothing here reaches into it.
 */
export function LearnRoute() {
  const { data, error, loading, reload } = useFamilyResource(fetchLearn);

  if (loading && !data) {
    return (
      <div className="space-y-4">
        <SkeletonCard lines={2} />
        <SkeletonCard lines={2} />
      </div>
    );
  }

  if (!data) {
    return <ErrorCard message={error ?? 'Could not load this week’s reading.'} onRetry={() => void reload()} />;
  }

  return (
    <div className="space-y-4">
      <PageIntro eyebrow={data.eyebrow} title={data.title} subline={data.subline} />

      {[data.nudge, data.tip].map((card) => (
        <Card key={card.label} className="px-5 py-5">
          <SectionLabel>{card.label}</SectionLabel>
          <h2 className="font-display text-[19px] leading-snug text-on-surface">{card.headline}</h2>
          <p className="mt-2 text-[14px] leading-[1.55] text-on-surface-variant">{card.body}</p>
        </Card>
      ))}

      <section className="pt-1">
        <SectionLabel>{data.articlesLabel}</SectionLabel>
        <div className="space-y-6">
          {data.sections.map((section) => (
            <div key={section.label}>
              <h2 className="mb-2 font-display text-[15px] text-on-surface-variant">
                {section.label}
              </h2>
              <ul className="space-y-2">
                {section.articles.map((article) => (
                  <ArticleCard key={article.slug} article={article} />
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
