import type { FamilyActivityResponse } from '@anuva/shared';

/**
 * Her side of the support loop: that someone showed up.
 *
 * Renders nothing at all until her family has actually done something. A card reading "nobody has
 * checked in on you" would be worse than no card — this feature exists to make her feel supported,
 * not audited, and the absence of support is not news she needs delivered on her dashboard.
 */
export function FamilyCheckInCard({ activity }: { activity: FamilyActivityResponse | null }) {
  if (!activity?.member || !activity.today) {
    return null;
  }

  const mulish = { fontFamily: '"Mulish", -apple-system, system-ui, sans-serif' };

  return (
    <section className="px-3 pt-3">
      <article className="rounded-[20px] border border-secondary/30 bg-secondary-fixed/50 px-[18px] py-4">
        <div className="flex items-start gap-3">
          <span
            aria-hidden
            className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-secondary/20 text-[15px] text-secondary"
          >
            ♥
          </span>
          <div className="min-w-0">
            <h2
              className="text-[16px] leading-snug text-on-surface"
              style={{ fontFamily: '"Fraunces", serif', fontWeight: 500 }}
            >
              {activity.today.headline}
            </h2>
            <p
              className="mt-1 text-[13px] leading-[1.55] text-on-surface-variant"
              style={mulish}
            >
              {activity.today.body}
            </p>
            {activity.weekLine ? (
              <p className="mt-1.5 text-[11.5px] text-outline" style={mulish}>
                {activity.weekLine}
              </p>
            ) : null}
          </div>
        </div>
      </article>
    </section>
  );
}
