import { fetchPrivacy } from '../../shared/lib/familyApi';
import { useFamilyResource } from '../../shared/lib/useFamilyResource';
import { Card, ErrorCard, PageIntro, SectionLabel, SkeletonCard } from '../shell/ui';

export function PrivacyRoute() {
  const { data, error, loading, reload } = useFamilyResource(fetchPrivacy);

  if (loading && !data) {
    return (
      <div className="space-y-4">
        <SkeletonCard lines={3} />
        <SkeletonCard lines={3} />
      </div>
    );
  }

  if (!data) {
    return <ErrorCard message={error ?? 'Could not load what is shared.'} onRetry={() => void reload()} />;
  }

  return (
    <div className="space-y-4">
      <PageIntro eyebrow={data.eyebrow} title={data.title} subline={data.subline} />

      <Card className="px-5 py-5">
        <SectionLabel>{data.sharedLabel}</SectionLabel>
        <ul className="mt-1 space-y-2">
          {data.shared.map((item) => (
            <li key={item} className="flex gap-2 text-[14px] leading-[1.55] text-on-surface">
              <span aria-hidden className="text-success">
                ✓
              </span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </Card>

      <Card className="px-5 py-5">
        <SectionLabel>{data.privateLabel}</SectionLabel>
        <ul className="mt-1 space-y-2">
          {data.privateItems.map((item) => (
            <li key={item} className="flex gap-2 text-[14px] leading-[1.55] text-on-surface-variant">
              <span aria-hidden className="text-outline">
                ·
              </span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
