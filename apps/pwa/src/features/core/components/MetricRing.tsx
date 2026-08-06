import type { ReportRingKey } from '@anuva/shared';
import { RING_COLORS, RING_EMPTY_COLOR } from '../ringColors';

/**
 * Progress ring with a reference marker. Every dimension derives from `size` so
 * the 88px card ring and the 150px detail ring stay visually identical.
 */
export function MetricRing({
  pct,
  referenceValue,
  ringKey,
  size = 88,
  ariaLabel,
}: {
  pct: number | null;
  referenceValue: number;
  ringKey: ReportRingKey;
  size?: number;
  ariaLabel?: string;
}) {
  const { color, track } = RING_COLORS[ringKey];
  const center = size / 2;
  const stroke = Math.round(size * 0.102);
  const radius = center - stroke / 2 - 2;
  const circumference = 2 * Math.PI * radius;

  const hasData = pct != null;
  const progress = Math.min(Math.max((pct ?? 0) / 100, 0), 1);

  const referenceAngle = (referenceValue / 100) * 360 - 90;
  const referenceX = center + radius * Math.cos((referenceAngle * Math.PI) / 180);
  const referenceY = center + radius * Math.sin((referenceAngle * Math.PI) / 180);

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
        <circle cx={center} cy={center} r={radius} fill="none" stroke={track} strokeWidth={stroke} />
        {hasData && (
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeDasharray={`${circumference * progress} ${circumference}`}
            strokeLinecap="round"
            transform={`rotate(-90 ${center} ${center})`}
          />
        )}
        <circle
          cx={referenceX}
          cy={referenceY}
          r={Math.max(2.2, size * 0.025)}
          fill="#FBF6F0"
          stroke={color}
          strokeWidth={Math.max(1.4, size * 0.016)}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span
          className="font-semibold leading-none"
          style={{
            fontSize: Math.round(size * 0.182),
            color: hasData ? color : RING_EMPTY_COLOR,
            fontFamily: '"Mulish", sans-serif',
          }}
        >
          {hasData ? `${pct}%` : '—'}
        </span>
      </div>
    </div>
  );
}
