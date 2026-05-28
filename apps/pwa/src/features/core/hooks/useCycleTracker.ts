import { useCallback, useEffect, useState } from 'react';
import type { CycleStateResponse } from '@anuva/shared';
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
    [],
  );

  const logPeriod = useCallback(async (startDate: string) => {
    await apiFetch('/api/cycle/period', {
      method: 'POST',
      body: JSON.stringify({ startDate }),
    });
    await load();
  }, [load]);

  const endPeriod = useCallback(async (id: string, endDate: string) => {
    await apiFetch(`/api/cycle/period/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ endDate }),
    });
    await load();
  }, [load]);

  const updateSettings = useCallback(async (cycleLength: number, periodLength: number) => {
    await apiFetch('/api/cycle/settings', {
      method: 'PUT',
      body: JSON.stringify({ cycleLength, periodLength }),
    });
    await load();
  }, [load]);

  return {
    ...state,
    refresh: load,
    setup,
    logPeriod,
    endPeriod,
    updateSettings,
  };
}
