import { useCallback, useEffect, useState } from 'react';
import type { LogQuickSymptomResponse, QuickLogStateResponse, QuickSymptom } from '@anuva/shared';
import { apiFetch } from '../../../shared/lib/api';
import i18n from '../../../i18n';

type QuickLogState = {
  data: QuickLogStateResponse | null;
  loading: boolean;
  error: string | null;
};

export function useQuickLog() {
  const [state, setState] = useState<QuickLogState>({ data: null, loading: true, error: null });

  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const data = await apiFetch<QuickLogStateResponse>('/api/quick-log');
      setState({ data, loading: false, error: null });
    } catch {
      setState({ data: null, loading: false, error: i18n.t('errors.loadQuickLog') });
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const logSymptom = useCallback(
    async (symptom: QuickSymptom) => {
      const result = await apiFetch<LogQuickSymptomResponse>('/api/quick-log', {
        method: 'POST',
        body: JSON.stringify({ symptom }),
      });
      await load();
      return result;
    },
    [load]
  );

  return {
    ...state,
    refresh: load,
    logSymptom,
  };
}
