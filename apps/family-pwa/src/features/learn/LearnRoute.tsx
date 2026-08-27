import { fetchLearn } from '../../shared/lib/familyApi';
import { useFamilyResource } from '../../shared/lib/useFamilyResource';
import { Card, ErrorCard, PageIntro, SectionLabel, SkeletonCard } from '../shell/ui';

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

      <section>
        <SectionLabel>{data.topicsLabel}</SectionLabel>
        <ul className="space-y-2">
          {data.topics.map((topic) => (
            <li
              key={topic}
              className="rounded-[16px] border border-border-default bg-surface-raised px-4 py-3.5 text-[14px] text-on-surface"
            >
              {topic}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
