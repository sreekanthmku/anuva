import { useCallback, useEffect, useState } from 'react';
import type {
  SleepDisruption,
  SleepHoursBucket,
  SleepLogEntry,
  SleepStateResponse,
} from '@anuva/shared';
import { apiFetch } from '../../../shared/lib/api';

type SleepLogState = {
  data: SleepStateResponse | null;
  loading: boolean;
  error: string | null;
};

export function useSleepLog() {
  const [state, setState] = useState<SleepLogState>({ data: null, loading: true, error: null });

  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const data = await apiFetch<SleepStateResponse>('/api/sleep');
      setState({ data, loading: false, error: null });
    } catch {
      setState({ data: null, loading: false, error: 'Failed to load sleep data' });
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const logSleep = useCallback(
    async (quality: number, hours: SleepHoursBucket | null, disruptions: SleepDisruption[]) => {
      const entry = await apiFetch<SleepLogEntry>('/api/sleep', {
        method: 'POST',
        body: JSON.stringify({ quality, hours, disruptions }),
      });
      await load();
      return entry;
    },
    [load],
  );

  return {
    ...state,
    refresh: load,
    logSleep,
  };
}
