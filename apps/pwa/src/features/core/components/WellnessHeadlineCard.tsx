import type { SummaryHeadline, SummaryPeriod } from '@anuva/shared';
import { RING_EMPTY_COLOR } from '../ringColors';
import { wellnessColor } from '../wellnessDisplay';
import { WellnessScene } from './WellnessScene';

const MULISH = '"Mulish", -apple-system, system-ui, sans-serif';
const FRAUNCES = '"Fraunces", sans-serif';

const EYEBROW: Record<SummaryPeriod, string> = {
  daily: "How you're doing today",
  weekly: 'How your week went',
  monthly: 'How your month went',
};

/**
 * The card's own wash, one per band.
 *
 * Warm and light at the top of the ladder, cooler and plummier at the bottom,
 * so the card reads before a word of it is. It is a *wash*, not a status
 * colour: the strongest tint here is still soft enough that plum body text
 * clears AA on it, which is why none of these go anywhere near the saturated
 * red and green of the gauge bands.
 */
const CARD_WASH: Record<string, string> = {
  Great: 'linear-gradient(103deg, #FFFFFF 0%, #FDF1E6 46%, #FBE3DC 100%)',
  Good: 'linear-gradient(103deg, #FFFFFF 0%, #FCF0E8 46%, #F8E1DC 100%)',
  Okay: 'linear-gradient(103deg, #FFFFFF 0%, #FBEFEA 46%, #F4DDE0 100%)',
  Hard: 'linear-gradient(103deg, #FFFFFF 0%, #F9EDEA 46%, #EDDCE3 100%)',
  'Very hard': 'linear-gradient(103deg, #FFFFFF 0%, #F6EFF2 46%, #E5DAEA 100%)',
};

const EMPTY_WASH = 'linear-gradient(103deg, #FFFFFF 0%, #F9F5F1 50%, #F2EBE6 100%)';

/**
 * The window in one line, opening the page.
 *
 * The score is shown *and* named. A day's wellness has existed since the
 * calendar dots did, but it used to appear only as a bare number over a zoomed
 * sparkline at the bottom of the page — where a 58 says nothing, because the
 * reader has no reason to know which way the scale runs or what a normal one
 * looks like. Here it travels with its band word, the sentence naming which
 * metrics produced it, and a scene that carries the same reading at a glance.
 */
export function WellnessHeadlineCard({
  headline,
  period,
}: {
  headline: SummaryHeadline;
  period: SummaryPeriod;
}) {
  const color = wellnessColor(headline.score);
  const hasScore = headline.score != null;

  return (
    <article
      className="relative overflow-hidden rounded-[20px] border border-border-default"
      style={{ background: (headline.band && CARD_WASH[headline.band]) || EMPTY_WASH }}
    >
      {/* Bleeds to the card's edges and feathers out on its left. Reaches
          under the text — the leftmost portion of the scene is nearly
          transparent, so it tints rather than covers, and the ramp has room
          to fade in without a visible seam. */}
      <div
        className="pointer-events-none absolute inset-y-0 right-0 w-[64%] max-w-[240px]"
        aria-hidden="true"
      >
        <WellnessScene band={headline.band} />
      </div>

      <div className="relative px-4 py-4">
        <p
          className="text-[10.5px] font-semibold uppercase leading-none tracking-[0.12em] text-on-surface-variant"
          style={{ fontFamily: MULISH }}
        >
          {EYEBROW[period]}
        </p>

        <h2
          className="mt-2 max-w-[60%] text-[25px] leading-[1.1] text-on-surface"
          style={{ fontFamily: FRAUNCES }}
        >
          {headline.headline}
        </h2>

        {/* Held clear of the illustration. The scene is decoration; the sentence
            is the content, and it never wraps around a hill. */}
        <p
          className="mt-2 max-w-[58%] text-[12.5px] leading-[1.45] text-on-surface-variant"
          style={{ fontFamily: MULISH }}
        >
          {headline.body}
        </p>

        <div
          className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-surface-bright/80 px-2.5 py-1"
          role="img"
          aria-label={
            hasScore
              ? `Wellness ${headline.score} out of 100 — ${headline.band}`
              : 'No wellness score for this window yet'
          }
        >
          <span
            aria-hidden="true"
            className="h-1.5 w-1.5 rounded-full"
            style={{ backgroundColor: hasScore ? color : RING_EMPTY_COLOR }}
          />
          <span
            className="text-[11px] font-semibold leading-none text-on-surface"
            style={{ fontFamily: MULISH }}
          >
            {hasScore ? `${headline.score}/100` : '—'}
          </span>
          {headline.band && (
            <span className="text-[11px] leading-none text-on-surface-variant" style={{ fontFamily: MULISH }}>
              · {headline.band}
            </span>
          )}
        </div>
      </div>
    </article>
  );
}
