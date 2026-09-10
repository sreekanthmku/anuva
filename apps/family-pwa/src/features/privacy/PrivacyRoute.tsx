import { fetchPrivacy } from '../../shared/lib/familyApi';
import { useFamilyResource } from '../../shared/lib/useFamilyResource';
import { Card, ErrorCard, Eyebrow, PageIntro, SkeletonCard } from '../shell/ui';

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

      <Card tone="warm" className="px-5 py-5">
        <Eyebrow>{data.sharedLabel}</Eyebrow>
        <ul className="mt-1 space-y-2">
          {data.shared.map((item) => (
            <li key={item} className="flex gap-2.5 text-[14px] leading-[1.6] text-on-surface">
              <span
                aria-hidden
                className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-success/15 text-[11px] font-bold text-success"
              >
                ✓
              </span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </Card>

      <Card tone="quiet" className="px-5 py-5">
        <Eyebrow>{data.privateLabel}</Eyebrow>
        <ul className="mt-1 space-y-2">
          {data.privateItems.map((item) => (
            <li key={item} className="flex gap-2.5 text-[14px] leading-[1.6] text-on-surface-variant">
              <span
                aria-hidden
                className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-outline-variant"
              />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
