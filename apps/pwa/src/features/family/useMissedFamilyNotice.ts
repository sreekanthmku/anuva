import { useEffect, useState } from 'react';
import type { FamilyMissedResponse } from '@anuva/shared';
import { useAuth } from '../auth/auth-context';
import { pushReadiness, type PushReadiness } from '../../lib/notifications/pushReadiness';
import { fetchMissedFamily } from './api';

type MissedItem = FamilyMissedResponse['items'][number];

const SEEN_KEY = 'anuva.familyMissedSeen';
const LOOKBACK_MS = 7 * 24 * 60 * 60 * 1000;

function seenKey(userId: string): string {
  return `${SEEN_KEY}:${userId}`;
}

function readSeen(userId: string): Date {
  try {
    const raw = localStorage.getItem(seenKey(userId));
    const at = raw ? new Date(raw) : null;
    if (at && !Number.isNaN(at.getTime())) return at;
  } catch {
    /* ignore */
  }
  return new Date(Date.now() - LOOKBACK_MS);
}

function writeSeen(userId: string, at: Date): void {
  try {
    localStorage.setItem(seenKey(userId), at.toISOString());
  } catch {
    /* ignore */
  }
}

/**
 * Her family's notes and gifts arrive as notifications. On a phone that cannot show them, they never
 * reached her — so the next time she opens the app, this says what she missed and asks her to turn
 * notifications on. Checked once per app open; each item is told once.
 */
export function useMissedFamilyNotice() {
  const { user, status } = useAuth();
  const userId = status === 'authenticated' ? (user?.id ?? null) : null;
  const [items, setItems] = useState<MissedItem[]>([]);
  const [readiness, setReadiness] = useState<PushReadiness>(() => pushReadiness());
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (!userId) return;
    const now = new Date();
    const state = pushReadiness();
    setReadiness(state);
    // Notifications work here (or never can): nothing was missed for a reason she can fix.
    if (state === 'ready' || state === 'unsupported') {
      writeSeen(userId, now);
      return;
    }
    let cancelled = false;
    void fetchMissedFamily(readSeen(userId))
      .then(({ items: missed }) => {
        if (cancelled) return;
        writeSeen(userId, now);
        if (missed.length > 0) {
          setItems(missed);
          setShown(true);
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [userId]);

  return {
    open: items.length > 0,
    items,
    readiness,
    /** True once it has been shown this app open, so the regular popup does not follow it. */
    shown,
    close: () => setItems([]),
  };
}
