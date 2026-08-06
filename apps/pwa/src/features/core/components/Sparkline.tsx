const EMPTY_BAR = '#F0E4D6';
const IDLE_BAR = '#ECDFD0';

/** Above this many points, individual bars are too thin to read in a stat card. */
const AREA_THRESHOLD = 14;

type SparklineProps = {
  /** One entry per day, oldest first. Null where nothing was logged. */
  values: (number | null)[];
  color: string;
};

function lastLoggedIndex(values: (number | null)[]): number {
  for (let i = values.length - 1; i >= 0; i -= 1) {
    if (values[i] != null) return i;
  }
  return -1;
}

function BarSparkline({ values, color }: SparklineProps) {
  const max = Math.max(...values.map((v) => v ?? 0), 1);
  const last = lastLoggedIndex(values);

  return (
    <div className="flex h-[22px] items-end gap-0.5">
      {values.map((v, i) => (
        <div
          key={i}
          className="min-h-[2px] flex-1 rounded-sm"
          style={{
            height: v == null ? '8%' : `${Math.max(8, (v / max) * 100)}%`,
            backgroundColor: v == null ? EMPTY_BAR : i === last ? color : IDLE_BAR,
          }}
        />
      ))}
    </div>
  );
}

/**
 * A month of daily bars would be ~3px wide inside a stat card. An area reads the
 * same span at the same height, so long windows switch mark rather than
 * aggregating days away.
 */
function AreaSparkline({ values, color }: SparklineProps) {
  const points = values
    .map((v, i) => ({ i, v }))
    .filter((p): p is { i: number; v: number } => p.v != null);

  if (points.length === 0) {
    return <div className="h-[22px]" />;
  }

  const height = 24;
  const max = Math.max(...points.map((p) => p.v), 1);
  const span = Math.max(values.length - 1, 1);
  const x = (i: number) => (i / span) * 100;
  // 1px of headroom top and bottom so the stroke is never clipped.
  const y = (v: number) => height - 1 - (v / max) * (height - 2);

  const line = points
    .map((p, idx) => `${idx === 0 ? 'M' : 'L'}${x(p.i).toFixed(2)} ${y(p.v).toFixed(2)}`)
    .join(' ');
  const first = points[0]!;
  const last = points[points.length - 1]!;
  const area = `${line} L${x(last.i).toFixed(2)} ${height} L${x(first.i).toFixed(2)} ${height} Z`;

  return (
    <div className="relative h-[22px]">
      <svg
        viewBox={`0 0 100 ${height}`}
        preserveAspectRatio="none"
        className="block h-full w-full"
        aria-hidden="true"
      >
        <path d={area} fill={color} fillOpacity="0.14" />
        <path
          d={line}
          fill="none"
          stroke={color}
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      {/* Positioned outside the SVG so the non-uniform scale cannot squash it. */}
      <span
        className="absolute h-[5px] w-[5px] -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{
          left: `${x(last.i)}%`,
          top: `${(y(last.v) / height) * 100}%`,
          backgroundColor: color,
        }}
      />
    </div>
  );
}

export function Sparkline({ values, color }: SparklineProps) {
  if (values.length === 0) return <div className="h-[22px]" />;
  return values.length > AREA_THRESHOLD ? (
    <AreaSparkline values={values} color={color} />
  ) : (
    <BarSparkline values={values} color={color} />
  );
}
