import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { AnuChatHistoryResponse, AnuChatResponse } from '@anuva/shared';
import { apiFetch } from '../../shared/lib/api';
import { BottomNav } from './components/BottomNav';

type ChatMessage = {
  from: 'anu' | 'user';
  text: string;
  /// Red-flag replies are clinician-authored safety text; they get their own
  /// treatment so they cannot be mistaken for ordinary coaching.
  isEscalation?: boolean;
};

/// Shown only before the first exchange — after that every chip comes from
/// ANU's own reply, so they follow whatever she actually raised.
const openingPrompts = ['I feel tired', "I can't sleep", 'I get hot flashes'];

export default function AnuChatRoute() {
  const navigate = useNavigate();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [input, setInput] = useState('');
  const [historyLoading, setHistoryLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messageListRef = useRef<HTMLElement | null>(null);
  const didInitialScroll = useRef(false);

  useEffect(() => {
    let cancelled = false;

    apiFetch<AnuChatHistoryResponse>('/api/anu/chat')
      .then((data) => {
        if (cancelled) return;
        setMessages(
          data.turns.flatMap((turn) => [
            { from: 'user' as const, text: turn.userMessage },
            { from: 'anu' as const, text: turn.reply, isEscalation: turn.source === 'red_flag' },
          ]),
        );
        // Restore the chips from the last reply so a returning user picks up
        // where she left off.
        setSuggestions(data.turns.at(-1)?.suggestions ?? []);
      })
      .catch(() => {
        if (!cancelled) setError('Could not load your conversation.');
      })
      .finally(() => {
        if (!cancelled) setHistoryLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

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

      try {
        const data = await apiFetch<AnuChatResponse>('/api/anu/chat', {
          method: 'POST',
          body: JSON.stringify({ message: trimmed }),
        });
        setMessages((prev) => [
          ...prev,
          { from: 'anu', text: data.reply, isEscalation: data.source === 'red_flag' },
        ]);
        setSuggestions(data.suggestions);
      } catch {
        setError('ANU could not reply just now. Please try again.');
      } finally {
        setSending(false);
      }
    },
    [sending],
  );

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
  const chips = messages.length === 0 && !historyLoading ? openingPrompts : suggestions;

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
            aria-label="Back to home"
          >
            ←
          </button>

          <div className="relative">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-primary/30 bg-surface-container-low">
              <img src="/anu.png" alt="ANU avatar" className="h-6 w-6 object-contain" />
            </span>
            <span className="absolute -bottom-[1px] -right-[1px] h-2.5 w-2.5 rounded-full border-2 border-surface bg-primary" />
          </div>

          <div className="flex-1">
            <p
              className="text-[17px] text-on-surface"
              style={{ fontFamily: '"Fraunces", sans-serif', fontWeight: 500 }}
            >
              ANU
            </p>
            <p
              className="text-[10px] uppercase tracking-[0.08em] text-primary"
              style={{ fontFamily: '"Mulish", sans-serif' }}
            >
              ● Online · Remembers all
            </p>
          </div>

          <button
            type="button"
            className="bg-transparent p-0 text-[18px] text-outline"
            aria-label="More options"
          >
            ⋯
          </button>
        </section>

        <section className="flex items-center justify-center gap-1.5 bg-primary/15 px-3 py-1.5 text-[9.5px] uppercase tracking-[0.12em] text-primary">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <rect x="5" y="10" width="14" height="10" rx="2" stroke="#5E3566" strokeWidth="2" />
            <path d="M8 10V7a4 4 0 018 0v3" stroke="#5E3566" strokeWidth="2" />
          </svg>
          <span style={{ fontFamily: '"Mulish", sans-serif' }}>Encrypted on device</span>
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
            Tell ANU what you&apos;re feeling. She can explain what may be behind it and help you
            track it.
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
              <div
                className={`px-[14px] py-[10px] text-[14px] leading-[1.5] ${
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
              ANU is typing…
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
            <input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') void send(input);
              }}
              disabled={sending}
              placeholder="Share what you're feeling..."
              className="w-full border-none bg-transparent text-[16px] text-on-surface placeholder:text-outline [-webkit-tap-highlight-color:transparent] [outline:none] focus:[outline:none]"
              style={{ fontFamily: '"Mulish", -apple-system, system-ui, sans-serif' }}
            />
          </label>

          <button
            type="button"
            onClick={() => void send(input)}
            disabled={sending}
            className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-secondary disabled:opacity-50"
            aria-label="Send message"
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
