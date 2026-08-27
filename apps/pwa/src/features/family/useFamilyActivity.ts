import { useCallback, useEffect, useState } from 'react';
import type { FamilyActivityResponse } from '@anuva/shared';
import { fetchFamilyActivity } from './api';

/**
 * Separate from `useFamilyGate` on purpose. The gate stops polling for good once someone joins —
 * which is exactly the moment this becomes relevant — so sharing that hook's data would leave her
 * looking at a snapshot taken before her family had done anything.
 */
export function useFamilyActivity(enabled: boolean) {
  const [data, setData] = useState<FamilyActivityResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    try {
      setData(await fetchFamilyActivity());
    } catch {
      // Silent. This is a bonus card on her dashboard; a failure here must not put an error in
      // front of her, and the next focus will retry.
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    void load();
    const onWake = () => void load();
    window.addEventListener('focus', onWake);
    return () => window.removeEventListener('focus', onWake);
  }, [load]);

  return { data, loading, reload: load };
}
