import { useState } from 'react';
import {
  ANONYMOUS_QA_TOPICS,
  anonymousQuestionTopicLabel,
  type AnonymousQuestion,
  type AnonymousQuestionTopic,
} from '@anuva/shared';
import { BottomNav } from './components/BottomNav';
import { useAnonymousQa } from './qa/useAnonymousQa';
import { relativeTime } from '../../shared/lib/relativeTime';

const MIN_QUESTION_LENGTH = 10;
const MAX_QUESTION_LENGTH = 1200;

const MULISH = '"Mulish", -apple-system, system-ui, sans-serif';

/** `mine` includes questions still waiting; `all` is the answered wall everyone reads. */
type Scope = 'all' | 'mine';

const SCOPES: { id: Scope; label: string }[] = [
  { id: 'all', label: 'Everyone' },
  { id: 'mine', label: 'Yours' },
];

function Eyebrow({ children, mint = false }: { children: string; mint?: boolean }) {
  return (
    <div
      className={`mb-2 flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] ${mint ? 'text-primary' : 'text-outline'}`}
    >
      <span className={`h-px w-3 ${mint ? 'bg-primary/60' : 'bg-outline/60'}`} />
      <span style={{ fontFamily: '"Mulish", sans-serif' }}>{children}</span>
    </div>
  );
}

function AnswerBlock({ answer }: { answer: AnonymousQuestion['answers'][number] }) {
  return (
    <div
      className="rounded-r-starchart-lg py-3 pl-3.5 pr-3.5"
      style={{ backgroundColor: '#E7DCEC', borderLeft: '2px solid #5E3566' }}
    >
      <div
        className="mb-1.5 text-[9.5px] uppercase tracking-[0.12em] text-primary"
        style={{ fontFamily: '"Mulish", sans-serif' }}
      >
        {answer.expertName}
        {answer.expertRole ? ` · ${answer.expertRole}` : ''}
      </div>
      <p className="text-[12.5px] leading-[1.55] text-on-surface" style={{ fontFamily: MULISH }}>
        {answer.body}
      </p>
    </div>
  );
}

function QuestionCard({ question, showTopic }: { question: AnonymousQuestion; showTopic: boolean }) {
  const answered = question.status === 'answered' && question.answers.length > 0;

  return (
    <article className="rounded-[20px] border border-border-default bg-surface-raised p-4">
      <div className="mb-3 flex items-start gap-2">
        <span
          className="shrink-0 text-[22px] font-medium leading-none text-primary"
          style={{ fontFamily: '"Fraunces", sans-serif' }}
        >
          Q.
        </span>
        <p
          className="flex-1 text-[15px] font-medium leading-[1.35] text-on-surface"
          style={{ fontFamily: '"Fraunces", sans-serif' }}
        >
          {question.body}
        </p>
      </div>

      {answered ? (
        <div className="flex flex-col gap-2">
          {question.answers.map((answer) => (
            <AnswerBlock key={answer.id} answer={answer} />
          ))}
        </div>
      ) : (
        <div
          className="rounded-[16px] border border-dashed border-border-default px-3.5 py-3 text-[12px] leading-[1.5] text-on-surface-variant"
          style={{ fontFamily: MULISH }}
        >
          Waiting for a specialist. You’ll get a notification the moment it’s answered.
        </div>
      )}

      <div
        className="mt-2.5 flex items-center justify-between text-[9.5px] uppercase tracking-[0.1em] text-outline"
        style={{ fontFamily: '"Mulish", sans-serif' }}
      >
        <span className="flex items-center gap-1.5">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
            <circle cx="12" cy="12" r="3" fill="currentColor" />
          </svg>
          {showTopic ? anonymousQuestionTopicLabel(question.topic) : 'Anonymous'}
        </span>
        {answered && question.answers.some((answer) => answer.verified) ? (
          <span className="flex items-center gap-1.5 text-primary">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M5 12l5 5L20 7" stroke="#5E3566" strokeWidth="3" strokeLinecap="round" />
            </svg>
            Verified expert
          </span>
        ) : (
          <span>{relativeTime(question.createdAt)}</span>
        )}
      </div>
    </article>
  );
}

export default function AnonymousQARoute() {
  const [question, setQuestion] = useState('');
  const [topic, setTopic] = useState<AnonymousQuestionTopic>('vasomotor');
  const [scope, setScope] = useState<Scope>('all');
  const qa = useAnonymousQa();
  const visible = scope === 'mine' ? qa.mine : qa.feed;

  const trimmed = question.trim();
  const tooShort = trimmed.length > 0 && trimmed.length < MIN_QUESTION_LENGTH;
  const outOfQuota = qa.remainingToday === 0;
  const canSubmit = trimmed.length >= MIN_QUESTION_LENGTH && !qa.submitting && !outOfQuota;

  async function handleSubmit() {
    if (!canSubmit) return;

    if (await qa.submit(topic, trimmed)) {
      setQuestion('');
      // Show her the question she just sent, waiting — it is not on the public wall until answered.
      setScope('mine');
    }
  }

  return (
    <main className="h-[100dvh] min-h-mobile overflow-x-hidden overflow-y-auto bg-surface pb-28 text-on-surface">
      <header className="sticky top-0 z-30 shrink-0 bg-surface px-3 pb-[18px] pt-[max(0.875rem,env(safe-area-inset-top))]">
        <Eyebrow mint>Ask the experts</Eyebrow>
        <h1 className="font-display max-w-[20rem] text-[30px] leading-[1.1] text-on-surface">
          Anonymous.{' '}
          <em
            className="not-italic font-light text-primary"
            style={{ fontFamily: '"Fraunces", sans-serif' }}
          >
            Always.
          </em>
        </h1>
      </header>

      <section className="px-3">
        <div
          className="flex items-start gap-2.5 rounded-[20px] border px-3.5 py-3"
          style={{
            backgroundColor: 'rgba(94, 53, 102, 0.16)',
            borderColor: 'rgba(94, 53, 102, 0.3)',
          }}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            className="mt-0.5 shrink-0"
            aria-hidden="true"
          >
            <rect x="5" y="10" width="14" height="10" rx="2" stroke="#5E3566" strokeWidth="1.8" />
            <path d="M8 10V7a4 4 0 018 0v3" stroke="#5E3566" strokeWidth="1.8" />
          </svg>
          <div className="min-w-0 flex-1">
            <div className="text-[12.5px] font-medium text-on-surface" style={{ fontFamily: MULISH }}>
              Anonymous by default
            </div>
            <p
              className="mt-0.5 text-[11px] leading-[1.4] text-on-surface-variant"
              style={{ fontFamily: MULISH }}
            >
              Specialists see your question and nothing else — no name, no phone number, no profile.
            </p>
          </div>
        </div>
      </section>

      <section className="px-3 pt-3.5">
        <article className="rounded-[20px] border border-border-default bg-surface-raised p-4">
          <Eyebrow mint>Your question</Eyebrow>
          <textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value.slice(0, MAX_QUESTION_LENGTH))}
            placeholder="Write in your own words. You can be as blunt as you like…"
            rows={4}
            disabled={outOfQuota}
            className="mt-2.5 min-h-[80px] w-full resize-none border-0 bg-transparent text-[14px] leading-[1.5] text-on-surface outline-none placeholder:text-outline disabled:opacity-60"
            style={{ fontFamily: MULISH }}
          />
          <div className="mt-2 flex flex-wrap gap-1.5">
            {ANONYMOUS_QA_TOPICS.map((t) => {
              const active = topic === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTopic(t.id)}
                  className="whitespace-nowrap rounded-full border px-3 py-1.5 text-[12px] font-medium transition-colors"
                  style={{
                    fontFamily: MULISH,
                    backgroundColor: active ? '#5E3566' : '#ECDFD0',
                    color: active ? '#FBF6F0' : '#3E2542',
                    borderColor: active ? '#5E3566' : 'rgba(180, 159, 176, 0.35)',
                  }}
                >
                  {t.label}
                </button>
              );
            })}
          </div>

          {qa.justSubmitted ? (
            <div
              className="mt-3 rounded-[16px] px-3.5 py-2.5 text-[12px] leading-[1.45] text-on-surface"
              style={{
                fontFamily: MULISH,
                backgroundColor: 'rgba(94, 53, 102, 0.12)',
              }}
            >
              Sent anonymously. It’s in the specialists’ queue now — usually answered under 24h.
            </div>
          ) : null}

          {qa.submitError ? (
            <div
              className="mt-3 rounded-[16px] border border-error/20 bg-error-container px-3.5 py-2.5 text-[12px] leading-[1.45] text-on-error-container"
              style={{ fontFamily: MULISH }}
            >
              {qa.submitError}
            </div>
          ) : null}

          {tooShort ? (
            <div className="mt-3 text-[11px] text-outline" style={{ fontFamily: MULISH }}>
              A few more words, so a specialist can answer properly.
            </div>
          ) : null}

          <div className="mt-3.5 flex items-center justify-between border-t border-border-default pt-3">
            <span
              className="text-[9.5px] uppercase tracking-[0.1em] text-outline"
              style={{ fontFamily: '"Mulish", sans-serif' }}
            >
              {outOfQuota
                ? 'Daily limit reached'
                : qa.remainingToday !== null
                  ? `Usually answered < 24h · ${qa.remainingToday} left today`
                  : 'Usually answered < 24h'}
            </span>
            <button
              type="button"
              onClick={() => void handleSubmit()}
              disabled={!canSubmit}
              className="rounded-full px-[18px] py-2 text-[12px] font-semibold text-on-secondary transition-opacity disabled:cursor-not-allowed disabled:opacity-45"
              style={{ fontFamily: MULISH, backgroundColor: '#C97E92' }}
            >
              {qa.submitting ? 'Sending…' : 'Submit'}
            </button>
          </div>
        </article>
      </section>

      {qa.state === 'error' ? (
        <section className="px-3 pt-4">
          <div
            className="rounded-[20px] border border-error/20 bg-error-container px-4 py-3 text-[12.5px] text-on-error-container"
            style={{ fontFamily: MULISH }}
          >
            {qa.loadError ?? 'Unable to load questions.'}{' '}
            <button type="button" onClick={() => void qa.reload()} className="underline">
              Retry
            </button>
          </div>
        </section>
      ) : null}

      <section className="px-3 py-4">
        <div className="flex items-end justify-between gap-3">
          <Eyebrow>{scope === 'mine' ? 'Your questions' : 'Answered questions'}</Eyebrow>
          <div className="mb-2 flex gap-1.5">
            {SCOPES.map((entry) => {
              const active = scope === entry.id;
              // Only "Yours" is countable — the wall is paged, so a number there would understate it.
              const count = entry.id === 'mine' ? qa.mine.length : 0;
              return (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => setScope(entry.id)}
                  className="rounded-full border px-3 py-1 text-[11.5px] font-medium transition-colors"
                  style={{
                    fontFamily: MULISH,
                    backgroundColor: active ? '#5E3566' : 'transparent',
                    color: active ? '#FBF6F0' : '#3E2542',
                    borderColor: active ? '#5E3566' : 'rgba(180, 159, 176, 0.35)',
                  }}
                >
                  {entry.label}
                  {count > 0 ? ` (${count})` : ''}
                </button>
              );
            })}
          </div>
        </div>

        <p
          className="mb-2.5 text-[11px] leading-[1.45] text-outline"
          style={{ fontFamily: MULISH }}
        >
          {scope === 'mine'
            ? 'Only you can see this list. Yours also appear in Everyone once answered — unsigned, like every other question.'
            : 'Every answered question, from everyone. No asker is named, including you.'}
        </p>

        {qa.state === 'loading' ? (
          <div
            className="rounded-[20px] border border-dashed border-border-default px-4 py-6 text-[12.5px] text-on-surface-variant"
            style={{ fontFamily: MULISH }}
          >
            Loading…
          </div>
        ) : visible.length === 0 ? (
          <div
            className="rounded-[20px] border border-dashed border-border-default px-4 py-6 text-[12.5px] leading-[1.5] text-on-surface-variant"
            style={{ fontFamily: MULISH }}
          >
            {scope === 'mine'
              ? 'You haven’t asked anything yet. Nobody will know it was you.'
              : 'No answered questions yet. Yours could be the first.'}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {visible.map((item) => (
              <QuestionCard key={item.id} question={item} showTopic={scope === 'mine'} />
            ))}
          </div>
        )}
      </section>

      <BottomNav />
    </main>
  );
}
