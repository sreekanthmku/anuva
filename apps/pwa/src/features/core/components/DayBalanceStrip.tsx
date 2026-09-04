import type { SummaryDayBalance, WellnessGroup } from '@anuva/shared';
import { Eyebrow } from '../../../shared/components/Eyebrow';
import { RING_EMPTY_COLOR } from '../ringColors';
import { GROUP_COLOR, GROUP_LABEL } from '../wellnessDisplay';
import { BALANCE_EMOJI } from '../summaryEmoji';

const MULISH = '"Mulish", -apple-system, system-ui, sans-serif';
const FRAUNCES = '"Fraunces", sans-serif';

type Column = {
  key: 'good' | 'okay' | 'hard' | 'untracked';
  count: number;
  label: string;
  color: string;
};

function singular(label: string, count: number): string {
  return count === 1 ? label.replace(/days$/, 'day') : label;
}

/**
 * The window's days, sorted onto the ladder.
 *
 * Four columns, not three: the ladder has a middle band, and folding okay days
 * into either neighbour would flatter or damn a week that was neither. The
 * untracked column is deliberately as prominent as the rest — a week that looks
 * hard because five days are missing is a different week from a hard one, and
 * hiding the gap is how a reader ends up mistrusting the whole page.
 */
export function DayBalanceStrip({
  balance,
  trackingLabel,
}: {
  balance: SummaryDayBalance;
  trackingLabel: string;
}) {
  const columns: Column[] = [
    ...(['good', 'okay', 'hard'] as WellnessGroup[]).map((group) => ({
      key: group,
      count: balance[group],
      label: GROUP_LABEL[group],
      color: GROUP_COLOR[group],
    })),
    {
      key: 'untracked' as const,
      count: balance.untracked,
      label: 'Untracked days',
      color: RING_EMPTY_COLOR,
    },
  ];

  return (
    <article
      className="relative overflow-hidden rounded-[20px] border border-border-default px-3 py-4"
      // Warm wash rather than flat white: this is the week view's opening card
      // now that the headline card is hidden there, and it was reading as an
      // empty box. Same cream-to-rose ramp as the day view's headline card, so
      // the two tabs feel like one page.
      style={{ background: 'linear-gradient(103deg, #FFFFFF 0%, #FDF6EF 54%, #F7E9E6 100%)' }}
    >
      <div className="relative mb-1 flex items-center justify-between gap-2 px-1">
        <Eyebrow className="mb-0">Day balance</Eyebrow>
        <span
          className="shrink-0 rounded-full bg-surface px-2.5 py-1 text-[9.5px] uppercase tracking-[0.08em] text-on-surface-variant"
          style={{ fontFamily: MULISH }}
        >
          {trackingLabel}
        </span>
      </div>

      <div className="relative flex items-stretch">
        {columns.map((column, i) => (
          <div
            key={column.key}
            className={`flex flex-1 flex-col items-center gap-1 px-1 py-2 ${
              i > 0 ? 'border-l border-border-default' : ''
            }`}
          >
            {/* The face sits in a disc of its own band colour, the same way the
                tracker rows carry their metric colour. */}
            <span
              aria-hidden="true"
              className="flex h-[30px] w-[30px] items-center justify-center rounded-full text-[15px] leading-none"
              style={{ backgroundColor: `${column.color}20` }}
            >
              {BALANCE_EMOJI[column.key]}
            </span>
            <span
              className="text-[21px] leading-none"
              style={{ fontFamily: FRAUNCES, color: column.color }}
            >
              {column.count}
            </span>
            <span
              className="text-center text-[9.5px] leading-[1.25] text-on-surface-variant"
              style={{ fontFamily: MULISH }}
            >
              {singular(column.label, column.count)}
            </span>
          </div>
        ))}
      </div>
    </article>
  );
}
