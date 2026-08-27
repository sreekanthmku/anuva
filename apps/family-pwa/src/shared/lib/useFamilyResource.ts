import { useCallback, useEffect, useState } from 'react';

/**
 * One fetch, three states, and a reload. Small on purpose — the three screens each read a single
 * endpoint, so a query library would be more machinery than the app has work for.
 */
export function useFamilyResource<T>(fetcher: () => Promise<T>) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await fetcher());
      setError(null);
    } catch (e) {
      // Keep whatever was last rendered. A stale card beats a blank screen on a flaky connection.
      setError(e instanceof Error ? e.message : 'Could not load this right now.');
    } finally {
      setLoading(false);
    }
    // The fetchers are module-level functions, so this is stable; listing it would re-run on every
    // render for callers that pass an inline arrow.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return { data, error, loading, reload: load };
}
