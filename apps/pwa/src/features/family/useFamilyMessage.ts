import { useCallback, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { subscribeToForegroundMessages } from '../../lib/firebase';
import {
  readFamilyGiftFromHash,
  readFamilyMessageFromHash,
  stripFamilyMessageFromUrl,
  type FamilyGift,
  type FamilyMessage,
} from './familyMessageLink';

/**
 * Three ways the note arrives, and all three end at the same place.
 *
 * 1. Cold start — the service worker calls `openWindow` with the deep link, so the fragment is
 *    present on first render. The mount read catches it.
 * 2. App open in the background — the worker posts `nudge-navigate` and the router calls
 *    `navigate('/home#familyMessage=…')`. That is a `pushState`, and **pushState does not fire
 *    `hashchange`**, which is why a `hashchange` listener alone silently dropped the note for
 *    anyone who already had the app open. Hence the dependency on react-router's own location.
 * 3. App open in the *foreground* — FCM hands the payload to `onMessage` and displays nothing at
 *    all, by design: a system notification would be redundant when she is looking at the screen.
 *    Without the subscription below, the note never appeared anywhere. Now it opens the card
 *    directly, which is better than a notification would have been.
 *
 * Nothing is persisted on any of the three paths: once read and dismissed, the note is gone.
 */

/** The `data` block FCM delivers for a family push. Everything is a string over the wire. */
type FamilyPushData = {
  familyMessage?: string;
  familyGift?: string;
  familyFrom?: string;
};

function foregroundData(payload: unknown): FamilyPushData | null {
  const data = (payload as { data?: unknown } | null)?.data;
  return data && typeof data === 'object' ? (data as FamilyPushData) : null;
}

export function useFamilyMessage() {
  const [message, setMessage] = useState<FamilyMessage | null>(null);
  const { key: locationKey } = useLocation();

  const consume = useCallback(() => {
    const next = readFamilyMessageFromHash(window.location.hash);
    if (!next) return;
    setMessage(next);
    // Strip immediately: read once, then gone. Leaving it in the URL would resurface the note on a
    // back navigation and put it in browser history.
    stripFamilyMessageFromUrl();
  }, []);

  // `locationKey` changes on every in-app navigation, including the one the notification click
  // triggers. `hashchange` stays for a plain fragment edit, which react-router does not see.
  useEffect(() => {
    consume();
    window.addEventListener('hashchange', consume);
    return () => window.removeEventListener('hashchange', consume);
  }, [consume, locationKey]);

  useEffect(
    () =>
      subscribeToForegroundMessages((payload) => {
        const data = foregroundData(payload);
        if (!data?.familyMessage) return;
        setMessage({ text: data.familyMessage, from: data.familyFrom?.trim() || 'Your family' });
      }),
    [],
  );

  return { message, dismiss: () => setMessage(null) };
}

/**
 * The gift half of the same delivery, on the same three arrival paths as a note. Kept as its own
 * hook rather than folded into `useFamilyMessage` because only one of the two can be in a given
 * hash, and two hooks reading the same fragment would race to strip it.
 */
export function useFamilyGift() {
  const [gift, setGift] = useState<FamilyGift | null>(null);
  const { key: locationKey } = useLocation();

  const consume = useCallback(() => {
    const next = readFamilyGiftFromHash(window.location.hash);
    if (!next) return;
    setGift(next);
    stripFamilyMessageFromUrl();
  }, []);

  useEffect(() => {
    consume();
    window.addEventListener('hashchange', consume);
    return () => window.removeEventListener('hashchange', consume);
  }, [consume, locationKey]);

  useEffect(
    () =>
      subscribeToForegroundMessages((payload) => {
        const data = foregroundData(payload);
        // Guarded through the same reader as the fragment path, so an unknown kind from a newer
        // sender is dropped in one place rather than two.
        if (!data?.familyGift) return;
        const parsed = readFamilyGiftFromHash(
          `#familyGift=${encodeURIComponent(data.familyGift)}&familyFrom=${encodeURIComponent(
            data.familyFrom ?? '',
          )}`,
        );
        if (parsed) setGift(parsed);
      }),
    [],
  );

  return { gift, dismiss: () => setGift(null) };
}
