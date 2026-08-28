import { useEffect } from 'react';
import type { FamilyActivityResponse, FamilySupportActionKind } from '@anuva/shared';
import { twemojiUrl } from '../../shared/lib/twemoji';

/**
 * The check-in card, opened.
 *
 * The card on the dashboard is one line because that is all a dashboard should give a gesture. This
 * is where the rest of it lives: each thing they did today as its own row, and how much of the week
 * they showed up for.
 *
 * Same restraint as the card itself — no clock times (a gesture, not a log), no failure state, and
 * nothing about what they did *not* do. If they did one thing, one row is the whole truth.
 */

const KIND_EMOJI: Record<FamilySupportActionKind, string> = {
  message: '💌',
  call: '📞',
  flowers: '💐',
  chocolates: '🍫',
};

const RELATIONSHIP_LABELS: Record<string, string> = {
  partner: 'Partner',
  child: 'Son / daughter',
  parent: 'Parent',
  sibling: 'Sibling',
  friend: 'Friend',
  other: 'Family',
};

const mulish = { fontFamily: '"Mulish", -apple-system, system-ui, sans-serif' };

export function FamilyActivityDialog({
  activity,
  open,
  onClose,
}: {
  activity: FamilyActivityResponse | null;
  open: boolean;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open || !activity?.member || !activity.today) return null;

  const { member, today, weekLine } = activity;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="family-activity-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-[#3E2542]/60 backdrop-blur-[2px]"
        aria-label="Close"
        onClick={onClose}
      />

      <div className="relative w-full max-w-[400px] rounded-t-[28px] border border-secondary/25 bg-surface-raised px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4 shadow-[0_-16px_44px_rgba(94,53,102,0.22)] animate-[familyActivityUp_300ms_ease-out] sm:rounded-[28px] sm:pb-6">
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-outline-variant sm:hidden" aria-hidden />

        <p
          className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-tertiary"
          style={mulish}
        >
          Today
        </p>
        <h2
          id="family-activity-title"
          className="mt-1 text-[21px] leading-tight text-on-surface"
          style={{ fontFamily: '"Fraunces", serif', fontWeight: 500 }}
        >
          {today.headline}
        </h2>
        <p className="mt-1 text-[12px] text-outline" style={mulish}>
          {member.name} · {RELATIONSHIP_LABELS[member.relationship] ?? 'Family'}
        </p>

        <ul className="mt-4 space-y-2">
          {today.items.map((item, index) => (
            <li
              key={`${item.kind}-${index}`}
              className="flex items-center gap-3 rounded-[18px] border border-border-default bg-surface-container-low px-3.5 py-3"
            >
              <img
                src={twemojiUrl(KIND_EMOJI[item.kind])}
                alt=""
                aria-hidden
                width={26}
                height={26}
                className="shrink-0"
              />
              <span className="text-[14px] leading-snug text-on-surface" style={mulish}>
                {item.label}
              </span>
            </li>
          ))}
        </ul>

        {weekLine ? (
          <p
            className="mt-4 rounded-[16px] bg-secondary-fixed/50 px-3.5 py-3 text-[13px] leading-[1.5] text-on-surface-variant"
            style={mulish}
          >
            {weekLine}
          </p>
        ) : null}

        <button
          type="button"
          onClick={onClose}
          className="mt-4 min-h-[48px] w-full rounded-full bg-secondary px-5 text-[14.5px] font-semibold text-on-secondary"
          style={mulish}
        >
          Close
        </button>
      </div>

      <style>{`
        @keyframes familyActivityUp {
          from { transform: translateY(18px); opacity: 0.85; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
