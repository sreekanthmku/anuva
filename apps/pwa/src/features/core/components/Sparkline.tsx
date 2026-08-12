import { formatShortDay, formatShortDayFrom } from '../summaryDates';
import {
  type ChartScale,
  normalize,
  outOfCoverage,
  resolveDomain,
  runsOf,
  tickIndices,
} from '../chartScale';

const MULISH = '"Mulish", -apple-system, system-ui, sans-serif';

const PLOT_HEIGHT = 40;
/** Above this many columns the dots crowd into a solid band, so the line carries it alone. */
const MAX_DOTS = 10;
const DOT = 8;
const AXIS_TEXT = '#6E5A78';
const AXIS_RULE = '#E3D4DC';
const MISSING = '#B9A79A';
/** Height of the strip under the axis that holds the not-logged ticks. */
const MISSING_GUTTER = 6;
/** Shading for days outside the window, not a colour with meaning. */
const INACTIVE_TINT = 'rgba(94, 53, 102, 0.045)';

type SparklineProps = {
  /** One entry per day of the window, oldest first. Null where nothing was logged. */
  values: (number | null)[];
  color: string;
  /** The day `values[0]` refers to. */
  seriesStart: string;
  /** First day the user could have logged — earlier columns predate their signup. */
  coverageStart: string;
  /** Last day that has happened — later columns have not arrived yet. */
  coverageEnd: string;
  scale: ChartScale;
  /** Metric name and unit, for the screen-reader summary only. */
  label: string;
  unit: string;
  /**
   * Print the "not logged" legend under this chart. Set on the first card of a
   * screen only — the tick means the same thing on all of them, and repeating the
   * sentence under each one buries the charts in small print.
   */
  showMissingLegend?: boolean;
};

/** Slot centre as a percentage, matching the column model DayBarChart uses. */
function slotCenter(i: number, count: number): number {
  return ((i + 0.5) / count) * 100;
}

/**
 * A day-by-day line for one metric.
 *
 * Three rules it did not used to follow, each of which made it unreadable:
 *
 *  - **The domain is zoomed and both ends are labelled.** A wellness series
 *    sitting between 66 and 79 rendered as 3.6px of movement in a 22px box when
 *    the axis started at zero. Truncating the axis is only honest with a line
 *    mark and a visible floor label, so it has both.
 *  - **The mark never changes.** It used to switch from bars to an area above 14
 *    points, so stepping from this month (12 columns) to last month (31) changed
 *    the chart type under the reader.
 *  - **A logged zero is not a gap.** Zero hot flashes is good news and used to
 *    render identically to an untracked day. Now zero is a dot on the axis and a
 *    missing day is a break in the line plus a muted tick.
 */
export function Sparkline({
  values,
  color,
  seriesStart,
  coverageStart,
  coverageEnd,
  scale,
  label,
  unit,
  showMissingLegend,
}: SparklineProps) {
  const count = values.length;
  if (count === 0) return <div style={{ height: PLOT_HEIGHT }} />;

  const domain = resolveDomain(values, scale);
  const inactive = outOfCoverage(seriesStart, count, coverageStart, coverageEnd);

  const y = (v: number) => PLOT_HEIGHT - normalize(v, domain) * PLOT_HEIGHT;

  // Runs of consecutive logged days. The line breaks between them rather than
  // interpolating across a gap — the old area chart drew a confident straight
  // line through three untracked weeks.
  const loggedRuns = runsOf(values.map((v) => v != null));

  const segments = loggedRuns
    .filter(([from, to]) => to > from)
    .map(([from, to]) => {
      const points: string[] = [];
      for (let i = from; i <= to; i += 1) {
        points.push(`${slotCenter(i, count).toFixed(2)} ${y(values[i]!).toFixed(2)}`);
      }
      return `M${points.join(' L')}`;
    });

  const loggedIndices = values.map((v, i) => (v != null ? i : -1)).filter((i) => i >= 0);
  const lastLogged = loggedIndices[loggedIndices.length - 1];

  /**
   * A logged day with no logged neighbour draws no line segment, so its dot is
   * the only thing representing it. Those are never thinned: someone logging on
   * alternate days has no adjacent pairs at all, and capping dots would have
   * rendered their month as an empty box.
   */
  const orphans = loggedRuns.filter(([from, to]) => to === from).map(([from]) => from);

  const dotIndices =
    loggedIndices.length <= MAX_DOTS
      ? loggedIndices
      : // Past the cap, keep the orphans plus the newest point — the value the
        // reader is looking for — and let the line carry the rest.
        [...new Set([...orphans, ...(lastLogged == null ? [] : [lastLogged])])].sort(
          (a, b) => a - b
        );

  const missingIndices = values
    .map((v, i) => (v == null && !inactive[i] ? i : -1))
    .filter((i) => i >= 0);

  const ticks = tickIndices(count, 3);

  const logged = values.filter((v): v is number => v != null);
  const ariaLabel = (() => {
    const span = `${formatShortDay(seriesStart)} to ${formatShortDayFrom(seriesStart, count - 1)}`;
    if (logged.length === 0) return `${label} — nothing logged between ${span}.`;
    const lo = domain.formatValue(Math.min(...logged));
    const hi = domain.formatValue(Math.max(...logged));
    const latest = domain.formatValue(logged[logged.length - 1]!);
    const shape =
      lo === hi ? `${lo} ${unit} throughout` : `ranged ${lo} to ${hi} ${unit}, latest ${latest} ${unit}`;
    const missingNote = missingIndices.length > 0 ? ` ${missingIndices.length} not logged.` : '';
    return `${label}, ${span}: ${shape}. ${logged.length} of ${count - inactive.filter(Boolean).length} days logged.${missingNote}`;
  })();

  return (
    <figure className="m-0" role="img" aria-label={ariaLabel}>
      <div className="flex items-stretch gap-1">
        {/* Both domain ends are labelled — a zoomed axis without them is a lie. */}
        <div
          className="flex w-[19px] shrink-0 flex-col justify-between text-right text-[8.5px] leading-none"
          style={{ fontFamily: MULISH, color: AXIS_TEXT }}
        >
          <span>{domain.format(domain.max)}</span>
          <span>{domain.format(domain.min)}</span>
        </div>

        <div className="relative min-w-0 flex-1" style={{ height: PLOT_HEIGHT }}>
          {runsOf(inactive).map(([from, to]) => (
            <span
              key={`inactive-${from}`}
              className="pointer-events-none absolute inset-y-0 rounded-sm"
              style={{
                left: `${(from / count) * 100}%`,
                width: `${((to - from + 1) / count) * 100}%`,
                backgroundColor: INACTIVE_TINT,
              }}
            />
          ))}

          {/* The floor of the plot, labelled left — not necessarily zero. */}
          <span
            className="pointer-events-none absolute inset-x-0 bottom-0 h-px"
            style={{ backgroundColor: AXIS_RULE }}
          />

          <svg
            viewBox={`0 0 100 ${PLOT_HEIGHT}`}
            preserveAspectRatio="none"
            className="block h-full w-full"
            aria-hidden="true"
          >
            {segments.map((d, i) => (
              <path
                key={i}
                d={d}
                fill="none"
                stroke={color}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                // The viewBox is stretched horizontally, so a scaled stroke
                // would render as a wedge rather than a line.
                vectorEffect="non-scaling-stroke"
              />
            ))}
          </svg>

          {/* Markers live outside the SVG so the non-uniform scale cannot squash
              them into ellipses. */}
          {dotIndices.map((i) => (
            <span
              key={`dot-${i}`}
              className="pointer-events-none absolute rounded-full"
              style={{
                left: `${slotCenter(i, count)}%`,
                top: `${(y(values[i]!) / PLOT_HEIGHT) * 100}%`,
                width: i === lastLogged ? DOT : DOT - 3,
                height: i === lastLogged ? DOT : DOT - 3,
                marginLeft: i === lastLogged ? -DOT / 2 : -(DOT - 3) / 2,
                marginTop: i === lastLogged ? -DOT / 2 : -(DOT - 3) / 2,
                backgroundColor: color,
                // A surface ring separates the newest dot from the line it sits on.
                boxShadow: i === lastLogged ? '0 0 0 2px #FFFFFF' : undefined,
              }}
            />
          ))}

        </div>
      </div>

      {/* Missing days live in their own gutter *below* the axis, never on it. On
          the axis they read as a real low value — a grey tick sitting on a sleep
          chart's "5" line looks like five hours, not an untracked night. */}
      <div className="flex gap-1">
        <span className="w-[19px] shrink-0" />
        <div className="relative min-w-0 flex-1" style={{ height: MISSING_GUTTER }}>
          {missingIndices.map((i) => (
            <span
              key={`missing-${i}`}
              className="pointer-events-none absolute top-[1px] rounded-full"
              style={{
                left: `${slotCenter(i, count)}%`,
                width: 2,
                height: MISSING_GUTTER - 2,
                marginLeft: -1,
                backgroundColor: MISSING,
              }}
            />
          ))}
        </div>
      </div>

      <div className="flex gap-1">
        <span className="w-[19px] shrink-0" />
        <div className="relative min-w-0 flex-1" style={{ height: 11 }}>
          {ticks.map((i) => (
            <span
              key={i}
              className="absolute whitespace-nowrap text-[8.5px] leading-none"
              style={{
                fontFamily: MULISH,
                color: AXIS_TEXT,
                left: `${slotCenter(i, count)}%`,
                // Pull the end labels inside the plot so neither clips.
                transform:
                  i === 0
                    ? 'translateX(0)'
                    : i === count - 1
                      ? 'translateX(-100%)'
                      : 'translateX(-50%)',
              }}
            >
              {formatShortDayFrom(seriesStart, i)}
            </span>
          ))}
        </div>
      </div>

      {showMissingLegend && missingIndices.length > 0 && (
        <figcaption
          className="mt-1 text-[8.5px] leading-[1.3]"
          style={{ fontFamily: MULISH, color: AXIS_TEXT }}
        >
          Ticks under the axis are days with no check-in.
        </figcaption>
      )}
    </figure>
  );
}
