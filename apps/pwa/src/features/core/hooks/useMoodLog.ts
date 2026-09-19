import { useCallback, useEffect, useState } from 'react';
import type { MoodEmotion, MoodLogEntry, MoodStateResponse } from '@anuva/shared';
import { apiFetch } from '../../../shared/lib/api';
import i18n from '../../../i18n';

type MoodLogState = {
  data: MoodStateResponse | null;
  loading: boolean;
  error: string | null;
};

export function useMoodLog() {
  const [state, setState] = useState<MoodLogState>({ data: null, loading: true, error: null });

  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const data = await apiFetch<MoodStateResponse>('/api/mood');
      setState({ data, loading: false, error: null });
    } catch {
      setState({ data: null, loading: false, error: i18n.t('errors.loadMood') });
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const logMood = useCallback(
    async (feeling: number, emotions: MoodEmotion[]) => {
      const entry = await apiFetch<MoodLogEntry>('/api/mood', {
        method: 'POST',
        body: JSON.stringify({ feeling, emotions }),
      });
      await load();
      return entry;
    },
    [load]
  );

  return {
    ...state,
    refresh: load,
    logMood,
  };
}
