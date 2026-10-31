import type { KeyboardEvent, ReactNode } from 'react';

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <article
      className={`rounded-[22px] border border-border-default bg-surface-raised shadow-[0_10px_28px_rgba(94,53,102,0.05)] ${className}`}
    >
      {children}
    </article>
  );
}

/** The three-up numbers a tab opens with. Tone tints the value, not the whole tile. */
export function StatTile({
  label,
  value,
  tone = 'neutral',
}: {
  label: string;
  value: number | string;
  tone?: 'neutral' | 'primary' | 'success';
}) {
  const valueTone =
    tone === 'primary' ? 'text-primary' : tone === 'success' ? 'text-success' : 'text-on-surface';

  return (
    <div className="rounded-[18px] border border-border-default bg-surface-raised px-3 py-3 text-center">
      <div className={`font-display text-[26px] leading-none ${valueTone}`}>{value}</div>
      <div className="mt-1.5 text-[10px] uppercase tracking-[0.12em] text-outline">{label}</div>
    </div>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: { id: T; label: string; count?: number }[];
  value: T;
  onChange: (next: T) => void;
  /** What the tabs choose between, for a screen reader ("Bookings"). */
  label?: string;
}) {
  // Arrow keys move between tabs, the way a screen reader says tabs work; only the selected one is
  // a Tab stop.
  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    let target: number;
    if (event.key === 'ArrowRight') target = (index + 1) % options.length;
    else if (event.key === 'ArrowLeft') target = (index - 1 + options.length) % options.length;
    else if (event.key === 'Home') target = 0;
    else if (event.key === 'End') target = options.length - 1;
    else return;
    event.preventDefault();
    onChange(options[target]!.id);
    const tabs = event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]');
    tabs?.[target]?.focus();
  };

  return (
    <div
      role="tablist"
      aria-label={label}
      className="flex gap-1 rounded-full border border-border-default bg-surface-container-low p-1"
    >
      {options.map((option, index) => {
        const active = option.id === value;
        return (
          <button
            key={option.id}
            type="button"
            role="tab"
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            onKeyDown={(event) => onKeyDown(event, index)}
            onClick={() => onChange(option.id)}
            className={`flex-1 rounded-full px-2 py-2 text-[12.5px] font-semibold transition-colors ${
              active ? 'bg-primary text-on-primary' : 'text-on-surface-variant'
            }`}
          >
            {option.label}
            {typeof option.count === 'number' && option.count > 0 ? (
              <span className={active ? 'opacity-80' : 'text-outline'}>
                <span aria-hidden="true"> ·</span> {option.count}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

export function Pill({
  children,
  tone = 'neutral',
}: {
  children: ReactNode;
  tone?: 'neutral' | 'success' | 'info' | 'error' | 'tertiary' | 'primary';
}) {
  const tones: Record<string, string> = {
    neutral: 'bg-surface-container-low text-on-surface-variant',
    success: 'bg-success/15 text-success',
    info: 'bg-info/15 text-info',
    error: 'bg-error/15 text-error',
    tertiary: 'bg-tertiary/15 text-tertiary',
    primary: 'bg-primary-fixed text-primary',
  };

  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

export function EmptyState({ title, body }: { title: string; body?: string }) {
  return (
    <div className="rounded-[22px] border border-dashed border-border-default bg-surface-container-low px-5 py-8 text-center">
      <div className="font-display text-[18px] text-on-surface">{title}</div>
      {body ? (
        <p className="mx-auto mt-1.5 max-w-[24rem] text-[13px] leading-[1.55] text-on-surface-variant">
          {body}
        </p>
      ) : null}
    </div>
  );
}

export function ErrorNote({ children }: { children: ReactNode }) {
  return (
    <div
      role="alert"
      className="rounded-[18px] border border-error/20 bg-error-container px-4 py-3 text-[13px] leading-[1.5] text-on-error-container"
    >
      {children}
    </div>
  );
}

/** Matches the card silhouette so a loading list does not change height when it resolves. */
export function SkeletonCard() {
  return (
    <div aria-hidden="true" className="h-[168px] animate-pulse rounded-[22px] border border-border-default bg-surface-raised" />
  );
}
