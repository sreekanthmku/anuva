import type { ReactNode } from 'react';
import type { ReportRingKey } from '@anuva/shared';
import { RING_COLORS, RING_EMPTY_COLOR } from '../ringColors';

/**
 * Score ring with an optional reference marker. Every dimension derives from
 * `size` so the 88px card ring and the 150px detail ring stay visually
 * identical.
 *
 * `pct` is a 0-100 score, not a percentage — it is never rendered with a `%`.
 * On stress and heat episodes a high score means *less* symptom, so the caller
 * must always pair the number with the band word from the API.
 */
export function MetricRing({
  pct,
  referenceValue,
  ringKey,
  size = 88,
  strokeRatio = 0.102,
  ariaLabel,
  center,
}: {
  pct: number | null;
  /** The user's own previous level. Null when there is no comparable history — then no dot is drawn. */
  referenceValue: number | null;
  ringKey: ReportRingKey;
  size?: number;
  /** Stroke as a fraction of `size`. The detail hero runs thicker than the grid cards. */
  strokeRatio?: number;
  ariaLabel?: string;
  /** Replaces the percentage in the middle. Must fit the inner circle. */
  center?: ReactNode;
}) {
  const { color, track } = RING_COLORS[ringKey];
  const mid = size / 2;
  const stroke = Math.round(size * strokeRatio);
  const radius = mid - stroke / 2 - 2;
  const circumference = 2 * Math.PI * radius;

  const hasData = pct != null;
  const progress = Math.min(Math.max((pct ?? 0) / 100, 0), 1);

  const referenceAngle = ((referenceValue ?? 0) / 100) * 360 - 90;
  const referenceX = mid + radius * Math.cos((referenceAngle * Math.PI) / 180);
  const referenceY = mid + radius * Math.sin((referenceAngle * Math.PI) / 180);

  return (
    <div className="relative shrink-0" style={{ height: size, width: size }}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        role="img"
        aria-label={ariaLabel}
        className="block"
      >
        <circle cx={mid} cy={mid} r={radius} fill="none" stroke={track} strokeWidth={stroke} />
        {hasData && (
          <circle
            cx={mid}
            cy={mid}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeDasharray={`${circumference * progress} ${circumference}`}
            strokeLinecap="round"
            transform={`rotate(-90 ${mid} ${mid})`}
          />
        )}
        {referenceValue != null && (
          <circle
            cx={referenceX}
            cy={referenceY}
            r={Math.max(2.2, size * 0.025)}
            fill="#FBF6F0"
            stroke={color}
            strokeWidth={Math.max(1.4, size * 0.016)}
          />
        )}
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        {center ?? (
          <span
            className="font-semibold leading-none"
            style={{
              fontSize: Math.round(size * 0.182),
              color: hasData ? color : RING_EMPTY_COLOR,
              fontFamily: '"Mulish", sans-serif',
            }}
          >
            {hasData ? pct : '—'}
          </span>
        )}
      </div>
    </div>
  );
}
