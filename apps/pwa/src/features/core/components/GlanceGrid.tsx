import type { ReportRingKey, SummaryGlanceTile, SummaryGlanceTone } from '@anuva/shared';
import { GLANCE_EMOJI, RING_EMOJI } from '../summaryEmoji';

const MULISH = '"Mulish", -apple-system, system-ui, sans-serif';
const FRAUNCES = '"Fraunces", sans-serif';

/** Tint and eyebrow colour per tone, all off the Anuva token palette. */
const TONE_STYLE: Record<SummaryGlanceTone, { background: string; accent: string }> = {
  positive: { background: 'rgba(79, 157, 107, 0.12)', accent: '#4F9D6B' },
  attention: { background: '#F8DCE2', accent: '#C0405A' },
  improving: { background: '#E7DCEC', accent: '#5E3566' },
  info: { background: 'rgba(91, 130, 196, 0.12)', accent: '#5B82C4' },
  neutral: { background: '#F3E9DD', accent: '#5C4A66' },
};

function emojiFor(tile: SummaryGlanceTile): string {
  return (
    GLANCE_EMOJI[tile.key] ??
    (tile.ringKey ? RING_EMOJI[tile.ringKey as ReportRingKey] : undefined) ??
    '📊'
  );
}

/**
 * The month at a glance.
 *
 * Six answers to the six things a reader asks of a month, each on its own tile.
 * Tiles the API could not honestly fill are absent rather than empty — a grid of
 * dashes costs a whole screen and says nothing — so this renders whatever
 * arrived and lets the grid reflow.
 *
 * Tiles that name a metric tap through to that metric's day-by-day view.
 */
export function GlanceGrid({
  tiles,
  onSelect,
}: {
  tiles: SummaryGlanceTile[];
  onSelect: (key: ReportRingKey) => void;
}) {
  if (tiles.length === 0) return null;

  return (
    <div className="grid grid-cols-2 gap-2.5">
      {tiles.map((tile) => {
        const style = TONE_STYLE[tile.tone];
        const body = (
          <>
            <div className="flex items-start justify-between gap-2">
              <span
                className="text-[9.5px] font-semibold uppercase leading-[1.2] tracking-[0.08em]"
                style={{ color: style.accent, fontFamily: MULISH }}
              >
                {tile.eyebrow}
              </span>
              <span aria-hidden="true" className="shrink-0 text-[15px] leading-none">
                {emojiFor(tile)}
              </span>
            </div>

            <span
              className="mt-1.5 block text-[15px] leading-[1.2] text-on-surface"
              style={{ fontFamily: FRAUNCES }}
            >
              {tile.label}
            </span>

            {tile.value && (
              <span
                className="mt-0.5 block text-[13px] font-semibold leading-[1.2]"
                style={{ color: style.accent, fontFamily: MULISH }}
              >
                {tile.value}
              </span>
            )}

            {tile.note && (
              <span
                className="mt-0.5 block text-[10.5px] leading-[1.3] text-on-surface-variant"
                style={{ fontFamily: MULISH }}
              >
                {tile.note}
              </span>
            )}
          </>
        );

        const shell = 'rounded-[18px] p-3 text-left';

        return tile.ringKey ? (
          <button
            key={tile.key}
            type="button"
            onClick={() => onSelect(tile.ringKey as ReportRingKey)}
            aria-label={`${tile.eyebrow}: ${tile.label}${tile.value ? `, ${tile.value}` : ''} ${tile.note}. See day by day`}
            className={`${shell} min-h-[92px] transition-transform active:scale-[0.98]`}
            style={{ backgroundColor: style.background }}
          >
            {body}
          </button>
        ) : (
          <div
            key={tile.key}
            className={shell}
            style={{ backgroundColor: style.background }}
          >
            {body}
          </div>
        );
      })}
    </div>
  );
}
