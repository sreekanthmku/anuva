type LotusLogoProps = {
  size?: number;
  color?: string;
};

export function LotusLogo({ size = 40, color = '#cebdff' }: LotusLogoProps) {
  return (
    <div
      className="inline-flex items-center justify-center"
      style={{ width: size, height: size, filter: `drop-shadow(0 0 12px ${color}88) drop-shadow(0 0 4px ${color})` }}
    >
      <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden="true">
        {Array.from({ length: 8 }).map((_, i) => (
          <ellipse
            key={i}
            cx="50"
            cy="28"
            rx="6"
            ry="18"
            fill={color}
            opacity={i % 2 === 0 ? 0.95 : 0.55}
            transform={`rotate(${i * 45} 50 50)`}
          />
        ))}
        <circle cx="50" cy="50" r="4" fill={color} />
      </svg>
    </div>
  );
}

