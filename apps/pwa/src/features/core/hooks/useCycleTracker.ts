import { useCallback, useEffect, useState } from 'react';
import type { CycleStateResponse, PeriodFlow } from '@anuva/shared';
import { apiFetch } from '../../../shared/lib/api';

type CycleTrackerState = {
  data: CycleStateResponse | null;
  loading: boolean;
  error: string | null;
};

export function useCycleTracker() {
  const [state, setState] = useState<CycleTrackerState>({ data: null, loading: true, error: null });

  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const data = await apiFetch<CycleStateResponse>('/api/cycle');
      setState({ data, loading: false, error: null });
    } catch {
      setState({ data: null, loading: false, error: 'Failed to load cycle data' });
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const setup = useCallback(
    async (lastPeriodStart: string, cycleLength: number, periodLength: number) => {
      const data = await apiFetch<CycleStateResponse>('/api/cycle/setup', {
        method: 'POST',
        body: JSON.stringify({ lastPeriodStart, cycleLength, periodLength }),
      });
      setState({ data, loading: false, error: null });
      return data;
    },
    []
  );

  // The write routes return the recomputed cycle state, so the UI updates
  // without a second round trip.
  const logPeriod = useCallback(async (startDate: string) => {
    const data = await apiFetch<CycleStateResponse>('/api/cycle/period', {
      method: 'POST',
      body: JSON.stringify({ startDate }),
    });
    setState({ data, loading: false, error: null });
  }, []);

  /**
   * Correct her current period. Either date may move; the server rejects the pair
   * if the result would overlap the period before it or run impossibly long.
   */
  const updatePeriod = useCallback(
    async (id: string, dates: { startDate?: string; endDate?: string }) => {
      const data = await apiFetch<CycleStateResponse>(`/api/cycle/period/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(dates),
      });
      setState({ data, loading: false, error: null });
    },
    []
  );

  const endPeriod = useCallback(
    (id: string, endDate: string) => updatePeriod(id, { endDate }),
    [updatePeriod]
  );

  const deletePeriod = useCallback(async (id: string) => {
    const data = await apiFetch<CycleStateResponse>(`/api/cycle/period/${id}`, {
      method: 'DELETE',
    });
    setState({ data, loading: false, error: null });
  }, []);

  /** Undo a removal — what the confirmation's undo offers. */
  const restorePeriod = useCallback(async (id: string) => {
    const data = await apiFetch<CycleStateResponse>(`/api/cycle/period/${id}/restore`, {
      method: 'POST',
    });
    setState({ data, loading: false, error: null });
  }, []);

  /**
   * Flow for one bleeding day. `source` separates the home prompt from a
   * correction tapped on the calendar, which the admin log reads.
   */
  const logFlow = useCallback(
    async (date: string, flow: PeriodFlow, source: 'prompt' | 'calendar' = 'prompt') => {
      const data = await apiFetch<CycleStateResponse>('/api/cycle/flow', {
        method: 'POST',
        body: JSON.stringify({ date, flow, source }),
      });
      setState({ data, loading: false, error: null });
    },
    []
  );

  const updateSettings = useCallback(
    async (cycleLength: number, periodLength: number) => {
      await apiFetch('/api/cycle/settings', {
        method: 'PUT',
        body: JSON.stringify({ cycleLength, periodLength }),
      });
      await load();
    },
    [load]
  );

  return {
    ...state,
    refresh: load,
    setup,
    logPeriod,
    endPeriod,
    updatePeriod,
    deletePeriod,
    restorePeriod,
    logFlow,
    updateSettings,
  };
}
