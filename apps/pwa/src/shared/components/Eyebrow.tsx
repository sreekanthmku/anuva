import type { ReactNode } from 'react';

type EyebrowTone = 'plum' | 'gold' | 'cream' | 'muted' | 'ember';

const TONE_COLOR: Record<EyebrowTone, string> = {
  plum: '#5E3566',
  gold: '#8F6B1E',
  cream: '#F0DFCF',
  muted: '#6E5A78',
  ember: '#C0405A',
};

/**
 * Anuva section eyebrow — Mulish small-caps with a short accent rule.
 * Design-system primitive shared across pages. Tone: plum (default),
 * gold (premium/insight), cream (on plum blocks).
 */
export function Eyebrow({
  children,
  tone = 'plum',
  className = '',
}: {
  children: ReactNode;
  tone?: EyebrowTone;
  className?: string;
}) {
  const color = TONE_COLOR[tone];
  return (
    <div className={`mb-2 flex items-center gap-2 ${className}`}>
      <span className="h-px w-4" style={{ background: color, opacity: 0.5 }} />
      <span
        className="text-[11px] font-semibold uppercase tracking-[0.13em]"
        style={{ color, fontFamily: '"Mulish", sans-serif' }}
      >
        {children}
      </span>
    </div>
  );
}
