import { useMemo } from 'react';
import { twemojiUrl } from '../../shared/lib/twemoji';
import type { FamilyGift, FamilyGiftKind } from './familyMessageLink';

/**
 * A gift from her family, opened.
 *
 * This is the one screen in the app that is allowed to be purely lovely — no metric, no next step,
 * nothing to log. Someone thought about her and this is what that looks like when it lands. It gets
 * an entrance because a gift that just appears is a notification; a gift that unwraps is a gift.
 *
 * Like a note, nothing here is stored — the gift lives in the URL fragment, is read once, and is
 * gone when she closes it. The `FamilySupportAction` row on the server records *that* it was sent,
 * never this card.
 */

const GIFT: Record<
  FamilyGiftKind,
  {
    emoji: string;
    /** Small pieces drifting behind the gift. Two or three, no more — this is a breeze, not confetti. */
    fall: string[];
    eyebrow: (from: string) => string;
    headline: string;
    body: (from: string) => string;
    /** Warm wash behind the emoji. Kept in the brand's plum/rose/gold family. */
    glow: string;
  }
> = {
  flowers: {
    emoji: '💐',
    fall: ['🌸', '🌷', '🌼'],
    eyebrow: (from) => `${from} sent you flowers`,
    headline: 'A little bouquet, just for you.',
    body: (from) =>
      `No occasion, nothing to answer. ${from} was thinking of you today and wanted you to know you are not carrying this on your own.`,
    glow: 'radial-gradient(circle at 50% 42%, rgba(201,126,146,0.30), rgba(201,126,146,0) 68%)',
  },
  chocolates: {
    emoji: '🍫',
    fall: ['🍫', '✨', '🤍'],
    eyebrow: (from) => `${from} sent you chocolates`,
    headline: 'Something sweet, for today.',
    body: (from) =>
      `Some days ask a lot of you. ${from} wanted this one to have at least one small good thing in it.`,
    glow: 'radial-gradient(circle at 50% 42%, rgba(184,146,60,0.28), rgba(184,146,60,0) 68%)',
  },
};

/** Fixed drift positions rather than random ones, so the animation is the same every time. */
const FALL_LANES = [
  { left: '12%', delay: '0s', duration: '7.5s', size: 20, opacity: 0.5 },
  { left: '32%', delay: '1.9s', duration: '9s', size: 14, opacity: 0.38 },
  { left: '58%', delay: '0.9s', duration: '8.2s', size: 17, opacity: 0.45 },
  { left: '78%', delay: '2.8s', duration: '9.6s', size: 13, opacity: 0.34 },
  { left: '88%', delay: '4.1s', duration: '7.8s', size: 18, opacity: 0.3 },
];

export function FamilyGiftDialog({
  gift,
  onDismiss,
}: {
  gift: FamilyGift | null;
  onDismiss: () => void;
}) {
  // Hooks before the early return: the dialog mounts and unmounts as the gift arrives.
  const lanes = useMemo(
    () =>
      gift
        ? FALL_LANES.map((lane, index) => ({
            ...lane,
            emoji: GIFT[gift.kind].fall[index % GIFT[gift.kind].fall.length]!,
          }))
        : [],
    [gift],
  );

  if (!gift) return null;

  const copy = GIFT[gift.kind];
  const mulish = { fontFamily: '"Mulish", -apple-system, system-ui, sans-serif' };

  return (
    <div
      className="fixed inset-0 z-[85] flex items-center justify-center px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="family-gift-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-[#3E2542]/70 backdrop-blur-[3px] animate-[giftFade_320ms_ease-out]"
        aria-label="Close"
        onClick={onDismiss}
      />

      {/* Behind the card, across the whole screen — it should feel like the room changed, not like
          a box appeared. Pointer-events off so it never eats the dismiss tap. */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        {lanes.map((lane, index) => (
          <img
            key={index}
            src={twemojiUrl(lane.emoji)}
            alt=""
            width={lane.size}
            height={lane.size}
            className="absolute -top-8"
            style={{
              left: lane.left,
              opacity: lane.opacity,
              animation: `giftFall ${lane.duration} linear ${lane.delay} infinite`,
            }}
          />
        ))}
      </div>

      <div
        className="relative w-full max-w-[350px] overflow-hidden rounded-[28px] border border-secondary/25 bg-surface-raised px-6 pb-7 pt-8 text-center shadow-[0_24px_64px_rgba(94,53,102,0.32)] animate-[giftIn_460ms_cubic-bezier(0.16,1,0.3,1)]"
      >
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-[190px]"
          style={{ background: copy.glow }}
          aria-hidden
        />

        <div className="relative">
          <img
            src={twemojiUrl(copy.emoji)}
            alt=""
            aria-hidden
            width={92}
            height={92}
            className="mx-auto animate-[giftPop_680ms_cubic-bezier(0.16,1,0.3,1)]"
            style={{ filter: 'drop-shadow(0 10px 18px rgba(94,53,102,0.22))' }}
          />

          <p
            id="family-gift-title"
            className="mt-4 text-[11px] font-semibold uppercase tracking-[0.16em] text-tertiary"
            style={mulish}
          >
            {copy.eyebrow(gift.from)}
          </p>

          <h2
            className="mt-2.5 text-[23px] leading-[1.25] text-on-surface"
            style={{ fontFamily: '"Fraunces", serif', fontWeight: 400 }}
          >
            {copy.headline}
          </h2>

          <p
            className="mt-3 text-[14px] leading-[1.6] text-on-surface-variant"
            style={mulish}
          >
            {copy.body(gift.from)}
          </p>

          {/* Gold hairline — the same divider the rest of the app uses to mark a warm aside. */}
          <span className="mx-auto mt-5 block h-px w-12 bg-tertiary/50" aria-hidden />

          <button
            type="button"
            onClick={onDismiss}
            className="mt-5 min-h-[48px] w-full rounded-full bg-secondary px-5 text-[14.5px] font-semibold text-on-secondary shadow-[0_10px_24px_rgba(201,126,146,0.32)]"
            style={mulish}
          >
            Thank you 💛
          </button>
        </div>
      </div>

      <style>{`
        @keyframes giftFade {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes giftIn {
          from { transform: translateY(26px) scale(0.94); opacity: 0; }
          to { transform: translateY(0) scale(1); opacity: 1; }
        }
        @keyframes giftPop {
          0%   { transform: scale(0.35) rotate(-14deg); opacity: 0; }
          58%  { transform: scale(1.12) rotate(4deg); opacity: 1; }
          100% { transform: scale(1) rotate(0deg); opacity: 1; }
        }
        @keyframes giftFall {
          0%   { transform: translateY(-10vh) rotate(0deg); }
          100% { transform: translateY(112vh) rotate(220deg); }
        }
        /* She may have asked the OS for less movement. Honour it: the card still appears, the
           petals simply stop drifting. */
        @media (prefers-reduced-motion: reduce) {
          [class*="animate-[gift"] { animation: none !important; }
          img[style*="giftFall"] { display: none !important; }
        }
      `}</style>
    </div>
  );
}
