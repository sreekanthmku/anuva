import type { ReportDeltaTone, ReportRing, ReportRingKey } from '@anuva/shared';
import { Eyebrow } from '../../../shared/components/Eyebrow';

const MULISH = '"Mulish", -apple-system, system-ui, sans-serif';

/**
 * One wash per direction, so the three columns are legible before they are
 * read — a row of identical white boxes made the reader parse three headings to
 * find the one that matters.
 *
 * The accents are the same green / gold / rose the monthly glance tiles use for
 * the same three meanings, which is why they are not `DELTA_TONE_COLOR`: that
 * table paints an *individual* metric's delta, where plum is deliberate. Here
 * the colour is the grouping itself.
 */
const COLUMNS: {
  tone: Exclude<ReportDeltaTone, 'none'>;
  title: string;
  emoji: string;
  tint: string;
  accent: string;
}[] = [
  {
    tone: 'positive',
    title: 'Improving',
    emoji: '🌱',
    tint: 'rgba(79, 157, 107, 0.12)',
    accent: '#3F7F56',
  },
  {
    tone: 'neutral',
    title: 'Steady',
    emoji: '🍂',
    tint: 'rgba(184, 146, 60, 0.13)',
    accent: '#5A4716',
  },
  {
    tone: 'attention',
    title: 'Needs attention',
    emoji: '⚠️',
    tint: '#F8DCE2',
    accent: '#C0405A',
  },
];

/**
 * What moved, grouped by direction.
 *
 * Reads off `deltaTone`, which the API sends precisely so a client never has to
 * infer good news from the sign of a number. Metrics with tone `none` — no
 * comparable history yet — appear in no column at all: a first week has nothing
 * to say here, and filing it under "steady" would be a claim we cannot make.
 *
 * Each name taps through to its own day-by-day view, which is where the six
 * metrics live now that the window views lead with the shape of the window.
 */
export function StoodOutCard({
  rings,
  onSelect,
}: {
  rings: ReportRing[];
  onSelect: (key: ReportRingKey) => void;
}) {
  const grouped = COLUMNS.map((column) => ({
    ...column,
    rings: rings.filter((ring) => ring.pct != null && ring.deltaTone === column.tone),
  })).filter((column) => column.rings.length > 0);

  if (grouped.length === 0) return null;

  return (
    <article className="rounded-[20px] border border-border-default bg-surface-raised px-4 py-4">
      <Eyebrow>What stood out</Eyebrow>

      {/* Equal columns, sized to however many groups actually have something in
          them — a fixed three-up leaves a hole on a week where nothing worsened.
          `minmax(0, 1fr)` is what lets the labels wrap instead of forcing the
          track wider than the card. */}
      <div
        className="grid gap-2"
        style={{ gridTemplateColumns: `repeat(${grouped.length}, minmax(0, 1fr))` }}
      >
        {grouped.map((column) => (
          <div
            key={column.tone}
            className="min-w-0 rounded-starchart-lg p-2.5"
            style={{ backgroundColor: column.tint }}
          >
            <div className="mb-1.5 flex items-start gap-1.5">
              <span aria-hidden="true" className="mt-px shrink-0 text-[12px] leading-none">
                {column.emoji}
              </span>
              <span
                className="min-w-0 text-[10.5px] font-semibold leading-[1.25]"
                style={{ color: column.accent, fontFamily: MULISH }}
              >
                {column.title}
              </span>
            </div>

            <ul className="flex flex-col gap-1">
              {column.rings.map((ring) => (
                <li key={ring.key}>
                  <button
                    type="button"
                    onClick={() => onSelect(ring.key)}
                    aria-label={`${ring.label}, ${column.title.toLowerCase()}. See day by day`}
                    className="flex w-full items-start gap-1.5 py-0.5 text-left text-[11.5px] leading-[1.3] text-on-surface transition-opacity active:opacity-60"
                    style={{ fontFamily: MULISH }}
                  >
                    {/* A bullet, not the metric's emoji: six emoji stacked in a
                        column this narrow read as a legend rather than a list,
                        and they pushed the labels into an ellipsis. */}
                    <span
                      aria-hidden="true"
                      className="mt-[6px] h-[3px] w-[3px] shrink-0 rounded-full bg-current opacity-50"
                    />
                    {/* Wraps. "Cognitive focus" does not fit a third of a phone
                        on one line, and truncating it hid which metric it was. */}
                    <span className="min-w-0 flex-1 break-words">{ring.label}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </article>
  );
}
