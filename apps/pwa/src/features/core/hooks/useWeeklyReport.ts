import { useCallback, useEffect, useState } from 'react';
import type { WeeklyReportResponse } from '@anuva/shared';
import { apiFetch } from '../../../shared/lib/api';

type WeeklyReportState = {
  data: WeeklyReportResponse | null;
  loading: boolean;
  error: string | null;
};

/** @param week 1-based week since trial start. Omit for the current week. */
export function useWeeklyReport(week?: number) {
  const [state, setState] = useState<WeeklyReportState>({
    data: null,
    loading: true,
    error: null,
  });

  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const query = week ? `?week=${week}` : '';
      const data = await apiFetch<WeeklyReportResponse>(`/api/report${query}`);
      setState({ data, loading: false, error: null });
    } catch {
      setState({ data: null, loading: false, error: 'Failed to load your weekly report' });
    }
  }, [week]);

  useEffect(() => {
    load();
  }, [load]);

  return { ...state, refresh: load };
}
