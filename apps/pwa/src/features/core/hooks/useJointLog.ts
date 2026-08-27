import { useCallback, useEffect, useState } from 'react';
import type { JointLogEntry, JointStateResponse, LogJointBody } from '@anuva/shared';
import { apiFetch } from '../../../shared/lib/api';

type JointLogState = {
  data: JointStateResponse | null;
  loading: boolean;
  error: string | null;
};

/**
 * Joints & Stiffness. Its own hook rather than a nudge answer: there is no nudge
 * behind this tracker, so `useNudgeDay` never sees it.
 */
export function useJointLog() {
  const [state, setState] = useState<JointLogState>({ data: null, loading: true, error: null });

  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const data = await apiFetch<JointStateResponse>('/api/joints');
      setState({ data, loading: false, error: null });
    } catch {
      setState({ data: null, loading: false, error: 'Failed to load joint data' });
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const logJoints = useCallback(
    async (body: LogJointBody) => {
      const entry = await apiFetch<JointLogEntry>('/api/joints', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      await load();
      return entry;
    },
    [load],
  );

  return { ...state, refresh: load, logJoints };
}
