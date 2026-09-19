import { useCallback, useEffect, useState } from 'react';
import type { DetailedAnswer, DetailedAssessmentStateResponse } from '@anuva/shared';
import { apiFetch } from '../../../shared/lib/api';
import i18n from '../../../i18n';

type DetailedAssessmentState = {
  data: DetailedAssessmentStateResponse | null;
  loading: boolean;
  error: string | null;
};

export function useDetailedAssessment() {
  const [state, setState] = useState<DetailedAssessmentState>({
    data: null,
    loading: true,
    error: null,
  });

  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const data = await apiFetch<DetailedAssessmentStateResponse>('/api/detailed-assessment');
      setState({ data, loading: false, error: null });
    } catch {
      setState({ data: null, loading: false, error: i18n.t('errors.loadAssessment') });
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const saveDraft = useCallback(async (answers: DetailedAnswer[]) => {
    const data = await apiFetch<DetailedAssessmentStateResponse>('/api/detailed-assessment', {
      method: 'PUT',
      body: JSON.stringify({ answers }),
    });
    setState({ data, loading: false, error: null });
    return data;
  }, []);

  const submit = useCallback(async (answers: DetailedAnswer[]) => {
    const data = await apiFetch<DetailedAssessmentStateResponse>(
      '/api/detailed-assessment/submit',
      {
        method: 'POST',
        body: JSON.stringify({ answers }),
      }
    );
    setState({ data, loading: false, error: null });
    return data;
  }, []);

  return {
    ...state,
    refresh: load,
    saveDraft,
    submit,
  };
}
