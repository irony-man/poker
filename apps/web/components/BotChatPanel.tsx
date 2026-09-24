'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { AppleEmoji } from '@/components/AppleEmoji';
import { Button } from '@/components/ui/Button';
import { StatusChip } from '@/components/ui/StatusChip';
import {
  BOT_CHAT_LLM_PROVIDER_LABELS,
  BOT_CHAT_LLM_STORAGE_KEY,
  BOT_CHAT_STARTER_PROMPTS,
  emptyBotChatThreads,
  fetchBotChatProviders,
  readStoredBotChatThreads,
  streamBotChat,
  writeStoredBotChatThreads,
  type BotChatLlmProvider,
  type BotChatThreadsByProvider,
  type BotChatTurn,
} from '@/lib/api/botChat';
import { cn } from '@/lib/cn';
import { readStoredSession } from '@/lib/session';

function readStoredProvider(): BotChatLlmProvider | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem(BOT_CHAT_LLM_STORAGE_KEY);
  return raw === 'cohere' || raw === 'fungpt' ? raw : null;
}

type ProviderUiState = {
  draft: string;
  error: string | null;
};

function emptyProviderUi(): ProviderUiState {
  return { draft: '', error: null };
}

export function BotChatPanel({ disabled = false }: { disabled?: boolean }) {
  const [threads, setThreads] = useState<BotChatThreadsByProvider>(() => emptyBotChatThreads());
  const [threadsHydrated, setThreadsHydrated] = useState(false);
  const [uiByProvider, setUiByProvider] = useState<Record<BotChatLlmProvider, ProviderUiState>>({
    cohere: emptyProviderUi(),
    fungpt: emptyProviderUi(),
  });
  const [busyProvider, setBusyProvider] = useState<BotChatLlmProvider | null>(null);
  const [availableProviders, setAvailableProviders] = useState<BotChatLlmProvider[]>([
    'cohere',
    'fungpt',
  ]);
  const [llmProvider, setLlmProvider] = useState<BotChatLlmProvider>(
    () => readStoredProvider() ?? 'cohere',
  );
  const scroller = useRef<HTMLUListElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const messages = threads[llmProvider];
  const draft = uiByProvider[llmProvider].draft;
  const error = uiByProvider[llmProvider].error;
  const busy = busyProvider === llmProvider;

  useEffect(() => {
    setThreads(readStoredBotChatThreads());
    setThreadsHydrated(true);
  }, []);

  useEffect(() => {
    if (!threadsHydrated) return;
    writeStoredBotChatThreads(threads);
  }, [threads, threadsHydrated]);

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, llmProvider]);

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  useEffect(() => {
    const session = readStoredSession();
    if (!session?.sessionToken) return;
    void fetchBotChatProviders(session.sessionToken).then(({ providers, default: def }) => {
      if (providers.length === 0) return;
      setAvailableProviders(providers);
      const stored = readStoredProvider();
      if (stored && providers.includes(stored)) {
        setLlmProvider(stored);
        return;
      }
      if (def && providers.includes(def)) setLlmProvider(def);
      else setLlmProvider(providers[0]!);
    });
  }, [disabled]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(BOT_CHAT_LLM_STORAGE_KEY, llmProvider);
  }, [llmProvider]);

  const patchUi = useCallback((provider: BotChatLlmProvider, patch: Partial<ProviderUiState>) => {
    setUiByProvider((cur) => ({ ...cur, [provider]: { ...cur[provider], ...patch } }));
  }, []);

  const patchThread = useCallback(
    (provider: BotChatLlmProvider, updater: (cur: BotChatTurn[]) => BotChatTurn[]) => {
      setThreads((cur) => ({ ...cur, [provider]: updater(cur[provider]) }));
    },
    [],
  );

  const clear = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    patchThread(llmProvider, () => []);
    patchUi(llmProvider, { error: null });
    setBusyProvider((p) => (p === llmProvider ? null : p));
    queueMicrotask(() => inputRef.current?.focus());
  };

  const sendMessage = useCallback(
    async (rawText: string) => {
      const text = rawText.trim();
      const provider = llmProvider;
      if (!text || busyProvider !== null || disabled) return;
      const session = readStoredSession();
      if (!session?.sessionToken) {
        patchUi(provider, { error: 'Sign in required' });
        return;
      }

      const history = [...threads[provider], { role: 'user' as const, content: text }];
      patchUi(provider, { draft: '', error: null });
      setBusyProvider(provider);
      patchThread(provider, () => [...history, { role: 'assistant', content: '' }]);

      const ac = new AbortController();
      abortRef.current = ac;
      try {
        const full = await streamBotChat({
          sessionToken: session.sessionToken,
          messages: history,
          llmProvider: provider,
          signal: ac.signal,
          onDelta: (delta) => {
            patchThread(provider, (cur) => {
              if (cur.length === 0) return cur;
              const next = [...cur];
              const last = next[next.length - 1];
              if (!last || last.role !== 'assistant') return cur;
              next[next.length - 1] = { role: 'assistant', content: last.content + delta };
              return next;
            });
          },
        });
        patchThread(provider, (cur) => {
          if (cur.length === 0) return cur;
          const next = [...cur];
          next[next.length - 1] = { role: 'assistant', content: full };
          return next;
        });
      } catch (err) {
        if (ac.signal.aborted) return;
        const message = err instanceof Error ? err.message : 'Bot chat is not available';
        patchUi(provider, { error: message });
        patchThread(provider, (cur) => {
          const last = cur[cur.length - 1];
          if (last?.role === 'assistant' && !last.content.trim()) {
            return cur.slice(0, -1);
          }
          return cur;
        });
      } finally {
        if (abortRef.current === ac) abortRef.current = null;
        setBusyProvider((p) => (p === provider ? null : p));
      }
    },
    [busyProvider, disabled, llmProvider, patchThread, patchUi, threads],
  );

  const send = () => void sendMessage(draft);

  const empty = messages.length === 0 && !busy;
  const anyThreadBusy = busyProvider !== null;

  return (
    <div className="chat-panel-shell bot-chat-panel relative flex h-[min(78vh,44rem)] max-h-[44rem] flex-col overflow-hidden rounded-2xl border border-sidebar/12 shadow-[0_16px_48px_rgb(29_4_50/0.12)]">
      <header className="glass-sheet shrink-0 border-b border-sidebar/10 px-4 py-3.5 backdrop-blur-sm sm:px-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="font-kicker-sidebar text-[10px] uppercase tracking-[0.18em] text-muted">
              Reply backend
            </p>
            <div
              className="mt-2 flex max-w-md rounded-xl border border-sidebar/12 bg-sidebar/[0.04] p-1"
              role="group"
              aria-label="Chat model backend"
            >
              {(['cohere', 'fungpt'] as const).map((id) => {
                const on = llmProvider === id;
                const available = availableProviders.includes(id);
                const threadCount = threads[id].length;
                return (
                  <button
                    key={id}
                    type="button"
                    disabled={disabled || anyThreadBusy || !available}
                    title={
                      available
                        ? undefined
                        : `${BOT_CHAT_LLM_PROVIDER_LABELS[id]} is not configured on the server`
                    }
                    onClick={() => setLlmProvider(id)}
                    className={cn(
                      'relative flex-1 rounded-lg px-2 py-2 text-xs font-display font-semibold uppercase tracking-[0.08em] transition sm:text-[11px]',
                      on
                        ? 'bg-sidebar text-on-chrome shadow-[0_4px_12px_rgb(29_4_50/0.2)]'
                        : 'text-muted hover:text-primary',
                      !available && 'cursor-not-allowed opacity-35',
                    )}
                  >
                    {BOT_CHAT_LLM_PROVIDER_LABELS[id]}
                    {threadCount > 0 && !on ? (
                      <span
                        className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-sidebar"
                        aria-hidden
                      />
                    ) : null}
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-xs leading-relaxed text-muted">
              Active:{' '}
              <span className="font-semibold text-sidebar">
                {BOT_CHAT_LLM_PROVIDER_LABELS[llmProvider]}
              </span>
              {llmProvider === 'cohere' ? ' · hosted, low latency' : ' · local BanterBot model'}
              <span className="text-muted"> · separate thread per backend</span>
            </p>
          </div>
          <button
            type="button"
            onClick={clear}
            disabled={busy || messages.length === 0}
            className="glass-sheet shrink-0 rounded-full border border-sidebar/15 px-3 py-1.5 text-[10px] font-display font-semibold uppercase tracking-wider text-muted shadow-[0_2px_8px_rgb(29_4_50/0.06)] transition hover:border-sidebar/30 hover:text-sidebar disabled:opacity-40"
          >
            Clear
          </button>
        </div>
      </header>

      <ul
        ref={scroller}
        className="flex min-h-0 flex-1 flex-col space-y-3 overflow-y-auto px-3 py-4 sm:px-5"
        aria-live="polite"
        aria-label="Bot conversation"
      >
        {empty ? (
          <li className="flex list-none flex-1 flex-col items-center justify-center gap-4 px-2 py-4 text-center sm:gap-5 sm:py-6">
            <div className="glass-sheet flex h-14 w-14 items-center justify-center rounded-2xl border border-sidebar/10 shadow-[0_6px_18px_rgb(29_4_50/0.08)]">
              <AppleEmoji emoji="🔥" size={32} decorative />
            </div>
            <div className="max-w-sm">
              <p className="font-heading-sub">Ready when you are</p>
              <p className="mt-1.5 text-sm leading-relaxed text-muted">
                Tap a starter below or write your own. Cohere and FunGPT each keep their own
                conversation.
              </p>
            </div>
            <div className="w-full max-w-lg space-y-2.5">
              <p className="font-kicker-sidebar text-[10px] uppercase tracking-[0.14em] text-muted">
                Try saying
              </p>
              <div className="flex flex-col gap-2 sm:grid sm:grid-cols-2">
                {BOT_CHAT_STARTER_PROMPTS.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    disabled={disabled || anyThreadBusy}
                    onClick={() => void sendMessage(prompt)}
                    className="glass-sheet rounded-xl border border-sidebar/10 px-3.5 py-2.5 text-left text-sm leading-snug text-primary shadow-[0_2px_10px_rgb(29_4_50/0.05)] transition hover:border-sidebar/22 hover:shadow-[0_4px_14px_rgb(29_4_50/0.08)] disabled:opacity-50"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          </li>
        ) : (
          messages.map((m, i) => {
            const isUser = m.role === 'user';
            const pending = !isUser && busy && i === messages.length - 1 && !m.content;
            return (
              <li
                key={`${llmProvider}-${m.role}-${i}`}
                className={cn(
                  'max-w-[min(100%,22rem)] list-none rounded-2xl px-3.5 py-2.5',
                  isUser
                    ? 'ml-auto bg-sidebar text-on-chrome shadow-[0_6px_16px_rgb(29_4_50/0.18)]'
                    : 'glass-sheet mr-auto border border-sidebar/8 shadow-[0_2px_10px_rgb(29_4_50/0.05)]',
                )}
              >
                <p
                  className={cn(
                    'font-display text-[10px] font-bold uppercase tracking-[0.12em]',
                    isUser ? 'text-on-chrome/75' : 'text-sidebar',
                  )}
                >
                  {isUser ? 'You' : 'BanterBot'}
                </p>
                <p
                  className={cn(
                    'mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed',
                    isUser ? 'text-on-chrome' : 'text-primary',
                  )}
                >
                  {pending ? '…' : m.content}
                </p>
              </li>
            );
          })
        )}
      </ul>

      {error ? (
        <div className="shrink-0 px-4 pb-2 sm:px-5">
          <StatusChip tone="danger" role="alert" className="w-full text-xs">
            {error}
          </StatusChip>
        </div>
      ) : null}

      {!empty ? (
        <div className="shrink-0 border-t border-sidebar/8 px-3 py-2 sm:px-5">
          <div className="flex gap-2 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {BOT_CHAT_STARTER_PROMPTS.slice(0, 4).map((prompt) => (
              <button
                key={`foot-${prompt}`}
                type="button"
                disabled={disabled || anyThreadBusy}
                onClick={() => void sendMessage(prompt)}
                className="shrink-0 rounded-full border border-sidebar/12 bg-white/80 px-3 py-1 text-[11px] font-medium text-sidebar hover:border-sidebar/25 hover:bg-white disabled:opacity-50"
              >
                {prompt.length > 36 ? `${prompt.slice(0, 34)}…` : prompt}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="glass-sheet shrink-0 border-t border-sidebar/10 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2.5 backdrop-blur-sm sm:px-4">
        <form
          className="glass-sheet flex items-end gap-2 rounded-2xl border border-sidebar/12 p-1.5 pl-3 shadow-[0_4px_16px_rgb(29_4_50/0.06)]"
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
        >
          <textarea
            ref={inputRef}
            value={draft}
            disabled={disabled || anyThreadBusy}
            rows={1}
            placeholder={disabled ? 'Sign in to chat' : 'Roast me…'}
            className="max-h-28 min-h-[2.5rem] min-w-0 flex-1 resize-none bg-transparent py-2 text-sm font-body text-primary outline-none placeholder:text-muted disabled:opacity-60"
            onChange={(e) => patchUi(llmProvider, { draft: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
          />
          <Button
            type="submit"
            disabled={disabled || anyThreadBusy || !draft.trim()}
            className="shrink-0 min-h-0 rounded-xl px-4 py-2.5 text-[11px] disabled:cursor-not-allowed"
          >
            Send
          </Button>
        </form>
      </div>
    </div>
  );
}
