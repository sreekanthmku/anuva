import type { ReactNode } from 'react';
import type { ReportRingKey } from '@anuva/shared';
import { GAUGE_BANDS, RING_COLORS, RING_EMPTY_COLOR } from '../ringColors';

/**
 * Score gauge — a speedometer-style half circle with a needle. Every dimension
 * derives from `size` (the gauge's width) so the 88px card gauge and the wider
 * detail hero read as the same instrument.
 *
 * The dial itself is identical on every metric: the same five bands, poor to
 * good, left to right. Only the needle moves. `pct` positions the needle and is
 * never rendered as a number — on stress and heat episodes a high score means
 * *less* symptom, so the band word from the API is the readout, not the score.
 */

/** Needle and hub — one ink colour, so the dial's bands carry the meaning. */
const NEEDLE_COLOR = '#3E2542';

/** Polar point on the dial. `t` runs 0 (left end) to 1 (right end). */
function pointAt(t: number, mid: number, radius: number) {
  const angle = Math.PI * (1 - t);
  return { x: mid + radius * Math.cos(angle), y: mid - radius * Math.sin(angle) };
}

export function MetricRing({
  pct,
  referenceValue,
  ringKey,
  size = 88,
  strokeRatio = 0.17,
  ariaLabel,
  center,
}: {
  pct: number | null;
  /** The user's own previous level. Null when there is no comparable history — then no tick is drawn. */
  referenceValue: number | null;
  /** Only used for the reference tick's outline, so it reads as the metric's own history. */
  ringKey: ReportRingKey;
  /** Width of the gauge. Its height is a little over half of this. */
  size?: number;
  /** Stroke as a fraction of `size`. The detail hero runs thicker than the grid cards. */
  strokeRatio?: number;
  ariaLabel?: string;
  /** Optional readout rendered under the dial. The score itself is never shown. */
  center?: ReactNode;
}) {
  const mid = size / 2;
  const stroke = Math.max(4, Math.round(size * strokeRatio));
  const radius = mid - stroke / 2 - 2;
  // Only the top half is drawn, plus enough room under the baseline for the hub.
  const hubRadius = Math.max(4, size * 0.075);
  const height = mid + hubRadius + 2;

  const hasData = pct != null;
  const progress = Math.min(Math.max((pct ?? 0) / 100, 0), 1);

  // Needle stops short of the dial so the bands stay readable underneath it.
  const needle = pointAt(progress, mid, radius - stroke * 0.5);
  const reference =
    referenceValue == null
      ? null
      : pointAt(Math.min(Math.max(referenceValue / 100, 0), 1), mid, radius);

  return (
    <div className="flex shrink-0 flex-col items-center" style={{ width: size }}>
      <svg
        width={size}
        height={height}
        viewBox={`0 0 ${size} ${height}`}
        role="img"
        aria-label={ariaLabel}
        className="block"
      >
        {GAUGE_BANDS.map((color, i) => {
          const from = pointAt(i / GAUGE_BANDS.length, mid, radius);
          const to = pointAt((i + 1) / GAUGE_BANDS.length, mid, radius);
          return (
            <path
              key={color}
              d={`M ${from.x} ${from.y} A ${radius} ${radius} 0 0 1 ${to.x} ${to.y}`}
              fill="none"
              // A gauge with nothing logged keeps its shape but drops its scale.
              stroke={hasData ? color : 'rgba(185, 167, 154, 0.35)'}
              strokeWidth={stroke}
            />
          );
        })}
        {/* Hairline gaps between bands, punched in the surface colour. */}
        {Array.from({ length: GAUGE_BANDS.length - 1 }, (_, i) => {
          const t = (i + 1) / GAUGE_BANDS.length;
          const inner = pointAt(t, mid, radius - stroke / 2 - 0.5);
          const outer = pointAt(t, mid, radius + stroke / 2 + 0.5);
          return (
            <line
              key={t}
              x1={inner.x}
              y1={inner.y}
              x2={outer.x}
              y2={outer.y}
              stroke="#FBF6F0"
              strokeWidth={Math.max(1.5, size * 0.017)}
            />
          );
        })}
        {reference && (
          <circle
            cx={reference.x}
            cy={reference.y}
            r={Math.max(2.2, size * 0.025)}
            fill="#FBF6F0"
            stroke={RING_COLORS[ringKey].color}
            strokeWidth={Math.max(1.4, size * 0.016)}
          />
        )}
        {hasData && (
          <line
            x1={mid}
            y1={mid}
            x2={needle.x}
            y2={needle.y}
            stroke={NEEDLE_COLOR}
            strokeWidth={Math.max(1.8, size * 0.026)}
            strokeLinecap="round"
          />
        )}
        <circle cx={mid} cy={mid} r={hubRadius} fill={hasData ? NEEDLE_COLOR : RING_EMPTY_COLOR} />
      </svg>
      {center && <div className="flex flex-col items-center">{center}</div>}
    </div>
  );
}
