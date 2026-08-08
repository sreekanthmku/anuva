import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  anonymousQuestionTopicLabel,
  type AnonymousQuestion,
  type AnonymousQuestionStatus,
} from '@anuva/shared';
import { formatLongDateTime } from '../bookings/dateTime';
import { PageHeading } from '../shell/AppShell';
import { Card, EmptyState, ErrorNote, Pill, Segmented, SkeletonCard, StatTile } from '../shell/ui';
import { answerDoctorQuestion, fetchDoctorQuestions } from './api';

type LoadState = 'idle' | 'loading' | 'ready' | 'error';
type Filter = AnonymousQuestionStatus | 'all';

const MIN_ANSWER_LENGTH = 20;
const MAX_ANSWER_LENGTH = 4000;

function waitingFor(iso: string): string {
  const hours = Math.floor((Date.now() - new Date(iso).getTime()) / 3_600_000);
  if (hours < 1) return 'Just now';
  if (hours < 24) return `${hours}h waiting`;
  return `${Math.floor(hours / 24)}d waiting`;
}

function QuestionCard({
  question,
  canAnswer,
  onAnswered,
}: {
  question: AnonymousQuestion;
  canAnswer: boolean;
  onAnswered: (updated: AnonymousQuestion) => void;
}) {
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmed = draft.trim();
  const ready = trimmed.length >= MIN_ANSWER_LENGTH && !sending;

  async function send() {
    if (!ready) return;

    setSending(true);
    setError(null);

    try {
      const response = await answerDoctorQuestion(question.id, trimmed);
      setDraft('');
      onAnswered(response.question);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to post the answer.');
    } finally {
      setSending(false);
    }
  }

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <Pill tone="primary">{anonymousQuestionTopicLabel(question.topic)}</Pill>
        <Pill tone={question.status === 'answered' ? 'info' : 'tertiary'}>
          {question.status === 'answered' ? 'Answered' : waitingFor(question.createdAt)}
        </Pill>
      </div>

      <p className="mt-3 font-display text-[19px] leading-[1.3] text-on-surface">{question.body}</p>
      <div className="mt-2 text-[11px] text-outline">
        Asked anonymously · {formatLongDateTime(question.createdAt)}
      </div>

      {question.answers.length > 0 ? (
        <div className="mt-4 flex flex-col gap-2">
          {question.answers.map((answer) => (
            <div
              key={answer.id}
              className="rounded-[16px] border-l-2 border-primary bg-surface-container-low px-3.5 py-3 text-[13px] leading-[1.55] text-on-surface"
            >
              <div className="mb-1.5 text-[10px] uppercase tracking-[0.12em] text-primary">
                {answer.expertName}
                {answer.expertRole ? ` · ${answer.expertRole}` : ''}
              </div>
              {answer.body}
            </div>
          ))}
        </div>
      ) : null}

      {canAnswer ? (
        <div className="mt-4 rounded-[16px] border border-border-default px-3.5 py-3">
          <label className="text-[11px] uppercase tracking-[0.12em] text-outline">
            {question.answers.length > 0 ? 'Add a follow-up' : 'Your answer'}
          </label>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value.slice(0, MAX_ANSWER_LENGTH))}
            rows={4}
            placeholder="Answer in plain language. She sees your name and role, you never see hers."
            className="mt-2 min-h-[92px] w-full resize-none border-0 bg-transparent p-0 text-[13px] leading-[1.55] text-on-surface outline-none focus:ring-0 placeholder:text-outline"
          />
          {error ? (
            <div className="mt-2 rounded-[12px] border border-error/20 bg-error-container px-3 py-2 text-[12px] text-on-error-container">
              {error}
            </div>
          ) : null}
          <div className="mt-2 flex items-center justify-between gap-3">
            <span className="text-[10px] uppercase tracking-[0.1em] text-outline">
              {trimmed.length}/{MAX_ANSWER_LENGTH}
            </span>
            <button
              type="button"
              disabled={!ready}
              onClick={() => void send()}
              className="min-h-[44px] rounded-full bg-secondary px-5 text-[13px] font-semibold text-on-secondary transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
            >
              {sending ? 'Posting…' : 'Post answer'}
            </button>
          </div>
        </div>
      ) : null}
    </Card>
  );
}

export function DoctorQuestionsRoute() {
  const [state, setState] = useState<LoadState>('idle');
  const [filter, setFilter] = useState<Filter>('pending');
  const [questions, setQuestions] = useState<AnonymousQuestion[]>([]);
  const [counts, setCounts] = useState({ pending: 0, answered: 0 });
  const [canAnswer, setCanAnswer] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (status: Filter) => {
    setState('loading');
    setError(null);

    try {
      const response = await fetchDoctorQuestions(status === 'all' ? {} : { status });
      setQuestions(response.questions);
      setCounts({ pending: response.pendingCount, answered: response.answeredCount });
      setCanAnswer(response.canAnswer);
      setState('ready');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load questions.');
      setState('error');
    }
  }, []);

  useEffect(() => {
    void load(filter);
  }, [filter, load]);

  const handleAnswered = useCallback(
    (updated: AnonymousQuestion) => {
      setCounts((current) => ({
        pending: Math.max(0, current.pending - 1),
        answered: current.answered + 1,
      }));

      // The waiting list is what the doctor works through, so an answered question leaves it.
      setQuestions((current) =>
        filter === 'pending'
          ? current.filter((item) => item.id !== updated.id)
          : current.map((item) => (item.id === updated.id ? updated : item)),
      );
    },
    [filter],
  );

  const emptyLabel = useMemo(() => {
    if (filter === 'pending') return 'Nothing waiting. The queue is clear.';
    if (filter === 'answered') return 'No answered questions yet.';
    return 'No questions yet.';
  }, [filter]);

  return (
    <>
      <PageHeading
        eyebrow="Shared queue"
        title="Anonymous"
        accent="questions"
        description="Any specialist can pick one up. Askers are anonymous — no name, phone, or profile is ever attached."
      />

      <div className="grid grid-cols-2 gap-2.5">
        <StatTile label="Waiting" value={counts.pending} tone="primary" />
        <StatTile label="Answered" value={counts.answered} tone="success" />
      </div>

      <div className="mt-4">
        <Segmented<Filter>
          value={filter}
          onChange={setFilter}
          options={[
            { id: 'pending', label: 'Waiting' },
            { id: 'answered', label: 'Answered' },
            { id: 'all', label: 'All' },
          ]}
        />
      </div>

      <div className="mt-4 flex flex-col gap-3">
        {!canAnswer && state === 'ready' ? (
          <div className="rounded-[18px] border border-border-default bg-surface-container-low px-4 py-3 text-[12.5px] leading-[1.5] text-on-surface-variant">
            Read-only: an admin login has no specialist to sign an answer with. Sign in with a
            doctor’s own account to answer.
          </div>
        ) : null}

        {state === 'loading' ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : null}

        {state === 'error' ? <ErrorNote>{error ?? 'Unable to load questions.'}</ErrorNote> : null}

        {state === 'ready' && questions.length === 0 ? <EmptyState title={emptyLabel} /> : null}

        {questions.map((question) => (
          <QuestionCard
            key={question.id}
            question={question}
            canAnswer={canAnswer}
            onAnswered={handleAnswered}
          />
        ))}
      </div>
    </>
  );
}
