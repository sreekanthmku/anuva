import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { HomeCard, HomeCardEventBody, HomeCardResponse } from '@anuva/shared';
import { apiFetch } from '../../../shared/lib/api';

/// The ANU card on the dashboard. Server picks which observation to surface;
/// this hook only carries it and remembers a dismissal for the session.
export function useAnuHomeCard() {
  const navigate = useNavigate();
  const [card, setCard] = useState<HomeCard | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    let live = true;

    apiFetch<HomeCardResponse>('/api/home/anu-card')
      .then((data) => {
        if (live) setCard(data.card);
      })
      .catch(() => {
        // The card is coaching, not care data — a failure hides it rather than
        // putting an error on the first screen she sees.
      });

    return () => {
      live = false;
    };
  }, []);

  /// Fire-and-forget: the navigation has already happened, and a lost event
  /// costs a row in the tap-through numbers, nothing she can see.
  const report = useCallback((signalId: string, event: HomeCardEventBody['event']) => {
    void apiFetch('/api/home/anu-card/event', {
      method: 'POST',
      body: JSON.stringify({ signalId, event } satisfies HomeCardEventBody),
    }).catch(() => {});
  }, []);

  const dismiss = useCallback(() => {
    if (card) report(card.signalId, 'dismissed');
    setDismissed(true);
  }, [card, report]);

  /// A `chat` card hands its seed to the ANU thread, which sends it there — one
  /// answer path, one safety gate. A `route` card just navigates.
  const accept = useCallback(() => {
    if (!card) return;
    report(card.signalId, 'tapped');
    const { action } = card.primary;

    if (action.type === 'chat') {
      navigate(`/chat?ask=${encodeURIComponent(action.seed)}`);
      return;
    }

    navigate(action.path);
  }, [card, navigate, report]);

  return { card: dismissed ? null : card, accept, dismiss };
}
