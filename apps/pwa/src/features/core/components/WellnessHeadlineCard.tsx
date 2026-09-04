import type { SummaryHeadline, SummaryPeriod } from '@anuva/shared';
import { Eyebrow } from '../../../shared/components/Eyebrow';
import { RING_EMPTY_COLOR } from '../ringColors';
import { wellnessColor } from '../wellnessDisplay';

const MULISH = '"Mulish", -apple-system, system-ui, sans-serif';
const FRAUNCES = '"Fraunces", sans-serif';

const EYEBROW: Record<SummaryPeriod, string> = {
  daily: "How you're doing today",
  weekly: 'How your week went',
  monthly: 'How your month went',
};

/**
 * The window in one line, opening the page.
 *
 * The score is shown *and* named. A day's wellness has existed since the
 * calendar dots did, but it used to appear only as a bare number over a zoomed
 * sparkline at the bottom of the page — where a 58 says nothing, because the
 * reader has no reason to know which way the scale runs or what a normal one
 * looks like. Here it travels with its band word and the sentence that explains
 * which metrics produced it.
 */
export function WellnessHeadlineCard({
  headline,
  period,
}: {
  headline: SummaryHeadline;
  period: SummaryPeriod;
}) {
  const color = wellnessColor(headline.score);

  return (
    <article className="rounded-[20px] border border-border-default bg-surface-raised px-4 py-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <Eyebrow className="mb-1.5">{EYEBROW[period]}</Eyebrow>
          <h2 className="text-[24px] leading-[1.15] text-on-surface" style={{ fontFamily: FRAUNCES }}>
            {headline.headline}
          </h2>
          <p
            className="mt-2 text-[13.5px] leading-[1.45] text-on-surface-variant"
            style={{ fontFamily: MULISH }}
          >
            {headline.body}
          </p>
        </div>

        {/* The composite, with the word that gives it a direction. Aria carries
            the scale, which the two stacked lines cannot say out loud. */}
        <div
          className="flex h-[64px] w-[64px] shrink-0 flex-col items-center justify-center rounded-full"
          style={{ backgroundColor: `${color}1F` }}
          role="img"
          aria-label={
            headline.score == null
              ? 'No wellness score for this window yet'
              : `Wellness ${headline.score} out of 100 — ${headline.band}`
          }
        >
          <span
            className="text-[22px] leading-none"
            style={{ fontFamily: FRAUNCES, color: headline.score == null ? RING_EMPTY_COLOR : color }}
          >
            {headline.score ?? '—'}
          </span>
          <span
            className="mt-1 text-[8px] uppercase tracking-[0.14em] text-outline"
            style={{ fontFamily: MULISH }}
          >
            of 100
          </span>
        </div>
      </div>
    </article>
  );
}
