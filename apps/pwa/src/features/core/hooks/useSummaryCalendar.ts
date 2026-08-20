import { useCallback, useEffect, useRef, useState } from 'react';
import type { SummaryCalendarResponse } from '@anuva/shared';
import { apiFetch } from '../../../shared/lib/api';

type CalendarState = {
  data: SummaryCalendarResponse | null;
  loading: boolean;
  error: string | null;
};

/**
 * Month grid for the summary's date picker.
 *
 * Fetched per month and cached for the life of the sheet, so paging back and
 * forth through months does not re-hit the API. `month` is `YYYY-MM`; pass null
 * while the sheet is closed and nothing is requested.
 */
export function useSummaryCalendar(month: string | null) {
  const cache = useRef(new Map<string, SummaryCalendarResponse>());
  const [state, setState] = useState<CalendarState>({ data: null, loading: false, error: null });

  const load = useCallback(async (target: string) => {
    const cached = cache.current.get(target);
    if (cached) {
      setState({ data: cached, loading: false, error: null });
      return;
    }

    // Keep the previous month on screen while the next one loads, so paging
    // months does not blank the grid out.
    setState((s) => ({ data: s.data, loading: true, error: null }));
    try {
      const data = await apiFetch<SummaryCalendarResponse>(`/api/summary/calendar?month=${target}`);
      cache.current.set(target, data);
      setState({ data, loading: false, error: null });
    } catch {
      setState({ data: null, loading: false, error: 'Could not load your calendar' });
    }
  }, []);

  useEffect(() => {
    if (!month) return;
    void load(month);
  }, [load, month]);

  return state;
}
