import { useCallback, useEffect, useState } from 'react';
import type {
  NudgeDayResponse,
  NudgeRespondResponse,
  SubmitNudgeResponseBody,
} from '@anuva/shared';
import { apiFetch } from '../../../shared/lib/api';
import i18n from '../../../i18n';
import { loggedAtFor, type TrackingDay } from './trackingDay';

type NudgeDayState = {
  data: NudgeDayResponse | null;
  loading: boolean;
  error: string | null;
};

// Unified daily tracker sheet — includes answers already captured via nudges. `day` is today unless
// she is filling in yesterday; answers given then are stamped inside yesterday.
export function useNudgeDay(day: TrackingDay = 'today') {
  const [state, setState] = useState<NudgeDayState>({ data: null, loading: true, error: null });

  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const data = await apiFetch<NudgeDayResponse>(
        day === 'yesterday' ? '/api/nudge/day?day=yesterday' : '/api/nudge/day'
      );
      setState({ data, loading: false, error: null });
    } catch {
      setState({ data: null, loading: false, error: i18n.t('errors.loadDay') });
    }
  }, [day]);

  useEffect(() => {
    load();
  }, [load]);

  const respond = useCallback(
    async (body: SubmitNudgeResponseBody) => {
      return apiFetch<NudgeRespondResponse>('/api/nudge/respond', {
        method: 'POST',
        body: JSON.stringify({ ...body, ...loggedAtFor(day) }),
      });
    },
    [day]
  );

  return { ...state, reload: load, respond };
}
