import { useCallback, useEffect, useState } from 'react';
import type {
  NudgeSlot,
  NudgeRespondResponse,
  NudgeTodayResponse,
  SubmitNudgeResponseBody,
} from '@anuva/shared';
import { apiFetch } from '../../../shared/lib/api';

type NudgeTodayState = {
  data: NudgeTodayResponse | null;
  loading: boolean;
  error: string | null;
};

export function useNudgeToday(slot?: NudgeSlot) {
  const [state, setState] = useState<NudgeTodayState>({ data: null, loading: true, error: null });

  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const query = slot ? `?slot=${encodeURIComponent(slot)}` : '';
      const data = await apiFetch<NudgeTodayResponse>(`/api/nudge/today${query}`);
      setState({ data, loading: false, error: null });
    } catch {
      setState({ data: null, loading: false, error: 'Failed to load your check-in' });
    }
  }, [slot]);

  useEffect(() => {
    load();
  }, [load]);

  const respond = useCallback(async (body: SubmitNudgeResponseBody) => {
    return apiFetch<NudgeRespondResponse>('/api/nudge/respond', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }, []);

  return { ...state, reload: load, respond };
}
