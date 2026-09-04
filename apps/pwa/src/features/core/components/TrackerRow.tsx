import type { ReportRing, ReportRingKey, SummaryPeriod } from '@anuva/shared';
import { RING_COLORS, RING_EMPTY_COLOR, gaugeBandColor } from '../ringColors';
import { DELTA_TONE_COLOR, ringAriaLabel } from '../ringDisplay';
import { RING_EMOJI } from '../summaryEmoji';

const MULISH = '"Mulish", -apple-system, system-ui, sans-serif';

/** Segments in the level bar — one per band on the gauge scale. */
const SEGMENTS = 5;

const ARROW: Record<ReportRing['deltaTone'], string> = {
  positive: 'M10 3.5v13M5.5 8L10 3.5 14.5 8',
  attention: 'M10 16.5v-13M5.5 12L10 16.5 14.5 12',
  neutral: 'M3.5 10h13M12 5.5l4.5 4.5L12 14.5',
  none: '',
};

/**
 * The direction word, shortened for a row.
 *
 * The API's own `delta` is a sentence fragment written for the metric detail
 * hero ("Below your usual", "+22 pts · improving") and wraps to three lines in
 * a column this narrow. The tone is what the row is actually reporting, so the
 * word comes off the tone and the full string stays in the row's aria-label.
 *
 * `none` — no comparable history — deliberately renders nothing. A word there
 * would be a comparison we have not got.
 */
const DELTA_WORD: Record<ReportRing['deltaTone'], string> = {
  positive: 'Better',
  attention: 'Worse',
  neutral: 'Similar',
  none: '',
};

/**
 * How many segments a score fills.
 *
 * Deliberately the band index rather than a percentage of five: the bar then
 * says the same thing as the word beside it, and a score cannot show four
 * segments while reading "Disturbed". Matches `gaugeBandColor`'s own index.
 */
function filledSegments(pct: number): number {
  const clamped = Math.min(Math.max(pct, 0), 100);
  return Math.min(SEGMENTS, Math.floor((clamped / 100) * SEGMENTS) + 1);
}

/**
 * One tracker, as a row: what it is, how it reads, and which way it moved.
 *
 * A row rather than a dial because six dials answer "what is my score" and a
 * reader is asking "what changed" — the band word and the direction word are the
 * answer, and both fit on one line here at a size that can actually be read.
 * The number itself is deliberately absent: 75 on stress means low stress, and
 * the word says so where the digits cannot.
 */
export function TrackerRow({
  ring,
  period,
  onSelect,
}: {
  ring: ReportRing;
  period: SummaryPeriod;
  onSelect?: (key: ReportRingKey) => void;
}) {
  const hasData = ring.pct != null;
  const bandColor = gaugeBandColor(ring.pct);
  const metric = RING_COLORS[ring.key];
  const filled = hasData ? filledSegments(ring.pct!) : 0;
  const label = ringAriaLabel(ring);
  const word = DELTA_WORD[ring.deltaTone];
  // Points only where a point delta means something: one day against a
  // trailing average is too noisy to quote, which is why the API's daily copy
  // has no number in it either.
  const points =
    period !== 'daily' && ring.deltaValue != null
      ? `${ring.deltaValue > 0 ? '+' : ''}${Math.round(ring.deltaValue)} pts`
      : null;

  const inner = (
    <>
      <span
        aria-hidden="true"
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[16px] leading-none"
        style={{ backgroundColor: metric.track }}
      >
        {RING_EMOJI[ring.key]}
      </span>

      <span className="min-w-0 flex-1">
        <span
          className="block truncate text-[13.5px] leading-[1.25] text-on-surface"
          style={{ fontFamily: MULISH }}
        >
          {ring.label}
        </span>
        <span
          className="mt-0.5 block truncate text-[11.5px] font-semibold leading-[1.2]"
          style={{ color: hasData ? bandColor : RING_EMPTY_COLOR, fontFamily: MULISH }}
        >
          {hasData ? (ring.band ?? '—') : 'Not logged'}
        </span>
      </span>

      <span className="flex w-[86px] shrink-0 flex-col items-end gap-1">
        {hasData && word && (
          <span className="flex items-center gap-1">
            <span
              className="text-right text-[11px] font-semibold leading-none"
              style={{ color: DELTA_TONE_COLOR[ring.deltaTone], fontFamily: MULISH }}
            >
              {word}
            </span>
            <svg width="11" height="11" viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <path
                d={ARROW[ring.deltaTone]}
                stroke={DELTA_TONE_COLOR[ring.deltaTone]}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
        )}
        {hasData && points && (
          <span
            className="text-right text-[9.5px] leading-none text-outline"
            style={{ fontFamily: MULISH }}
          >
            {points}
          </span>
        )}
        <span className="flex w-full gap-[3px]" aria-hidden="true">
          {Array.from({ length: SEGMENTS }, (_, i) => (
            <span
              key={i}
              className="h-[3px] flex-1 rounded-full"
              style={{ backgroundColor: i < filled ? metric.color : metric.track }}
            />
          ))}
        </span>
      </span>
    </>
  );

  // A single day holds one value per metric, so there is nothing to expand.
  if (!onSelect) {
    return (
      <div className="flex items-center gap-3 py-2.5" role="img" aria-label={label}>
        {inner}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => onSelect(ring.key)}
      aria-label={`${label}. See day by day`}
      className="flex min-h-[56px] w-full items-center gap-3 py-2.5 text-left transition-opacity active:opacity-60"
    >
      {inner}
    </button>
  );
}
