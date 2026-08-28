import { useCallback, useEffect, useState } from 'react';
import {
  readFamilyGiftFromHash,
  readFamilyMessageFromHash,
  stripFamilyMessageFromUrl,
  type FamilyGift,
  type FamilyMessage,
} from './familyMessageLink';

/**
 * Two ways the note arrives, and both end at the same place.
 *
 * Cold start: the service worker calls `openWindow` with the deep link, so the fragment is present
 * on first render. App already open: the worker posts `nudge-navigate` to the router, which
 * navigates in-app — no reload, so nothing re-reads `location.hash` on its own. Hence the
 * `hashchange` listener as well as the mount read.
 */
export function useFamilyMessage() {
  const [message, setMessage] = useState<FamilyMessage | null>(null);

  const consume = useCallback(() => {
    const next = readFamilyMessageFromHash(window.location.hash);
    if (!next) return;
    setMessage(next);
    // Strip immediately: read once, then gone. Leaving it in the URL would resurface the note on a
    // back navigation and put it in browser history.
    stripFamilyMessageFromUrl();
  }, []);

  useEffect(() => {
    consume();
    window.addEventListener('hashchange', consume);
    return () => window.removeEventListener('hashchange', consume);
  }, [consume]);

  return { message, dismiss: () => setMessage(null) };
}

/**
 * The gift half of the same delivery, on the same two arrival paths as a note (cold start via
 * `openWindow`, warm start via the router's `nudge-navigate` post). Kept as its own hook rather
 * than folded into `useFamilyMessage` because only one of the two can be in a given hash, and two
 * hooks reading the same fragment would race to strip it.
 */
export function useFamilyGift() {
  const [gift, setGift] = useState<FamilyGift | null>(null);

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
  }, [consume]);

  return { gift, dismiss: () => setGift(null) };
}
