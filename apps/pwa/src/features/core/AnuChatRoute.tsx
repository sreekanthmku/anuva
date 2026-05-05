import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BottomNav } from './components/BottomNav';

type ChatMessage = {
  from: 'anu' | 'user';
  text: string;
};

const initialMessages: ChatMessage[] = [
  {
    from: 'anu',
    text: 'Good morning, Priya. I noticed your sleep was interrupted twice last night. Would you like to talk about it?',
  },
  { from: 'user', text: 'I woke up drenched around 3am.' },
  {
    from: 'anu',
    text: 'That sounds exhausting. A hot flash during REM is common in early perimenopause - not dangerous, but worth tracking. Want me to log it and suggest a cooling ritual for tonight?',
  },
];

const quickReplies = ['Yes, log it', 'Tell me more', 'What helps most?', 'Should I see a doctor?'];

export default function AnuChatRoute() {
  const navigate = useNavigate();
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [input, setInput] = useState('');
  const messageListRef = useRef<HTMLElement | null>(null);
  const messageEndRef = useRef<HTMLDivElement | null>(null);

  const send = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;

    setMessages((prev) => [...prev, { from: 'user', text: trimmed }]);
    setInput('');

    window.setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        {
          from: 'anu',
          text: "Logged. I'll dim your notifications after 9pm and queue a 3-minute breathing exercise for 9:30. Small shifts, repeated nightly, make the biggest difference.",
        },
      ]);
    }, 600);
  };

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      if (messageEndRef.current) {
        messageEndRef.current.scrollIntoView({ block: 'end' });
        return;
      }
      if (messageListRef.current) {
        messageListRef.current.scrollTop = messageListRef.current.scrollHeight;
      }
    });

    return () => window.cancelAnimationFrame(frame);
  }, [messages]);

  return (
    <main className="min-h-mobile flex flex-col bg-surface text-on-surface">
      <header className="sticky top-0 z-40 shrink-0 bg-surface shadow-[0_1px_0_0_rgba(167,139,250,0.2)]">
        <section className="flex items-center gap-3 border-b border-border-default px-[22px] pb-3.5 pt-[max(0.875rem,env(safe-area-inset-top))]">
          <button
            type="button"
            onClick={() => navigate('/home')}
            className="bg-transparent p-0 text-[18px] leading-none text-on-surface-variant"
            style={{ fontFamily: '"Geist", -apple-system, system-ui, sans-serif' }}
            aria-label="Back to home"
          >
            ←
          </button>

          <div className="relative">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-primary/30 bg-surface-container-low">
              <img src="/anu.png" alt="ANU avatar" className="h-6 w-6 object-contain" />
            </span>
            <span className="absolute -bottom-[1px] -right-[1px] h-2.5 w-2.5 rounded-full border-2 border-surface bg-primary shadow-[0_0_8px_#cebdff]" />
          </div>

          <div className="flex-1">
            <p className="text-[17px] text-on-surface" style={{ fontFamily: '"Fraunces Variable", "Fraunces", Georgia, serif', fontWeight: 500 }}>
              ANU
            </p>
            <p className="text-[10px] uppercase tracking-[0.08em] text-primary" style={{ fontFamily: '"Geist Mono", ui-monospace, monospace' }}>
              ● Online · Remembers all
            </p>
          </div>

          <button type="button" className="bg-transparent p-0 text-[18px] text-outline" aria-label="More options">
            ⋯
          </button>
        </section>

        <section className="flex items-center justify-center gap-1.5 bg-primary/15 px-[22px] py-1.5 text-[9.5px] uppercase tracking-[0.12em] text-primary">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <rect x="5" y="10" width="14" height="10" rx="2" stroke="#cebdff" strokeWidth="2" />
            <path d="M8 10V7a4 4 0 018 0v3" stroke="#cebdff" strokeWidth="2" />
          </svg>
          <span style={{ fontFamily: '"Geist Mono", ui-monospace, monospace' }}>Encrypted on device</span>
        </section>
      </header>

      <section ref={messageListRef} className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto px-4 pb-[168px] pt-[18px]">
        <p className="mb-1 text-center text-[9.5px] uppercase tracking-[0.15em] text-outline" style={{ fontFamily: '"Geist Mono", ui-monospace, monospace' }}>
          Today · 8:12 AM
        </p>

        {messages.map((message, index) => {
          const isUser = message.from === 'user';

          return (
            <div key={`${message.from}-${index}`} className={`flex max-w-[82%] items-end gap-2 ${isUser ? 'ml-auto flex-row-reverse' : ''}`}>
              {!isUser && <img src="/anu.png" alt="" className="h-6 w-6 shrink-0 rounded-full border border-border-default bg-surface-container-low p-1" />}
              <div
                className={`px-[14px] py-[10px] text-[14px] leading-[1.45] ${
                  isUser
                    ? 'rounded-[20px_20px_4px_20px] bg-secondary text-inverse-on-surface'
                    : 'rounded-[20px_20px_20px_4px] border border-border-default bg-surface-container-low text-on-surface'
                }`}
                style={{ fontFamily: '"Geist", -apple-system, system-ui, sans-serif' }}
              >
                {message.text}
              </div>
            </div>
          );
        })}
        <div ref={messageEndRef} />
      </section>

      <section className="fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom,0px)+68px)] z-40 bg-surface">
        <section className="no-scrollbar overflow-x-auto border-t border-border-default px-4 py-2">
          <div className="flex gap-1.5">
            {quickReplies.map((reply) => (
              <button
                key={reply}
                type="button"
                onClick={() => send(reply)}
                className="shrink-0 rounded-full border border-primary/30 bg-primary/15 px-3.5 py-[7px] text-[12px] font-medium text-primary"
                style={{ fontFamily: '"Geist", -apple-system, system-ui, sans-serif' }}
              >
                {reply}
              </button>
            ))}
          </div>
        </section>

        <section className="flex items-center gap-2.5 bg-surface px-5 pb-2 pt-1.5">
          <label className="flex flex-1 items-center gap-2 rounded-full border border-border-default bg-surface-container-low px-5 py-1.5">
            <input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') send(input);
              }}
              placeholder="Share what you're feeling..."
              className="w-full border-none bg-transparent text-[14px] text-on-surface outline-none placeholder:text-outline"
              style={{ fontFamily: '"Geist", -apple-system, system-ui, sans-serif' }}
            />
          </label>

          <button
            type="button"
            onClick={() => send(input)}
            className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-secondary"
            aria-label="Send message"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M4 12l16-7-7 16-2-7-7-2z" stroke="#322f37" strokeWidth="1.8" strokeLinejoin="round" />
            </svg>
          </button>
        </section>
      </section>

      <BottomNav />
    </main>
  );
}

