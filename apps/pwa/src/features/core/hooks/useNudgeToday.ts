import { useCallback, useEffect, useState } from 'react';
import type {
  NudgeSlot,
  NudgeRespondResponse,
  NudgeTodayResponse,
  SubmitNudgeResponseBody,
} from '@anuva/shared';
import { apiFetch } from '../../../shared/lib/api';
import i18n from '../../../i18n';

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
      setState({ data: null, loading: false, error: i18n.t('errors.loadCheckIn') });
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
