import { useCallback, useEffect, useState } from 'react';
import type {
  LibraryArticleResponse,
  LibraryCategory,
  LibraryFeedResponse,
} from '@anuva/shared';
import { fetchLibraryArticle, fetchLibraryFeed } from './api';

type LoadState = 'loading' | 'ready' | 'error';

export function useLibraryFeed() {
  const [state, setState] = useState<LoadState>('loading');
  const [error, setError] = useState<string | null>(null);
  const [feed, setFeed] = useState<LibraryFeedResponse | null>(null);
  const [category, setCategory] = useState<LibraryCategory | null>(null);
  const [search, setSearch] = useState('');

  const load = useCallback(async (nextCategory: LibraryCategory | null, nextSearch: string) => {
    // Keep the previous feed on screen while refiltering — the header and
    // chips must not collapse between requests.
    setState((current) => (current === 'ready' ? current : 'loading'));
    setError(null);

    try {
      const response = await fetchLibraryFeed({
        category: nextCategory ?? undefined,
        search: nextSearch,
      });
      setFeed(response);
      setState('ready');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load the library.');
      setState('error');
    }
  }, []);

  useEffect(() => {
    const debounce = window.setTimeout(() => void load(category, search), search ? 250 : 0);
    return () => window.clearTimeout(debounce);
  }, [load, category, search]);

  return {
    state,
    error,
    feed,
    category,
    search,
    setCategory,
    setSearch,
    reload: () => void load(category, search),
  };
}

export function useLibraryArticle(slug: string | undefined) {
  const [state, setState] = useState<LoadState>('loading');
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<LibraryArticleResponse | null>(null);

  const load = useCallback(async () => {
    if (!slug) {
      setError('Article not found.');
      setState('error');
      return;
    }

    setState('loading');
    setError(null);

    try {
      setData(await fetchLibraryArticle(slug));
      setState('ready');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load this article.');
      setState('error');
    }
  }, [slug]);

  useEffect(() => {
    void load();
  }, [load]);

  return { state, error, data, reload: load };
}
