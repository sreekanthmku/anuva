import { useCallback, useEffect, useState } from 'react';
import type { AnonymousQuestion, AnonymousQuestionTopic } from '@anuva/shared';
import { askAnonymousQuestion, fetchAnonymousQuestionFeed, fetchMyAnonymousQuestions } from './api';

type LoadState = 'loading' | 'ready' | 'error';

export function useAnonymousQa() {
  const [state, setState] = useState<LoadState>('loading');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [mine, setMine] = useState<AnonymousQuestion[]>([]);
  const [feed, setFeed] = useState<AnonymousQuestion[]>([]);
  const [remainingToday, setRemainingToday] = useState<number | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [justSubmitted, setJustSubmitted] = useState(false);

  const load = useCallback(async () => {
    setState((current) => (current === 'ready' ? current : 'loading'));
    setLoadError(null);

    try {
      const [mineResponse, feedResponse] = await Promise.all([
        fetchMyAnonymousQuestions(),
        fetchAnonymousQuestionFeed({ limit: 20 }),
      ]);

      setMine(mineResponse.questions);
      setRemainingToday(mineResponse.remainingToday);
      setFeed(feedResponse.questions);
      setState('ready');
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Unable to load questions.');
      setState('error');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const submit = useCallback(
    async (topic: AnonymousQuestionTopic, body: string): Promise<boolean> => {
      setSubmitting(true);
      setSubmitError(null);

      try {
        const response = await askAnonymousQuestion({ topic, body: body.trim() });
        setMine((current) => [response.question, ...current]);
        setRemainingToday(response.remainingToday);
        setJustSubmitted(true);
        return true;
      } catch (err) {
        setSubmitError(err instanceof Error ? err.message : 'Unable to send your question.');
        return false;
      } finally {
        setSubmitting(false);
      }
    },
    []
  );

  const dismissSubmitted = useCallback(() => setJustSubmitted(false), []);

  return {
    state,
    loadError,
    mine,
    feed,
    remainingToday,
    submitting,
    submitError,
    justSubmitted,
    submit,
    dismissSubmitted,
    reload: load,
  };
}
