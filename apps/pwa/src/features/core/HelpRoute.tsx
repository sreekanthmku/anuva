import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  SUPPORT_TICKET_CATEGORIES,
  supportTicketCategoryLabel,
  type SupportTicket,
  type SupportTicketCategory,
} from '@anuva/shared';
import { DPDP_ACT_URL, GRIEVANCE_OFFICER_EMAIL } from '../../shared/lib/dpdp';
import { BottomNav } from './components/BottomNav';
import { createSupportTicket, fetchMySupportTickets } from './support/api';

const MULISH = '"Mulish", -apple-system, system-ui, sans-serif';
const MIN_MESSAGE_LENGTH = 10;
const MAX_MESSAGE_LENGTH = 2000;
const MAX_SUBJECT_LENGTH = 120;

/**
 * The wording she agrees to by sending. Stored with the ticket, so changing this text later cannot
 * rewrite what earlier tickets were collected under — bump the version whenever the copy changes.
 */
const CONSENT_VERSION = 'support-consent-v1';
const RETENTION_MONTHS = 6;

const STATUS_LABEL: Record<SupportTicket['status'], string> = {
  open: 'Received',
  in_progress: 'Being looked at',
  resolved: 'Answered',
  closed: 'Closed',
};

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

function ticketDate(iso: string): string {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return '';

  const time = at.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  if (at.getTime() >= startOfToday.getTime()) {
    return `Today at ${time}`;
  }

  const sameYear = at.getFullYear() === new Date().getFullYear();
  return `${at.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    ...(sameYear ? {} : { year: 'numeric' }),
  })} at ${time}`;
}

function TicketCard({ ticket }: { ticket: SupportTicket }) {
  const answered = Boolean(ticket.response);

  return (
    <article className="rounded-[20px] border border-border-default bg-surface-raised p-4">
      <div className="mb-2 flex items-start justify-between gap-3">
        <p
          className="flex-1 text-[15px] font-medium leading-[1.35] text-on-surface"
          style={{ fontFamily: '"Fraunces", sans-serif' }}
        >
          {ticket.subject}
        </p>
        <span
          className="shrink-0 rounded-full px-2.5 py-1 text-[10px] uppercase tracking-[0.1em]"
          style={{
            fontFamily: '"Mulish", sans-serif',
            backgroundColor: answered ? 'rgba(94, 53, 102, 0.16)' : '#ECDFD0',
            color: answered ? '#5E3566' : '#3E2542',
          }}
        >
          {STATUS_LABEL[ticket.status]}
        </span>
      </div>

      <p
        className="text-[12.5px] leading-[1.55] text-on-surface-variant"
        style={{ fontFamily: MULISH }}
      >
        {ticket.message}
      </p>

      {answered ? (
        <div
          className="mt-3 rounded-r-[16px] py-3 pl-3.5 pr-3.5"
          style={{ backgroundColor: '#E7DCEC', borderLeft: '2px solid #5E3566' }}
        >
          <div
            className="mb-1.5 text-[9.5px] uppercase tracking-[0.12em] text-primary"
            style={{ fontFamily: '"Mulish", sans-serif' }}
          >
            Anuva Wellness support
            {ticket.respondedAt ? ` · ${ticketDate(ticket.respondedAt)}` : ''}
          </div>
          <p className="text-[12.5px] leading-[1.55] text-on-surface" style={{ fontFamily: MULISH }}>
            {ticket.response}
          </p>
        </div>
      ) : null}

      <div
        className="mt-2.5 flex items-center justify-between text-[9.5px] uppercase tracking-[0.1em] text-outline"
        style={{ fontFamily: '"Mulish", sans-serif' }}
      >
        <span>
          {ticket.reference} · {supportTicketCategoryLabel(ticket.category)}
        </span>
        <span>{ticketDate(ticket.createdAt)}</span>
      </div>
    </article>
  );
}

/**
 * Help & support. A request written here is stored in Anuva's own database and answered in the
 * app — it is not emailed anywhere, which is what keeps it inside systems that can honour a
 * deletion request.
 */
export default function HelpRoute() {
  const navigate = useNavigate();
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [remainingToday, setRemainingToday] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [category, setCategory] = useState<SupportTicketCategory>('account');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [wantsEmailReply, setWantsEmailReply] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [justSubmitted, setJustSubmitted] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await fetchMySupportTickets();
      setTickets(response.tickets);
      setRemainingToday(response.remainingToday);
      setLoadError(null);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Could not load your requests.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const trimmedSubject = subject.trim();
  const trimmedMessage = message.trim();
  const outOfQuota = remainingToday === 0;
  const canSubmit =
    trimmedSubject.length >= 3 &&
    trimmedMessage.length >= MIN_MESSAGE_LENGTH &&
    (!wantsEmailReply || contactEmail.trim().length > 0) &&
    !submitting &&
    !outOfQuota;

  async function handleSubmit() {
    if (!canSubmit) return;

    setSubmitting(true);
    setSubmitError(null);
    try {
      const response = await createSupportTicket({
        category,
        subject: trimmedSubject,
        message: trimmedMessage,
        // Sent only when she asked for an email reply — otherwise no address is stored at all.
        ...(wantsEmailReply && contactEmail.trim() ? { contactEmail: contactEmail.trim() } : {}),
        consentVersion: CONSENT_VERSION,
      });

      setTickets((current) => [response.ticket, ...current]);
      setRemainingToday(response.remainingToday);
      setJustSubmitted(response.ticket.reference);
      setSubject('');
      setMessage('');
      setContactEmail('');
      setWantsEmailReply(false);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Could not send your request.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="h-[100dvh] min-h-mobile overflow-x-hidden overflow-y-auto bg-surface pb-28 text-on-surface">
      <header className="sticky top-0 z-30 shrink-0 bg-surface px-3 pb-[18px] pt-[max(0.875rem,env(safe-area-inset-top))]">
        <button
          type="button"
          onClick={() => navigate('/profile')}
          className="mb-2 bg-transparent p-0 text-[13px] text-on-surface-variant"
          style={{ fontFamily: MULISH }}
        >
          ← Profile
        </button>
        <Eyebrow mint>Help &amp; support</Eyebrow>
        <h1 className="font-display max-w-[20rem] text-[30px] leading-[1.1] text-on-surface">
          Tell us what&apos;s{' '}
          <em
            className="not-italic font-light text-primary"
            style={{ fontFamily: '"Fraunces", sans-serif' }}
          >
            wrong.
          </em>
        </h1>
      </header>

      <section className="px-3">
        <article className="rounded-[20px] border border-border-default bg-surface-raised p-4">
          <Eyebrow mint>What is it about?</Eyebrow>

          <div className="mt-1 flex flex-wrap gap-1.5">
            {SUPPORT_TICKET_CATEGORIES.map((entry) => {
              const active = category === entry.id;
              return (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => setCategory(entry.id)}
                  className="whitespace-nowrap rounded-full border px-3 py-1.5 text-[12px] font-medium transition-colors"
                  style={{
                    fontFamily: MULISH,
                    backgroundColor: active ? '#5E3566' : '#ECDFD0',
                    color: active ? '#FBF6F0' : '#3E2542',
                    borderColor: active ? '#5E3566' : 'rgba(180, 159, 176, 0.35)',
                  }}
                >
                  {entry.label}
                </button>
              );
            })}
          </div>

          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value.slice(0, MAX_SUBJECT_LENGTH))}
            placeholder="Subject — one line"
            disabled={outOfQuota}
            className="mt-3.5 w-full border-0 border-b border-border-default bg-transparent pb-2 text-[14px] text-on-surface outline-none placeholder:text-outline disabled:opacity-60"
            style={{ fontFamily: MULISH }}
          />

          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value.slice(0, MAX_MESSAGE_LENGTH))}
            placeholder="What happened? The more detail, the faster we can fix it."
            rows={4}
            disabled={outOfQuota}
            className="mt-3 min-h-[88px] w-full resize-none border-0 bg-transparent text-[14px] leading-[1.5] text-on-surface outline-none placeholder:text-outline disabled:opacity-60"
            style={{ fontFamily: MULISH }}
          />

          <label
            className="mt-1 flex items-start gap-2.5 text-[12px] leading-[1.45] text-on-surface-variant"
            style={{ fontFamily: MULISH }}
          >
            <input
              type="checkbox"
              checked={wantsEmailReply}
              onChange={(e) => {
                setWantsEmailReply(e.target.checked);
                if (!e.target.checked) setContactEmail('');
              }}
              className="mt-0.5 h-4 w-4 shrink-0 accent-primary"
            />
            <span>Reply to me by email instead of in the app</span>
          </label>

          {wantsEmailReply ? (
            <input
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value.slice(0, 200))}
              placeholder="you@example.com"
              inputMode="email"
              autoComplete="email"
              className="mt-2.5 w-full border-0 border-b border-border-default bg-transparent pb-2 text-[14px] text-on-surface outline-none placeholder:text-outline"
              style={{ fontFamily: MULISH }}
            />
          ) : null}

          {/* The DPDP notice: purpose, retention, and what happens to it — at the point of collection,
              not buried in a policy page. */}
          <p
            className="mt-3.5 rounded-[16px] bg-surface-container-low px-3.5 py-3 text-[11px] leading-[1.5] text-on-surface-variant"
            style={{ fontFamily: MULISH }}
          >
            We use what you write here only to answer you. It is stored on Anuva Wellness systems,
            never emailed to anyone outside, and deleted after {RETENTION_MONTHS} months. You can
            ask us to delete it sooner, or withdraw this at any time, under the{' '}
            <a
              href={DPDP_ACT_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline"
            >
              DPDP Act
            </a>
            . Please don&apos;t include health details you wouldn&apos;t want our support team to
            read — for anything clinical, book a consultation instead.
          </p>

          {justSubmitted ? (
            <div
              className="mt-3 rounded-[16px] px-3.5 py-2.5 text-[12px] leading-[1.45] text-on-surface"
              style={{ fontFamily: MULISH, backgroundColor: 'rgba(94, 53, 102, 0.12)' }}
            >
              Got it — your reference is {justSubmitted}. We usually reply within two working days,
              right here in the app.
            </div>
          ) : null}

          {submitError ? (
            <div
              className="mt-3 rounded-[16px] border border-error/20 bg-error-container px-3.5 py-2.5 text-[12px] leading-[1.45] text-on-error-container"
              style={{ fontFamily: MULISH }}
            >
              {submitError}
            </div>
          ) : null}

          <div className="mt-3.5 flex items-center justify-between border-t border-border-default pt-3">
            <span
              className="text-[9.5px] uppercase tracking-[0.1em] text-outline"
              style={{ fontFamily: '"Mulish", sans-serif' }}
            >
              {outOfQuota ? 'Daily limit reached' : 'Replies in ~2 working days'}
            </span>
            <button
              type="button"
              onClick={() => void handleSubmit()}
              disabled={!canSubmit}
              className="rounded-full px-[18px] py-2 text-[12px] font-semibold text-on-secondary transition-opacity disabled:cursor-not-allowed disabled:opacity-45"
              style={{ fontFamily: MULISH, backgroundColor: '#C97E92' }}
            >
              {submitting ? 'Sending…' : 'Send'}
            </button>
          </div>
        </article>
      </section>

      <section className="px-3 py-4">
        <Eyebrow>Your requests</Eyebrow>

        {loadError ? (
          <div
            className="rounded-[20px] border border-error/20 bg-error-container px-4 py-3 text-[12.5px] text-on-error-container"
            style={{ fontFamily: MULISH }}
          >
            {loadError}{' '}
            <button type="button" onClick={() => void load()} className="underline">
              Retry
            </button>
          </div>
        ) : loading ? (
          <div
            className="rounded-[20px] border border-dashed border-border-default px-4 py-6 text-[12.5px] text-on-surface-variant"
            style={{ fontFamily: MULISH }}
          >
            Loading…
          </div>
        ) : tickets.length === 0 ? (
          <div
            className="rounded-[20px] border border-dashed border-border-default px-4 py-6 text-[12.5px] leading-[1.5] text-on-surface-variant"
            style={{ fontFamily: MULISH }}
          >
            Nothing yet. Anything you send will show up here with our reply.
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {tickets.map((ticket) => (
              <TicketCard key={ticket.id} ticket={ticket} />
            ))}
          </div>
        )}
      </section>

      {/* Statutory contact under §13 of the DPDP Act — kept separate from support so a grievance
          is not filed into the same queue it is about. */}
      <section className="px-3 pb-4">
        <p className="text-[11px] leading-[1.5] text-outline" style={{ fontFamily: MULISH }}>
          Unhappy with how we handled your data? Write to our Grievance Officer at{' '}
          <a href={`mailto:${GRIEVANCE_OFFICER_EMAIL}`} className="text-primary underline">
            {GRIEVANCE_OFFICER_EMAIL}
          </a>
          .
        </p>
      </section>

      <BottomNav />
    </main>
  );
}
