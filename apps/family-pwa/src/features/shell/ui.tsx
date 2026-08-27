import type { ReactNode, SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement> & { size?: number; strokeWidth?: number };

function baseProps({ size = 22, strokeWidth = 1.6, ...rest }: IconProps) {
  return {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true as const,
    ...rest,
  };
}

export function HomeIcon(props: IconProps) {
  return (
    <svg {...baseProps(props)}>
      <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5Z" />
    </svg>
  );
}

export function BookIcon(props: IconProps) {
  return (
    <svg {...baseProps(props)}>
      <path d="M5 5.5A2.5 2.5 0 0 1 7.5 3H19v16H7.5A2.5 2.5 0 0 0 5 21.5V5.5Z" />
      <path d="M5 5.5A2.5 2.5 0 0 1 7.5 3" />
      <path d="M9 8h7M9 12h7" />
    </svg>
  );
}

export function ShieldIcon(props: IconProps) {
  return (
    <svg {...baseProps(props)}>
      <path d="M12 3 5 6.5v5.2c0 4.2 2.8 7.3 7 8.8 4.2-1.5 7-4.6 7-8.8V6.5L12 3Z" />
      <path d="M9.5 12.2 11.2 14l3.3-3.6" />
    </svg>
  );
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <article
      className={`rounded-[22px] border border-border-default bg-surface-raised shadow-[0_10px_28px_rgba(94,53,102,0.05)] ${className}`}
    >
      {children}
    </article>
  );
}

export function Eyebrow({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`mb-2 flex items-center gap-2 ${className}`}>
      <span className="h-px w-4 bg-tertiary/50" />
      <span className="text-[11px] font-semibold uppercase tracking-[0.13em] text-tertiary">
        {children}
      </span>
    </div>
  );
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div className="mb-2 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-outline">
      {children}
    </div>
  );
}

export function PageIntro({
  eyebrow,
  title,
  subline,
}: {
  eyebrow: string;
  title: string;
  subline?: string;
}) {
  return (
    <header className="mb-5">
      <Eyebrow>{eyebrow}</Eyebrow>
      <h1 className="font-display text-[28px] leading-[1.12] text-on-surface">{title}</h1>
      {subline ? (
        <p className="mt-2 text-[14px] leading-[1.5] text-on-surface-variant">{subline}</p>
      ) : null}
    </header>
  );
}

/** Card-shaped placeholder while a screen's single fetch is in flight. */
export function SkeletonCard({ lines = 2 }: { lines?: number }) {
  return (
    <div className="rounded-[20px] border border-border-default bg-surface-raised px-5 py-5">
      <div className="h-3 w-24 animate-pulse rounded-full bg-surface-container" />
      <div className="mt-3 h-5 w-3/4 animate-pulse rounded-full bg-surface-container" />
      {Array.from({ length: lines }).map((_, index) => (
        <div
          key={index}
          className="mt-2 h-3 animate-pulse rounded-full bg-surface-container"
          style={{ width: `${90 - index * 15}%` }}
        />
      ))}
    </div>
  );
}

export function ErrorCard({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="rounded-[20px] border border-border-default bg-surface-raised px-5 py-5" role="alert">
      <h2 className="font-display text-[17px] leading-snug text-on-surface">
        This did not load
      </h2>
      <p className="mt-2 text-[13.5px] leading-[1.55] text-on-surface-variant">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-4 flex min-h-[44px] w-full items-center justify-center rounded-full border border-border-default px-5 text-[13.5px] font-semibold text-primary"
      >
        Try again
      </button>
    </div>
  );
}
