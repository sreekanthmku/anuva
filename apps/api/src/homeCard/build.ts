// ANU home card — assembly.
//
// Reads her logs (context.ts), asks the rule table what fires (signals.ts),
// and holds the pick steady for the day (store.ts).
//
// Why the day's pick is sticky: without it, every dashboard mount re-ran the
// cooldown check against the card it had just recorded, so the card she was
// reading suppressed itself and the next mount showed a different one. The card
// is re-rendered from fresh context each time, so its numbers stay current —
// it is the *choice* that is held, not the sentence.

import type { HomeCard } from '@anuva/shared';
import { loadHomeCardContext } from './context.js';
import { BASELINE_THRESHOLDS, candidatesFor, type HomeCardCandidate } from './signals.js';
import type { HomeCardStore } from './store.js';

export type HomeCardUser = { id: string; name: string | null };

export function selectCandidate(
  candidates: HomeCardCandidate[],
  lastShown: Map<string, Date>,
  now: Date,
): HomeCardCandidate | null {
  for (const candidate of candidates) {
    if (candidate.cooldownHours === 0) return candidate;

    const shownAt = lastShown.get(candidate.signalId);
    if (!shownAt) return candidate;

    const elapsedHours = (now.getTime() - shownAt.getTime()) / 3_600_000;
    if (elapsedHours >= candidate.cooldownHours) return candidate;
  }

  return null;
}

function toCard(candidate: HomeCardCandidate): HomeCard {
  return {
    signalId: candidate.signalId,
    text: candidate.text,
    sinceAt: candidate.sinceAt?.toISOString() ?? null,
    primary: candidate.primary,
  };
}

export async function buildHomeCard(
  user: HomeCardUser,
  now: Date,
  store: HomeCardStore,
): Promise<HomeCard | null> {
  const active = await store.activeToday(user.id, now);
  // "Later" means later, not in ten seconds. The card stays gone for the day.
  if (active?.dismissed) return null;

  const ctx = await loadHomeCardContext(user, now, BASELINE_THRESHOLDS);
  const candidates = candidatesFor(ctx);
  if (candidates.length === 0) return null;

  // Still firing? Keep showing it, with today's numbers.
  const held = active ? candidates.find((c) => c.signalId === active.signalId) : undefined;
  if (held) {
    await store.recordShown(user.id, held.signalId, now);
    return toCard(held);
  }

  const shown = await store.lastShown(
    user.id,
    candidates.map((c) => c.signalId),
  );
  const picked = selectCandidate(candidates, shown, now);
  if (!picked) return null;

  await store.recordShown(user.id, picked.signalId, now);
  return toCard(picked);
}
