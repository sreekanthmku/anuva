import { useCallback, useEffect, useState } from 'react';
import type {
  NudgeDayResponse,
  NudgeRespondResponse,
  SubmitNudgeResponseBody,
} from '@anuva/shared';
import { apiFetch } from '../../../shared/lib/api';

type NudgeDayState = {
  data: NudgeDayResponse | null;
  loading: boolean;
  error: string | null;
};

// Unified daily tracker sheet — includes answers already captured via nudges.
export function useNudgeDay() {
  const [state, setState] = useState<NudgeDayState>({ data: null, loading: true, error: null });

  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const data = await apiFetch<NudgeDayResponse>('/api/nudge/day');
      setState({ data, loading: false, error: null });
    } catch {
      setState({ data: null, loading: false, error: 'Failed to load your day' });
    }
  }, []);

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
