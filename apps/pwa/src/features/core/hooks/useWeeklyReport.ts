import { useCallback, useEffect, useRef, useState } from 'react';
import type { SummaryPeriod, WeeklyReportResponse } from '@anuva/shared';
import { apiFetch } from '../../../shared/lib/api';

type SummaryState = {
  data: WeeklyReportResponse | null;
  loading: boolean;
  error: string | null;
};

function cacheKey(period: SummaryPeriod, offset: number) {
  return `${period}:${offset}`;
}

/**
 * Summary for one (period, offset) window.
 *
 * Results are cached per window for the life of the component and the other two
 * periods are prefetched once the first load lands, so switching tabs resolves
 * from memory instead of flashing a skeleton on every tap.
 */
export function useSummary(period: SummaryPeriod, offset: number) {
  const cache = useRef(new Map<string, WeeklyReportResponse>());
  const [state, setState] = useState<SummaryState>({
    data: null,
    loading: true,
    error: null,
  });

  const fetchWindow = useCallback(async (p: SummaryPeriod, o: number) => {
    const key = cacheKey(p, o);
    const cached = cache.current.get(key);
    if (cached) return cached;

    const data = await apiFetch<WeeklyReportResponse>(`/api/report?period=${p}&offset=${o}`);
    cache.current.set(key, data);
    return data;
  }, []);

  const load = useCallback(async () => {
    const cached = cache.current.get(cacheKey(period, offset));
    if (cached) {
      setState({ data: cached, loading: false, error: null });
      return;
    }

    setState({ data: null, loading: true, error: null });
    try {
      const data = await fetchWindow(period, offset);
      setState({ data, loading: false, error: null });
    } catch {
      setState({ data: null, loading: false, error: 'Failed to load your summary' });
    }
  }, [fetchWindow, period, offset]);

  useEffect(() => {
    void load();
  }, [load]);

  const refresh = useCallback(() => {
    cache.current.delete(cacheKey(period, offset));
    void load();
  }, [load, period, offset]);

  // Warm the windows one tap away. Sequential and failure-tolerant — a
  // prefetch must never surface an error or block the visible request.
  const { data } = state;
  useEffect(() => {
    if (!data) return;
    let cancelled = false;

    const targets: [SummaryPeriod, number][] = [
      ['daily', 0],
      ['weekly', 0],
      ['monthly', 0],
    ];
    if (data.canGoBack) targets.push([period, offset + 1]);

    void (async () => {
      for (const [p, o] of targets) {
        if (cancelled) return;
        if (cache.current.has(cacheKey(p, o))) continue;
        try {
          await fetchWindow(p, o);
        } catch {
          // Ignore — the window will load normally if the user goes there.
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [data, fetchWindow, period, offset]);

  return { ...state, refresh };
}
