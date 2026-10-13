import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type {
  AnuChatHistoryResponse,
  AnuChatResponse,
  AnuChatV3HistoryResponse,
  AnuChatV3Response,
  AnuV3Action,
  AnuV3LogOption,
  AnuV3Slot,
} from '@anuva/shared';
import { apiFetch } from '../../shared/lib/api';
import { LogOptions } from './anuV3/LogOptions';
import { ReminderOffer } from './anuV3/ReminderOffer';
import { SlotOffer } from './anuV3/SlotOffer';
import { BottomNav } from './components/BottomNav';
import { remainingDelay, replyDelay, wait } from './chatPacing';

type ChatMessage = {
  from: 'anu' | 'user';
  text: string;
  /// Red-flag replies are clinician-authored safety text; they get their own
  /// treatment so they cannot be mistaken for ordinary coaching.
  isEscalation?: boolean;
  /// v3 only: an in-app screen the reply offers, rendered as a button under it.
  action?: AnuV3Action | null;
  /// v3 only: the recorded turn, appointment times to book and trackers to log
  /// that the reply offers. ANU chose them; she books or logs by tapping.
  turnId?: string | null;
  slots?: AnuV3Slot[];
  logOptions?: AnuV3LogOption[];
  reminderOffer?: boolean;
  booked?: boolean;
};

/// A v3 reply as a chat message.
function v3Message(data: AnuChatV3Response, booked = false): ChatMessage {
  return {
    from: 'anu',
    text: data.reply,
    isEscalation: data.escalation !== null,
    action: data.action,
    turnId: data.turnId,
    slots: data.slots,
    logOptions: data.logOptions,
    reminderOffer: data.reminderOffer,
    booked,
  };
}

/// Which ANU engine this device talks to. `current` is /anu/chat (classic +
/// probe ladder, chosen server-side); `v3` is /anu/v3/chat. Each keeps its own
/// thread, so switching swaps the conversation on screen.
type ChatEngine = 'current' | 'v3';

const ENGINE_STORAGE_KEY = 'anu.chatEngine';

function readEngine(): ChatEngine {
  try {
    return window.localStorage.getItem(ENGINE_STORAGE_KEY) === 'v3' ? 'v3' : 'current';
  } catch {
    return 'current';
  }
}

function writeEngine(engine: ChatEngine): void {
  try {
    window.localStorage.setItem(ENGINE_STORAGE_KEY, engine);
  } catch {
    // Private mode or blocked storage: the switch still works for this visit.
  }
}

const CHAT_PATH: Record<ChatEngine, string> = {
  current: '/api/anu/chat',
  v3: '/api/anu/v3/chat',
};

/// Shown only before the first exchange — after that every chip comes from
/// ANU's own reply, so they follow whatever she actually raised.
///
/// Keys, not sentences: a chip is sent verbatim as her message, so it has to be the wording she
/// would actually use in the language she is reading.
const OPENING_PROMPT_KEYS = ['chat.openers.tired', 'chat.openers.sleep', 'chat.openers.hotFlashes'];

export default function AnuChatRoute() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [engine, setEngine] = useState<ChatEngine>(readEngine);
  const [menuOpen, setMenuOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [input, setInput] = useState('');
  const [historyLoading, setHistoryLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messageListRef = useRef<HTMLElement | null>(null);
  const didInitialScroll = useRef(false);
  /// `?ask=` fires exactly once per mount. It writes into her permanent thread
  /// and costs a real model call, so a remount, a StrictMode double-effect or a
  /// back-navigation must not send it twice.
  const didAutoSend = useRef(false);

  useEffect(() => {
    let cancelled = false;
    setHistoryLoading(true);
    setMessages([]);
    setSuggestions([]);
    setError(null);
    didInitialScroll.current = false;

    const load: Promise<{ messages: ChatMessage[]; suggestions: string[] }> =
      engine === 'v3'
        ? apiFetch<AnuChatV3HistoryResponse>(CHAT_PATH.v3).then((data) => ({
            messages: data.turns.flatMap((turn): ChatMessage[] => [
              // An app-event turn (a booking confirmation) has no message from her.
              ...(turn.userMessage ? [{ from: 'user' as const, text: turn.userMessage }] : []),
              {
                from: 'anu',
                text: turn.reply,
                isEscalation: turn.escalated,
                action: turn.action,
                turnId: turn.id,
                slots: turn.slots,
                logOptions: turn.logOptions,
                reminderOffer: turn.reminderOffer,
                booked: turn.booked,
              },
            ]),
            suggestions: data.turns.at(-1)?.suggestions ?? [],
          }))
        : apiFetch<AnuChatHistoryResponse>(CHAT_PATH.current).then((data) => ({
            messages: data.turns.flatMap((turn) => [
              { from: 'user' as const, text: turn.userMessage },
              { from: 'anu' as const, text: turn.reply, isEscalation: turn.source === 'red_flag' },
            ]),
            suggestions: data.turns.at(-1)?.suggestions ?? [],
          }));

    load
      .then((data) => {
        if (cancelled) return;
        setMessages(data.messages);
        // Restore the chips from the last reply so a returning user picks up
        // where she left off.
        setSuggestions(data.suggestions);
      })
      .catch(() => {
        if (!cancelled) setError(t('chat.loadFailed'));
      })
      .finally(() => {
        if (!cancelled) setHistoryLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [engine, t]);

  const switchEngine = useCallback(
    (next: ChatEngine) => {
      setMenuOpen(false);
      if (next === engine || sending) return;
      writeEngine(next);
      setEngine(next);
    },
    [engine, sending],
  );

  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || sending) return;

      setMessages((prev) => [...prev, { from: 'user', text: trimmed }]);
      setInput('');
      setSending(true);
      setError(null);
      // Clear immediately: the old chips belong to the previous answer.
      setSuggestions([]);

      // Paced, not padded — see `chatPacing`. Measured from the moment she
      // sends rather than from the response, so a slow answer is never made
      // slower.
      const startedAt = Date.now();
      const delay = replyDelay();

      try {
        const data = await apiFetch<AnuChatResponse | AnuChatV3Response>(CHAT_PATH[engine], {
          method: 'POST',
          body: JSON.stringify({ message: trimmed }),
        });

        await wait(remainingDelay(delay, Date.now() - startedAt));

        setMessages((prev) => [
          ...prev,
          // v3 escalates classified L3/L4 turns too, not only gate matches.
          'turnId' in data
            ? v3Message(data)
            : { from: 'anu', text: data.reply, isEscalation: data.source === 'red_flag' },
        ]);
        setSuggestions(data.suggestions);
      } catch {
        // Not paced. A failure is the app speaking, not ANU, and holding it
        // behind a typing bubble only delays the retry.
        setError(t('chat.replyFailed'));
      } finally {
        setSending(false);
      }
    },
    [engine, sending, t],
  );

  // Sent here from the home card: the card's own copy is deterministic, and the
  // reply is generated in this thread so it passes the same red-flag gate as
  // anything she types. Waits for history — sending before the restore lands
  // would drop her new turn above the older ones.
  const ask = searchParams.get('ask');
  useEffect(() => {
    if (historyLoading || !ask || didAutoSend.current) return;

    didAutoSend.current = true;
    // Drop the param before sending, so a refresh mid-reply cannot re-fire it.
    setSearchParams({}, { replace: true });
    void send(ask);
  }, [ask, historyLoading, send, setSearchParams]);

  // Pin to the newest message. The list itself is scrolled rather than calling
  // scrollIntoView, which can scroll an ancestor instead and fights the fixed
  // composer. Two frames: the first lets React paint the new bubble, the second
  // catches the reflow when the chip row appears or disappears.
  useEffect(() => {
    const list = messageListRef.current;
    if (!list) return;

    // Jump straight to the bottom when restoring history; animate afterwards.
    const behavior: ScrollBehavior = didInitialScroll.current ? 'smooth' : 'auto';
    let second = 0;
    const first = window.requestAnimationFrame(() => {
      list.scrollTo({ top: list.scrollHeight, behavior });
      second = window.requestAnimationFrame(() => {
        list.scrollTo({ top: list.scrollHeight, behavior });
        didInitialScroll.current = true;
      });
    });

    return () => {
      window.cancelAnimationFrame(first);
      window.cancelAnimationFrame(second);
    };
  }, [messages, sending, suggestions, historyLoading]);

  // Openers only seed an empty thread; once ANU has replied the chips are hers.
  const chips =
    messages.length === 0 && !historyLoading ? OPENING_PROMPT_KEYS.map((key) => t(key)) : suggestions;

  return (
    // The only reserved space is BottomNav, which is fixed and outside this
    // tree. Everything inside is laid out by flex, so the composer can never
    // overlap the messages however tall the chip row grows.
    <main
      className="h-mobile flex flex-col overflow-hidden bg-surface text-on-surface"
      style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 68px)' }}
    >
      <header className="sticky top-0 z-40 shrink-0 bg-surface">
        <section className="flex items-center gap-3 border-b border-border-default px-3 pb-3.5 pt-[max(0.875rem,env(safe-area-inset-top))]">
          <button
            type="button"
            onClick={() => navigate('/home')}
            className="bg-transparent p-0 text-[18px] leading-none text-on-surface-variant"
            style={{ fontFamily: '"Mulish", -apple-system, system-ui, sans-serif' }}
            aria-label={t('chat.backToHome')}
          >
            ←
          </button>

          <div className="relative">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-primary/30 bg-surface-container-low">
              <img src="/anu.png" alt={t('chat.anuAvatarAlt')} className="h-6 w-6 object-contain" />
            </span>
            <span className="absolute -bottom-[1px] -right-[1px] h-2.5 w-2.5 rounded-full border-2 border-surface bg-primary" />
          </div>

          <div className="flex-1">
            <p
              className="text-[17px] text-on-surface"
              style={{ fontFamily: '"Fraunces", sans-serif', fontWeight: 500 }}
            >
              {t('chat.anuName')}
            </p>
            <p
              className="text-[10px] uppercase tracking-[0.08em] text-primary"
              style={{ fontFamily: '"Mulish", sans-serif' }}
            >
              {t('chat.status')}
              {engine === 'v3' && (
                <span className="ml-1.5 rounded-full bg-tertiary/15 px-1.5 py-[1px] text-tertiary">
                  {t('chat.engine.v3Badge')}
                </span>
              )}
            </p>
          </div>

          <div className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              className="inline-flex h-11 w-11 items-center justify-center bg-transparent p-0 text-[18px] text-outline"
              aria-label={t('chat.moreOptions')}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
            >
              ⋯
            </button>

            {menuOpen && (
              <>
                {/* Click-away layer: closes the menu without sending the tap through. */}
                <button
                  type="button"
                  className="fixed inset-0 z-40 cursor-default bg-transparent"
                  aria-hidden="true"
                  tabIndex={-1}
                  onClick={() => setMenuOpen(false)}
                />
                <div
                  role="menu"
                  className="absolute right-0 top-full z-50 mt-1 w-56 rounded-[18px] border border-border-default bg-surface p-1.5 shadow-[0_8px_24px_rgba(94,53,102,0.18)]"
                  style={{ fontFamily: '"Mulish", sans-serif' }}
                >
                  <p className="px-3 pb-1 pt-1.5 text-[10px] uppercase tracking-[0.08em] text-on-surface-variant">
                    {t('chat.engine.title')}
                  </p>
                  {(['current', 'v3'] as const).map((option) => (
                    <button
                      key={option}
                      type="button"
                      role="menuitemradio"
                      aria-checked={engine === option}
                      disabled={sending}
                      onClick={() => switchEngine(option)}
                      className={`flex min-h-11 w-full items-center justify-between rounded-[12px] px-3 text-left text-[14px] disabled:opacity-50 ${
                        engine === option ? 'bg-primary/10 font-semibold text-primary' : 'text-on-surface'
                      }`}
                    >
                      <span>{t(`chat.engine.${option}`)}</span>
                      {engine === option && <span aria-hidden="true">✓</span>}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </section>

        <section className="flex items-center justify-center gap-1.5 bg-primary/15 px-3 py-1.5 text-[9.5px] uppercase tracking-[0.12em] text-primary">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <rect x="5" y="10" width="14" height="10" rx="2" stroke="#5E3566" strokeWidth="2" />
            <path d="M8 10V7a4 4 0 018 0v3" stroke="#5E3566" strokeWidth="2" />
          </svg>
          <span style={{ fontFamily: '"Mulish", sans-serif' }}>{t('chat.encrypted')}</span>
        </section>
      </header>

      <section
        ref={messageListRef}
        className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto px-4 pb-3 pt-[18px]"
      >
        {!historyLoading && messages.length === 0 && (
          <p
            className="mt-6 text-center text-[13px] leading-[1.6] text-on-surface-variant"
            style={{ fontFamily: '"Mulish", sans-serif' }}
          >
            {t('chat.emptyState')}
          </p>
        )}

        {messages.map((message, index) => {
          const isUser = message.from === 'user';

          return (
            <div
              key={`${message.from}-${index}`}
              className={`flex max-w-[82%] items-end gap-2 ${isUser ? 'ml-auto flex-row-reverse' : ''}`}
            >
              {!isUser && (
                <img
                  src="/anu.png"
                  alt=""
                  className="h-6 w-6 shrink-0 rounded-full border border-border-default bg-surface-container-low p-1"
                />
              )}
              <div className={`flex flex-col gap-1.5 ${isUser ? 'items-end' : 'items-start'}`}>
              <div
                className={`${engine === 'v3' ? 'whitespace-pre-line ' : ''}px-[14px] py-[10px] text-[14px] leading-[1.5] ${
                  isUser
                    ? 'rounded-[20px_20px_4px_20px] bg-secondary text-on-secondary'
                    : message.isEscalation
                      ? 'rounded-[20px_20px_20px_4px] border border-tertiary/40 bg-tertiary/10 text-on-surface'
                      : 'rounded-[20px_20px_20px_4px] bg-primary-container text-on-surface'
                }`}
                style={{ fontFamily: '"Mulish", -apple-system, system-ui, sans-serif' }}
              >
                {message.text}
              </div>
              {message.slots && message.slots.length > 0 && (
                <SlotOffer
                  slots={message.slots}
                  turnId={message.turnId ?? null}
                  booked={message.booked ?? false}
                  onAnuReply={(data) => {
                    setMessages((prev) => [...prev, v3Message(data)]);
                    setSuggestions([]);
                  }}
                />
              )}
              {message.logOptions && message.logOptions.length > 0 && <LogOptions options={message.logOptions} />}
              {message.reminderOffer && <ReminderOffer />}
              {message.action && (
                <button
                  type="button"
                  onClick={() => navigate(message.action!.href)}
                  className="min-h-11 rounded-full border border-primary/30 bg-surface px-4 py-2 text-[13px] font-semibold text-primary"
                  style={{ fontFamily: '"Mulish", -apple-system, system-ui, sans-serif' }}
                >
                  {t(`chat.actions.${message.action.type}`, { defaultValue: t('chat.actions.fallback') })} →
                </button>
              )}
              </div>
            </div>
          );
        })}

        {sending && (
          <div className="flex max-w-[82%] items-end gap-2">
            <img
              src="/anu.png"
              alt=""
              className="h-6 w-6 shrink-0 rounded-full border border-border-default bg-surface-container-low p-1"
            />
            <div
              className="rounded-[20px_20px_20px_4px] bg-primary-container px-[14px] py-[10px] text-[14px] text-on-surface-variant"
              style={{ fontFamily: '"Mulish", sans-serif' }}
            >
              {t('chat.typing')}
            </div>
          </div>
        )}

        {error && (
          <p
            className="text-center text-[12px] text-error"
            style={{ fontFamily: '"Mulish", sans-serif' }}
          >
            {error}
          </p>
        )}

      </section>

      <section className="shrink-0 bg-surface">
        {chips.length > 0 && (
          <section className="no-scrollbar overflow-x-auto border-t border-border-default px-4 py-2">
            <div className="flex gap-1.5">
              {chips.map((chip) => (
                <button
                  key={chip}
                  type="button"
                  onClick={() => void send(chip)}
                  disabled={sending}
                  className="shrink-0 rounded-full border border-primary/25 bg-primary/10 px-4 py-2 text-[13px] font-semibold text-primary disabled:opacity-50"
                  style={{ fontFamily: '"Mulish", -apple-system, system-ui, sans-serif' }}
                >
                  {chip}
                </button>
              ))}
            </div>
          </section>
        )}

        <section className="flex items-center gap-2.5 bg-surface px-5 pb-2 pt-1.5">
          <label className="flex flex-1 items-center gap-2 rounded-full border border-border-default bg-surface-container-low px-5 py-1.5 [-webkit-tap-highlight-color:transparent]">
            {/*
              iOS paints a native focus rectangle on text fields that `outline: none`
              alone does not clear — resetting the appearance and box-shadow does.
            */}
            <input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') void send(input);
              }}
              disabled={sending}
              placeholder={t('chat.placeholder')}
              className="w-full appearance-none border-none bg-transparent text-[16px] text-on-surface placeholder:text-outline [-webkit-tap-highlight-color:transparent] [outline:none] focus:[outline:none]"
              style={{
                fontFamily: '"Mulish", -apple-system, system-ui, sans-serif',
                WebkitAppearance: 'none',
                appearance: 'none',
                outline: 'none',
                boxShadow: 'none',
              }}
            />
          </label>

          <button
            type="button"
            onClick={() => void send(input)}
            disabled={sending}
            className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-secondary disabled:opacity-50"
            aria-label={t('chat.send')}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M4 12l16-7-7 16-2-7-7-2z"
                stroke="#3E2542"
                strokeWidth="1.8"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </section>
      </section>

      <BottomNav />
    </main>
  );
}
