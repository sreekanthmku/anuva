import type { ReactNode, SVGProps } from 'react';

/**
 * The family app's visual vocabulary, in one file.
 *
 * Everything on every screen is built from these six pieces, which is what keeps three routes
 * written by different hands looking like one app. The tokens they use are the same Anuva Wellness
 * tokens the patient app uses (`tailwind.config.ts`), so a family member who has seen her phone
 * recognises this one — warm cream ground, plum ink, rose for anything that invites a tap, gold
 * reserved for eyebrows and hairlines.
 */

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

export function HeartIcon(props: IconProps) {
  return (
    <svg {...baseProps(props)}>
      <path d="M12 20s-7-4.4-7-9.3A4.2 4.2 0 0 1 12 8a4.2 4.2 0 0 1 7 2.7C19 15.6 12 20 12 20Z" />
    </svg>
  );
}

export function BellIcon(props: IconProps) {
  return (
    <svg {...baseProps(props)}>
      <path d="M18 15.5V11a6 6 0 1 0-12 0v4.5L4.5 17.5h15L18 15.5Z" />
      <path d="M10 20.5a2.2 2.2 0 0 0 4 0" />
    </svg>
  );
}

/**
 * The one raised surface in the app. `tone` picks the ground it sits on: `plain` for reading,
 * `warm` for the card that carries how she is doing, `quiet` for a supporting aside, `accent` for
 * the rare card that is meant to be looked at rather than read past.
 *
 * The ground is set here rather than passed in through `className`, because two `bg-*` utilities on
 * one element resolve by stylesheet order, not by the order they are written — an override that
 * looks right in the JSX can silently lose.
 */
export function Card({
  children,
  className = '',
  tone = 'plain',
}: {
  children: ReactNode;
  className?: string;
  tone?: 'plain' | 'warm' | 'quiet' | 'accent';
}) {
  const grounds: Record<string, string> = {
    plain: 'bg-surface-raised border-border-default',
    warm: 'bg-surface-raised border-secondary/25',
    quiet: 'bg-surface-container-low border-border-default',
    accent: 'bg-secondary/[0.08] border-secondary/25',
  };

  return (
    <article
      className={`rounded-[24px] border ${grounds[tone]} shadow-soft ${className}`}
    >
      {children}
    </article>
  );
}

/** Gold hairline plus small caps. The app's way of saying "this is what the next bit is". */
export function Eyebrow({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`mb-2.5 flex items-center gap-2 ${className}`}>
      <span className="h-px w-5 bg-tertiary/60" />
      <span className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-tertiary">
        {children}
      </span>
    </div>
  );
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div className="mb-2.5 px-0.5 text-[10.5px] font-bold uppercase tracking-[0.16em] text-outline">
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
    <header className="mb-5 animate-[anuvaRise_420ms_cubic-bezier(0.16,1,0.3,1)]">
      <Eyebrow>{eyebrow}</Eyebrow>
      <h1 className="font-display text-[30px] font-medium leading-[1.1] text-primary">{title}</h1>
      {subline ? (
        <p className="mt-2 text-[14px] leading-[1.55] text-on-surface-variant">{subline}</p>
      ) : null}
    </header>
  );
}

/** The app's only filled button. Pill, 48px, rose, with the shadow that says it is liftable. */
export function PrimaryButton({
  children,
  onClick,
  disabled,
  type = 'button',
  className = '',
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  type?: 'button' | 'submit';
  className?: string;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`press flex min-h-[50px] w-full items-center justify-center gap-2 rounded-full px-5 text-[15px] font-bold text-on-secondary shadow-[0_10px_24px_-8px_rgba(201,126,146,0.75)] disabled:opacity-55 disabled:shadow-none ${className}`}
      style={{ background: 'linear-gradient(135deg, #D08C9E 0%, #C97E92 55%, #B96C84 100%)' }}
    >
      {children}
    </button>
  );
}

export function QuietButton({
  children,
  onClick,
  className = '',
}: {
  children: ReactNode;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`press flex min-h-[46px] w-full items-center justify-center rounded-full border border-border-default bg-surface-raised px-5 text-[14px] font-semibold text-primary ${className}`}
    >
      {children}
    </button>
  );
}

/** Card-shaped placeholder while a screen's single fetch is in flight. */
export function SkeletonCard({ lines = 2 }: { lines?: number }) {
  return (
    <div className="rounded-[24px] border border-border-default bg-surface-raised px-5 py-5 shadow-soft">
      <div className="h-2.5 w-20 animate-pulse rounded-full bg-surface-container" />
      <div className="mt-3.5 h-5 w-3/4 animate-pulse rounded-full bg-surface-container" />
      {Array.from({ length: lines }).map((_, index) => (
        <div
          key={index}
          className="mt-2.5 h-3 animate-pulse rounded-full bg-surface-container"
          style={{ width: `${90 - index * 15}%` }}
        />
      ))}
    </div>
  );
}

export function ErrorCard({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <Card className="px-5 py-6 text-center" tone="plain">
      <div role="alert">
        <span
          aria-hidden
          className="mx-auto grid h-11 w-11 place-items-center rounded-full bg-error-container text-[18px] text-error"
        >
          !
        </span>
        <h2 className="mt-3 font-display text-[18px] leading-snug text-on-surface">
          This did not load
        </h2>
        <p className="mt-2 text-[13.5px] leading-[1.55] text-on-surface-variant">{message}</p>
      </div>
      <QuietButton onClick={onRetry} className="mt-5">
        Try again
      </QuietButton>
    </Card>
  );
}
