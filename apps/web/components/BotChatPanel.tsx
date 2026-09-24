'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { AppleEmoji } from '@/components/AppleEmoji';
import { Button } from '@/components/ui/Button';
import { StatusChip } from '@/components/ui/StatusChip';
import { PlayerAvatar } from '@/components/PlayerAvatar';
import {
  BOT_CHAT_ASSISTANT_EMOJI,
  BOT_CHAT_ASSISTANT_LABELS,
  BOT_CHAT_LLM_PROVIDER_LABELS,
  BOT_CHAT_LLM_STORAGE_KEY,
  BOT_CHAT_UI_PROVIDERS,
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
import { loadSavedAvatarId } from '@/lib/avatars';
import { cn } from '@/lib/cn';
import { readStoredSession } from '@/lib/session';
import { useSession } from '@/lib/store';

const MESSAGE_AVATAR_SIZE = 36;

function BotChatAssistantAvatar({
  provider,
  size = MESSAGE_AVATAR_SIZE,
}: {
  provider: BotChatLlmProvider;
  size?: number;
}) {
  const label = BOT_CHAT_ASSISTANT_LABELS[provider];
  const emoji = BOT_CHAT_ASSISTANT_EMOJI[provider];
  return (
    <div
      className="bot-chat-assistant-avatar flex shrink-0 items-center justify-center rounded-full"
      style={{ width: size, height: size }}
      title={label}
      aria-hidden
    >
      <AppleEmoji emoji={emoji} size={Math.round(size * 0.52)} decorative />
    </div>
  );
}

function readStoredProvider(): BotChatLlmProvider | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem(BOT_CHAT_LLM_STORAGE_KEY);
  if (raw === 'cohere' || raw === 'boost') return raw;
  if (raw === 'fungpt') return 'boost';
  return null;
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
    boost: emptyProviderUi(),
  });
  const [busyProvider, setBusyProvider] = useState<BotChatLlmProvider | null>(null);
  const [availableProviders, setAvailableProviders] = useState<BotChatLlmProvider[]>([
    'cohere',
    'boost',
  ]);
  const [llmProvider, setLlmProvider] = useState<BotChatLlmProvider>(
    () => readStoredProvider() ?? 'cohere',
  );
  const [starters, setStarters] = useState<string[]>(() => [...BOT_CHAT_STARTER_PROMPTS]);
  const scroller = useRef<HTMLUListElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const userId = useSession((s) => s.userId);
  const displayName = useSession((s) => s.name);
  const [avatarId, setAvatarId] = useState(0);

  useEffect(() => {
    if (disabled) return;
    setAvatarId(loadSavedAvatarId());
  }, [disabled, userId]);

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

  const anyThreadBusy = busyProvider !== null;

  useEffect(() => {
    if (disabled || anyThreadBusy) return;
    const id = window.requestAnimationFrame(() => {
      inputRef.current?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(id);
  }, [disabled, anyThreadBusy, llmProvider]);

  useEffect(() => {
    const session = readStoredSession();
    if (!session?.sessionToken) return;
    void fetchBotChatProviders(session.sessionToken).then(({ providers, default: def, starters: next }) => {
      if (next.length > 0) setStarters(next);
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

  return (
    <div className="chat-panel-shell bot-chat-panel relative flex min-h-0 flex-1 flex-col overflow-hidden bg-transparent">
      <header className="bot-chat-surface shrink-0 border-b border-sidebar/15 px-3 py-2.5 sm:px-4">
        <div className="flex items-center gap-2 sm:gap-3">
          <div
            className="flex min-w-0 flex-1 rounded-xl border border-sidebar/12 bg-sidebar/[0.04] p-1"
            role="group"
            aria-label="BanterBot mode"
          >
              {BOT_CHAT_UI_PROVIDERS.map((id) => {
                const on = llmProvider === id;
                const available = availableProviders.includes(id);
                const threadCount = threads[id].length;
                return (
                  <button
                    key={id}
                    type="button"
                    disabled={disabled || anyThreadBusy || !available}
                    title={available ? undefined : 'This mode is unavailable right now'}
                    aria-pressed={on}
                    onClick={() => setLlmProvider(id)}
                    className={cn(
                      'relative flex-1 rounded-lg px-2 py-2.5 text-xs font-display font-semibold uppercase tracking-[0.08em] transition sm:text-xs',
                      on
                        ? 'bg-sidebar text-on-chrome shadow-[0_4px_12px_rgb(29_4_50/0.2)]'
                        : 'text-primary hover:bg-sidebar/[0.06]',
                      !available && 'cursor-not-allowed opacity-45',
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
          <button
            type="button"
            onClick={clear}
            disabled={busy || messages.length === 0}
            className="bot-chat-surface shrink-0 rounded-full border border-sidebar/20 px-3 py-2 text-xs font-display font-semibold uppercase tracking-wider text-primary transition hover:border-sidebar/35 disabled:opacity-40"
          >
            Clear chat
          </button>
        </div>
      </header>

      <ul
        ref={scroller}
        className="flex min-h-0 flex-1 flex-col space-y-3 overflow-y-auto px-3 py-4 sm:px-5"
        aria-live="polite"
        aria-relevant="additions"
        aria-label="Messages with BanterBot"
        role="log"
      >
        {empty ? (
          <li className="flex list-none flex-1 flex-col items-center justify-center gap-3 px-2 py-3 text-center sm:gap-4 sm:py-5">
            <BotChatAssistantAvatar provider={llmProvider} size={48} />
            <div className="max-w-sm">
              <p className="font-heading-sub">Your move</p>
              <p className="mt-1 text-sm leading-relaxed text-muted">
                Pick a starter below or type something worth a roast.
              </p>
            </div>
            <div
              className="w-full max-w-lg space-y-2.5"
              role="group"
              aria-labelledby="bot-chat-starters-heading"
            >
              <p
                id="bot-chat-starters-heading"
                className="text-sm font-display font-semibold uppercase tracking-[0.1em] text-primary"
              >
                Starters
              </p>
              <div className="flex flex-col gap-2.5 sm:grid sm:grid-cols-2">
                {starters.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    disabled={disabled || anyThreadBusy}
                    onClick={() => void sendMessage(prompt)}
                    className="bot-chat-starter-pill flex items-start gap-2.5 rounded-xl px-3 py-3 text-left text-sm font-medium leading-snug"
                  >
                    <BotChatAssistantAvatar provider={llmProvider} size={28} />
                    <span className="min-w-0 flex-1 pt-0.5">{prompt}</span>
                  </button>
                ))}
              </div>
            </div>
          </li>
        ) : (
          messages.map((m, i) => {
            const isUser = m.role === 'user';
            const pending = !isUser && busy && i === messages.length - 1 && !m.content;
            const speaker = isUser ? 'You' : BOT_CHAT_ASSISTANT_LABELS[llmProvider];
            return (
              <li
                key={`${llmProvider}-${m.role}-${i}`}
                className={cn(
                  'bot-chat-message-row list-none',
                  isUser ? 'bot-chat-message-row--user' : 'bot-chat-message-row--assistant',
                )}
              >
                {isUser ? (
                  <PlayerAvatar
                    avatarId={avatarId}
                    userId={userId}
                    size={MESSAGE_AVATAR_SIZE}
                    className="bot-chat-user-avatar ring-2 ring-sidebar/20"
                    title={displayName || 'You'}
                  />
                ) : (
                  <BotChatAssistantAvatar provider={llmProvider} />
                )}
                <article
                  className={cn(
                    'bot-chat-message-bubble min-w-0',
                    isUser
                      ? 'bot-chat-message-bubble--user'
                      : 'bot-chat-message-bubble--assistant bot-chat-bubble-assistant border',
                  )}
                >
                  <p
                    className={cn(
                      'font-display text-[11px] font-bold uppercase tracking-[0.1em]',
                      isUser ? 'text-on-chrome/85' : 'text-muted',
                    )}
                  >
                    {speaker}
                  </p>
                  <p
                    className={cn(
                      'mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed',
                      isUser ? 'text-on-chrome' : 'text-primary',
                    )}
                  >
                    {pending ? (
                      <span aria-busy="true" aria-label="BanterBot is typing">
                        …
                      </span>
                    ) : (
                      m.content
                    )}
                  </p>
                </article>
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
        <div className="shrink-0 border-t border-sidebar/15 px-3 py-2 sm:px-5">
          <div
            className="flex gap-2 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            role="group"
            aria-label="Quick starters"
          >
            {starters.slice(0, 4).map((prompt) => (
              <button
                key={`foot-${prompt}`}
                type="button"
                disabled={disabled || anyThreadBusy}
                onClick={() => void sendMessage(prompt)}
                className="bot-chat-starter-pill bot-chat-starter-pill--chip flex shrink-0 items-center gap-2 rounded-full py-2 pl-2 pr-3.5 text-xs font-medium"
              >
                <BotChatAssistantAvatar provider={llmProvider} size={26} />
                <span className="max-w-[14rem] truncate">
                  {prompt.length > 36 ? `${prompt.slice(0, 34)}…` : prompt}
                </span>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="bot-chat-surface shrink-0 border-t border-sidebar/15 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2.5 sm:px-4">
        <form
          className="bot-chat-composer"
          aria-label="Send a message to BanterBot"
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
            placeholder={disabled ? 'Sign in to chat' : llmProvider === 'cohere' ? 'Roast me…' : 'Boost me…'}
            aria-label={llmProvider === 'cohere' ? 'Message to BanterBot' : 'Message to BoostBot'}
            className="max-h-28 min-h-[2.75rem] min-w-0 flex-1 resize-none border-0 bg-transparent py-2 text-base font-body text-primary shadow-none placeholder:text-muted disabled:opacity-60 sm:text-sm"
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
