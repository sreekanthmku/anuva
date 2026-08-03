import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  anonymousQuestionTopicLabel,
  type AnonymousQuestion,
  type AnonymousQuestionStatus,
} from '@anuva/shared';
import { useNavigate } from 'react-router-dom';
import { useDoctorIdentity } from '../auth/identity';
import { formatLongDateTime } from '../bookings/dateTime';
import { answerDoctorQuestion, fetchDoctorQuestions } from './api';

type LoadState = 'idle' | 'loading' | 'ready' | 'error';
type Filter = AnonymousQuestionStatus | 'all';

const MIN_ANSWER_LENGTH = 20;
const MAX_ANSWER_LENGTH = 4000;

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'pending', label: 'Waiting' },
  { id: 'answered', label: 'Answered' },
  { id: 'all', label: 'All' },
];

function waitingFor(iso: string): string {
  const hours = Math.floor((Date.now() - new Date(iso).getTime()) / 3_600_000);
  if (hours < 1) return 'Asked minutes ago';
  if (hours < 24) return `Waiting ${hours}h`;
  return `Waiting ${Math.floor(hours / 24)}d`;
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <article className="rounded-[20px] border border-border-default bg-surface-raised px-4 py-3">
      <div className="text-[11px] uppercase tracking-[0.12em] text-outline">{label}</div>
      <div className="mt-1 font-display text-[28px] leading-none text-on-surface">{value}</div>
    </article>
  );
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
    <article className="rounded-[20px] border border-border-default bg-surface-raised p-4 shadow-[0_12px_30px_rgba(94,53,102,0.06)]">
      <div className="flex items-start justify-between gap-3">
        <div
          className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1"
          style={{
            backgroundColor: 'rgba(94, 53, 102, 0.16)',
            borderColor: 'rgba(94, 53, 102, 0.3)',
          }}
        >
          <span className="text-[9.5px] uppercase tracking-[0.15em] text-primary">
            {anonymousQuestionTopicLabel(question.topic)}
          </span>
        </div>
        <div
          className={`shrink-0 rounded-full px-3 py-1 text-[11px] font-semibold ${
            question.status === 'answered' ? 'bg-info/15 text-info' : 'bg-tertiary/15 text-tertiary'
          }`}
        >
          {question.status === 'answered' ? 'Answered' : waitingFor(question.createdAt)}
        </div>
      </div>

      <p className="mt-3 font-display text-[20px] leading-[1.25] text-on-surface">{question.body}</p>
      <div className="mt-2 text-[11px] text-outline">
        Asked anonymously · {formatLongDateTime(question.createdAt)}
      </div>

      {question.answers.length > 0 ? (
        <div className="mt-4 flex flex-col gap-2">
          {question.answers.map((answer) => (
            <div
              key={answer.id}
              className="rounded-[16px] bg-surface-container-low px-3.5 py-3 text-[13px] leading-[1.55] text-on-surface"
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
            className="mt-2 min-h-[92px] w-full resize-none border-0 bg-transparent text-[13px] leading-[1.55] text-on-surface outline-none placeholder:text-outline"
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
              className="rounded-full bg-secondary px-4 py-2.5 text-[13px] font-semibold text-on-secondary transition-opacity disabled:cursor-not-allowed disabled:opacity-45"
            >
              {sending ? 'Posting…' : 'Post answer'}
            </button>
          </div>
        </div>
      ) : null}
    </article>
  );
}

export function DoctorQuestionsRoute() {
  const navigate = useNavigate();
  const identity = useDoctorIdentity();
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
    <main className="min-h-mobile bg-surface text-on-surface">
      <header className="sticky top-0 z-20 border-b border-border-default bg-surface/95 px-4 pb-5 pt-[max(1rem,env(safe-area-inset-top))] backdrop-blur">
        <div className="flex items-start justify-between gap-3">
          <button
            type="button"
            onClick={() => navigate('/')}
            className="shrink-0 rounded-full border border-border-default px-3 py-1 text-[11px] font-semibold text-on-surface-variant"
          >
            ← Bookings
          </button>
          <button
            type="button"
            onClick={identity.signOut}
            className="shrink-0 rounded-full border border-border-default px-3 py-1 text-[11px] font-semibold text-on-surface-variant"
          >
            Sign out
          </button>
        </div>
        <h1 className="mt-3 max-w-[20rem] font-display text-[30px] leading-[1.1]">
          Anonymous <em className="not-italic text-primary">questions</em>
        </h1>
        <p className="mt-2 max-w-[24rem] text-[13px] leading-[1.5] text-on-surface-variant">
          A shared queue — any specialist can pick one up. Askers are anonymous: no name, phone, or
          profile is ever attached.
        </p>

        <div className="mt-3 flex gap-1.5">
          {FILTERS.map((entry) => {
            const active = filter === entry.id;
            return (
              <button
                key={entry.id}
                type="button"
                onClick={() => setFilter(entry.id)}
                className={`rounded-full border px-3 py-1.5 text-[12px] font-medium transition-colors ${
                  active
                    ? 'border-primary bg-primary text-on-primary'
                    : 'border-border-default bg-surface-container-low text-on-surface-variant'
                }`}
              >
                {entry.label}
              </button>
            );
          })}
        </div>
      </header>

      <section className="px-4 pb-8 pt-4">
        <div className="grid grid-cols-2 gap-3">
          <StatCard label="Waiting" value={String(counts.pending)} />
          <StatCard label="Answered" value={String(counts.answered)} />
        </div>

        {!canAnswer && state === 'ready' ? (
          <div className="mt-4 rounded-[20px] border border-border-default bg-surface-container-low px-4 py-3 text-[12.5px] leading-[1.5] text-on-surface-variant">
            Read-only: the shared admin key has no specialist to sign an answer with. Sign in with a
            doctor’s own key to answer.
          </div>
        ) : null}

        {state === 'loading' ? (
          <div className="mt-4 rounded-[20px] border border-dashed border-border-default bg-surface-container-low px-4 py-6 text-[13px] text-on-surface-variant">
            Loading questions...
          </div>
        ) : null}

        {state === 'error' ? (
          <div className="mt-4 rounded-[20px] border border-error/20 bg-error-container px-4 py-4 text-[13px] text-on-error-container">
            {error ?? 'Unable to load questions.'}
          </div>
        ) : null}

        {state === 'ready' && questions.length === 0 ? (
          <div className="mt-4 rounded-[20px] border border-dashed border-border-default bg-surface-container-low px-4 py-6 text-[13px] text-on-surface-variant">
            {emptyLabel}
          </div>
        ) : null}

        <div className="mt-4 flex flex-col gap-3">
          {questions.map((question) => (
            <QuestionCard
              key={question.id}
              question={question}
              canAnswer={canAnswer}
              onAnswered={handleAnswered}
            />
          ))}
        </div>
      </section>
    </main>
  );
}
