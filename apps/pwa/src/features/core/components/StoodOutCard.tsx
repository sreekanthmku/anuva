import type { ReportDeltaTone, ReportRing, ReportRingKey } from '@anuva/shared';
import { Eyebrow } from '../../../shared/components/Eyebrow';
import { DELTA_TONE_COLOR } from '../ringDisplay';
import { RING_EMOJI } from '../summaryEmoji';

const MULISH = '"Mulish", -apple-system, system-ui, sans-serif';

const COLUMNS: { tone: Exclude<ReportDeltaTone, 'none'>; title: string; emoji: string }[] = [
  { tone: 'positive', title: 'Improving', emoji: '🌱' },
  { tone: 'neutral', title: 'Steady', emoji: '⚖️' },
  { tone: 'attention', title: 'Needs attention', emoji: '⚠️' },
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

      <div className="flex flex-wrap gap-2">
        {grouped.map((column) => (
          <div key={column.tone} className="min-w-[104px] flex-1 rounded-starchart-lg bg-surface p-2.5">
            <div className="mb-1.5 flex items-center gap-1.5">
              <span aria-hidden="true" className="text-[12px] leading-none">
                {column.emoji}
              </span>
              <span
                className="text-[10.5px] font-semibold leading-none"
                style={{ color: DELTA_TONE_COLOR[column.tone], fontFamily: MULISH }}
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
                    aria-label={`${ring.label} — ${column.title.toLowerCase()}. See day by day`}
                    className="flex min-h-[26px] w-full items-center gap-1.5 text-left text-[11.5px] leading-[1.2] text-on-surface transition-opacity active:opacity-60"
                    style={{ fontFamily: MULISH }}
                  >
                    <span aria-hidden="true" className="text-[11px] leading-none">
                      {RING_EMOJI[ring.key]}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{ring.label}</span>
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
