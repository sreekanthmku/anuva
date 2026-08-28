import { useState } from 'react';
import type { FamilyActivityResponse } from '@anuva/shared';
import { FamilyActivityDialog } from './FamilyActivityDialog';

/**
 * Her side of the support loop: that someone showed up.
 *
 * Renders nothing at all until her family has actually done something. A card reading "nobody has
 * checked in on you" would be worse than no card — this feature exists to make her feel supported,
 * not audited, and the absence of support is not news she needs delivered on her dashboard.
 *
 * The card is a button: one line is the right size for a dashboard, but the gestures behind it are
 * worth more than one line, so tapping opens them in full.
 */
export function FamilyCheckInCard({ activity }: { activity: FamilyActivityResponse | null }) {
  const [open, setOpen] = useState(false);

  if (!activity?.member || !activity.today) {
    return null;
  }

  const mulish = { fontFamily: '"Mulish", -apple-system, system-ui, sans-serif' };

  return (
    <section className="px-3 pt-3">
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        className="w-full rounded-[20px] border border-secondary/30 bg-secondary-fixed/50 px-[18px] py-4 text-left transition-transform active:scale-[0.99]"
      >
        <div className="flex items-start gap-3">
          <span
            aria-hidden
            className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-secondary/20 text-[15px] text-secondary"
          >
            ♥
          </span>
          <div className="min-w-0 flex-1">
            <h2
              className="text-[16px] leading-snug text-on-surface"
              style={{ fontFamily: '"Fraunces", serif', fontWeight: 500 }}
            >
              {activity.today.headline}
            </h2>
            <p
              className="mt-1 text-[13px] leading-[1.55] text-on-surface-variant"
              style={mulish}
            >
              {activity.today.body}
            </p>
            {activity.weekLine ? (
              <p className="mt-1.5 text-[11.5px] text-outline" style={mulish}>
                {activity.weekLine}
              </p>
            ) : null}
            {/* Says what a tap does, since the card has no other affordance. */}
            <p className="mt-2 text-[11.5px] font-semibold text-secondary" style={mulish}>
              See what they did →
            </p>
          </div>
        </div>
      </button>

      <FamilyActivityDialog activity={activity} open={open} onClose={() => setOpen(false)} />
    </section>
  );
}
