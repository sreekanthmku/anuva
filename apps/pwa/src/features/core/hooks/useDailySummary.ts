import { useCallback, useEffect, useState } from 'react';
import type { WeeklyReportResponse } from '@anuva/shared';
import { apiFetch } from '../../../shared/lib/api';

type State = {
  data: WeeklyReportResponse | null;
  loading: boolean;
  error: string | null;
};

/**
 * Today's summary window, for the home page's wellness card.
 *
 * Home shows the same headline card as the top of the summary page, so it
 * reads the same window the summary page opens on: `daily`, offset 0.
 *
 * Deliberately not `useSummary` — that hook warms the weekly and monthly
 * windows too, into a cache local to its own component, which would cost home
 * two requests whose results nothing can read. This one fetches the window it
 * renders and nothing else.
 *
 * `enabled` is false while the user is still calibrating: the card shows the
 * countdown ring then, and the response would be thrown away.
 */
export function useDailySummary(enabled: boolean) {
  const [state, setState] = useState<State>({
    data: null,
    loading: enabled,
    error: null,
  });

  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    if (!enabled) {
      setState({ data: null, loading: false, error: null });
      return;
    }

    let live = true;
    setState((prev) => ({ ...prev, loading: true, error: null }));

    apiFetch<WeeklyReportResponse>('/api/report?period=daily&offset=0')
      .then((data) => {
        if (live) setState({ data, loading: false, error: null });
      })
      .catch(() => {
        if (live) setState({ data: null, loading: false, error: "Couldn't load today's wellness" });
      });

    return () => {
      live = false;
    };
  }, [enabled, reloadToken]);

  const refresh = useCallback(() => setReloadToken((t) => t + 1), []);

  return { ...state, refresh };
}
