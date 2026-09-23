'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { streamBotChat, type BotChatTurn } from '@/lib/api/botChat';
import { cn } from '@/lib/cn';
import { readStoredSession } from '@/lib/session';

export function BotChatPanel({ disabled = false }: { disabled?: boolean }) {
  const [messages, setMessages] = useState<BotChatTurn[]>([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scroller = useRef<HTMLUListElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages]);

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  const clear = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setMessages([]);
    setError(null);
    setBusy(false);
    queueMicrotask(() => inputRef.current?.focus());
  };

  const send = async () => {
    const text = draft.trim();
    if (!text || busy || disabled) return;
    const session = readStoredSession();
    if (!session?.sessionToken) {
      setError('Sign in required');
      return;
    }

    const history = [...messages, { role: 'user' as const, content: text }];
    setDraft('');
    setError(null);
    setBusy(true);
    setMessages([...history, { role: 'assistant', content: '' }]);

    const ac = new AbortController();
    abortRef.current = ac;
    try {
      const full = await streamBotChat({
        sessionToken: session.sessionToken,
        messages: history,
        signal: ac.signal,
        onDelta: (delta) => {
          setMessages((cur) => {
            if (cur.length === 0) return cur;
            const next = [...cur];
            const last = next[next.length - 1];
            if (!last || last.role !== 'assistant') return cur;
            next[next.length - 1] = { role: 'assistant', content: last.content + delta };
            return next;
          });
        },
      });
      setMessages((cur) => {
        if (cur.length === 0) return cur;
        const next = [...cur];
        next[next.length - 1] = { role: 'assistant', content: full };
        return next;
      });
    } catch (err) {
      if (ac.signal.aborted) return;
      const message = err instanceof Error ? err.message : 'Bot chat is not available';
      setError(message);
      setMessages((cur) => {
        const last = cur[cur.length - 1];
        if (last?.role === 'assistant' && !last.content.trim()) {
          return cur.slice(0, -1);
        }
        return cur;
      });
    } finally {
      if (abortRef.current === ac) abortRef.current = null;
      setBusy(false);
    }
  };

  return (
    <div className="glass-sheet flex min-h-[28rem] flex-col overflow-hidden rounded-2xl border border-sidebar/12 shadow-[0_12px_32px_rgb(29_4_50/0.08)] sm:min-h-[32rem] lg:h-[min(70vh,42rem)]">
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-sidebar/10 px-4 py-3">
        <h2 className="font-display text-sm font-bold uppercase tracking-[0.16em] text-primary">
          BanterBot
        </h2>
        <Button type="button" variant="ghost" size="sm" onClick={clear} disabled={busy && !messages.length}>
          Clear
        </Button>
      </header>

      <ul
        ref={scroller}
        className="min-h-0 flex-1 space-y-2.5 overflow-y-auto px-3 py-4 sm:px-4"
        aria-live="polite"
        aria-label="Bot conversation"
      >
        {messages.length === 0 ? (
          <li className="flex h-full min-h-[12rem] flex-col items-center justify-center px-4 text-center">
            <p className="font-heading-sub">BanterBot</p>
            <p className="mt-1 max-w-[18rem] text-xs leading-relaxed text-muted">
              BanterBot is ready to roast you. Bring a take.
            </p>
          </li>
        ) : (
          messages.map((m, i) => {
            const isUser = m.role === 'user';
            const pending = !isUser && busy && i === messages.length - 1 && !m.content;
            return (
              <li
                key={`${m.role}-${i}`}
                className={cn(
                  'max-w-[92%] list-none rounded-2xl px-3.5 py-2.5',
                  isUser
                    ? 'ml-auto bg-sidebar text-on-chrome shadow-[0_6px_16px_rgb(29_4_50/0.16)]'
                    : 'glass-sheet mr-auto border border-sidebar/8 text-primary shadow-[0_2px_10px_rgb(29_4_50/0.05)]',
                )}
              >
                <p className="font-display text-[10px] font-bold uppercase tracking-[0.12em] opacity-70">
                  {isUser ? 'You' : 'BanterBot'}
                </p>
                <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-snug">
                  {pending ? '…' : m.content}
                </p>
              </li>
            );
          })
        )}
      </ul>

      {error ? (
        <p className="shrink-0 px-4 pb-2 text-xs text-danger" role="alert">
          {error}
        </p>
      ) : null}

      <form
        className="flex shrink-0 gap-2 border-t border-sidebar/10 p-3"
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
      >
        <textarea
          ref={inputRef}
          value={draft}
          disabled={disabled || busy}
          rows={1}
          placeholder={disabled ? 'Sign in to chat' : 'Say something…'}
          className="min-h-11 flex-1 resize-none rounded-xl border border-sidebar/15 bg-white/80 px-3 py-2.5 text-sm text-primary outline-none ring-sidebar/20 placeholder:text-muted focus:ring-2 disabled:opacity-60"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
        />
        <Button type="submit" variant="primary" disabled={disabled || busy || !draft.trim()}>
          Send
        </Button>
      </form>
    </div>
  );
}
