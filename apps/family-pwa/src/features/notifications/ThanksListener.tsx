import { useEffect, useState } from 'react';
import { subscribeToForegroundMessages } from '../../lib/firebase';
import { twemojiUrl } from '../../shared/lib/twemoji';

/**
 * She said thank you while they had the app open.
 *
 * FCM shows nothing for a foreground push — the assumption is that an app on screen can say it
 * better itself. Without this, the one notification this app exists to receive would arrive as
 * silence for anyone who happened to be looking at it. So it lands as a card instead, which is
 * warmer than a lock-screen line anyway.
 */

const VISIBLE_MS = 5200;

type Thanks = { from: string; body: string };

export function ThanksListener() {
  const [thanks, setThanks] = useState<Thanks | null>(null);

  useEffect(
    () =>
      subscribeToForegroundMessages((payload) => {
        const message = payload as {
          data?: { familyThanks?: string; familyThanksFrom?: string };
          notification?: { body?: string };
        } | null;

        if (!message?.data?.familyThanks) return;

        setThanks({
          from: message.data.familyThanksFrom?.trim() || 'She',
          body: message.notification?.body ?? 'She saw what you did today, and it landed.',
        });
      }),
    [],
  );

  useEffect(() => {
    if (!thanks) return;
    const timer = window.setTimeout(() => setThanks(null), VISIBLE_MS);
    return () => window.clearTimeout(timer);
  }, [thanks]);

  if (!thanks) return null;

  return (
    <div
      role="status"
      className="pointer-events-none fixed inset-x-0 top-0 z-[75] flex justify-center px-5 pt-[max(0.75rem,env(safe-area-inset-top))]"
    >
      <div className="flex w-full max-w-[420px] animate-[anuvaRise_360ms_cubic-bezier(0.16,1,0.3,1)] items-center gap-3 rounded-[22px] border border-secondary/25 bg-surface-raised px-4 py-3.5 shadow-lift">
        <img src={twemojiUrl('😊')} alt="" aria-hidden width={34} height={34} className="shrink-0" />
        <div className="min-w-0">
          <p className="font-display text-[15px] font-medium leading-snug text-primary">
            {thanks.from} says thank you
          </p>
          <p className="mt-0.5 text-[12.5px] leading-snug text-on-surface-variant">{thanks.body}</p>
        </div>
      </div>
    </div>
  );
}
