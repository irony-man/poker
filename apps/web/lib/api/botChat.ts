import { apiBase, parseError, sessionHeaders } from '@/lib/api/client';

export type BotChatPersona = 'banter';

export type BotChatLlmProvider = 'cohere' | 'boost';

export const BOT_CHAT_UI_PROVIDERS: readonly BotChatLlmProvider[] = ['cohere', 'boost'] as const;

export type BotChatRole = 'user' | 'assistant';

export interface BotChatTurn {
  role: BotChatRole;
  content: string;
}

export const BOT_CHAT_LLM_PROVIDER_LABELS: Record<BotChatLlmProvider, string> = {
  cohere: 'Quick roast',
  boost: 'Boost bot',
};

export const BOT_CHAT_ASSISTANT_LABELS: Record<BotChatLlmProvider, string> = {
  cohere: 'BanterBot',
  boost: 'Boost bot',
};

export const BOT_CHAT_ASSISTANT_EMOJI: Record<BotChatLlmProvider, string> = {
  cohere: '🔥',
  boost: '⚡',
};

export const BOT_CHAT_STARTER_PROMPTS: readonly string[] = [
  'I slow-played pocket aces and still lost.',
  'Is open-limping ever defensible?',
  'I pushed code to prod without testing.',
  'Rate my bluff: I had seven-high.',
  'I called a river bet with middle pair. Again.',
];

export const BOT_CHAT_LLM_STORAGE_KEY = 'poker.banterbot.llmProvider';

/** Per-backend thread persistence (sessionStorage). */
export const BOT_CHAT_THREADS_STORAGE_KEY = 'poker.banterbot.threads';

export type BotChatThreadsByProvider = Record<BotChatLlmProvider, BotChatTurn[]>;

export function emptyBotChatThreads(): BotChatThreadsByProvider {
  return { cohere: [], boost: [] };
}

export function readStoredBotChatThreads(): BotChatThreadsByProvider {
  if (typeof window === 'undefined') return emptyBotChatThreads();
  try {
    const raw = sessionStorage.getItem(BOT_CHAT_THREADS_STORAGE_KEY);
    if (!raw) return emptyBotChatThreads();
    const parsed = JSON.parse(raw) as Partial<Record<string, unknown>>;
    const cohere = normalizeTurns(parsed.cohere);
    const boost =
      normalizeTurns(parsed.boost).length > 0
        ? normalizeTurns(parsed.boost)
        : normalizeTurns(parsed.fungpt);
    return { cohere, boost };
  } catch {
    return emptyBotChatThreads();
  }
}

function normalizeTurns(value: unknown): BotChatTurn[] {
  if (!Array.isArray(value)) return [];
  const out: BotChatTurn[] = [];
  for (const item of value) {
    if (!item || typeof item !== 'object') continue;
    const role = (item as { role?: unknown }).role;
    const content = (item as { content?: unknown }).content;
    if ((role === 'user' || role === 'assistant') && typeof content === 'string') {
      out.push({ role, content });
    }
  }
  return out;
}

export function writeStoredBotChatThreads(threads: BotChatThreadsByProvider): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(BOT_CHAT_THREADS_STORAGE_KEY, JSON.stringify(threads));
  } catch {
    /* quota / private mode */
  }
}

export async function fetchBotChatProviders(sessionToken: string): Promise<{
  providers: BotChatLlmProvider[];
  default: BotChatLlmProvider | null;
  starters: string[];
}> {
  const res = await fetch(`${apiBase()}/api/bot-chat/providers`, {
    headers: sessionHeaders(sessionToken),
  });
  if (!res.ok) {
    return { providers: [], default: null, starters: [...BOT_CHAT_STARTER_PROMPTS] };
  }
  const data = (await res.json()) as {
    providers?: string[];
    default?: string | null;
    starters?: unknown;
  };
  const providers = (data.providers ?? []).filter(
    (p): p is BotChatLlmProvider => p === 'cohere' || p === 'boost',
  );
  const defRaw = data.default;
  let def: BotChatLlmProvider | null = null;
  if (defRaw === 'cohere' || defRaw === 'boost') def = defRaw;
  else if (defRaw === 'fungpt') def = 'boost';
  const starters = normalizeStarterList(data.starters);
  return { providers, default: def, starters };
}

function normalizeStarterList(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [...BOT_CHAT_STARTER_PROMPTS];
  const out: string[] = [];
  for (const item of raw) {
    if (typeof item !== 'string') continue;
    const t = item.trim();
    if (t) out.push(t);
  }
  return out.length > 0 ? out : [...BOT_CHAT_STARTER_PROMPTS];
}

export async function streamBotChat(opts: {
  sessionToken: string;
  messages: BotChatTurn[];
  onDelta: (delta: string) => void;
  signal?: AbortSignal;
  persona?: BotChatPersona;
  llmProvider: BotChatLlmProvider;
}): Promise<string> {
  const res = await fetch(`${apiBase()}/api/bot-chat`, {
    method: 'POST',
    headers: sessionHeaders(opts.sessionToken),
    body: JSON.stringify({
      persona: opts.persona ?? 'banter',
      messages: opts.messages,
      llmProvider: opts.llmProvider,
      stream: false,
    }),
    signal: opts.signal,
  });

  const contentType = res.headers.get('content-type') ?? '';
  if (!res.ok) {
    throw new Error(await parseError(res, 'Bot chat is not available'));
  }

  if (!contentType.includes('text/event-stream') || !res.body) {
    const data = (await res.json()) as { text?: string; error?: string };
    if (data.error) throw new Error(data.error);
    const text = data.text?.trim() ?? '';
    if (!text) throw new Error('Bot chat is not available');
    opts.onDelta(text);
    return text;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  let assembled = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const parts = buf.split('\n\n');
    buf = parts.pop() ?? '';
    for (const part of parts) {
      const line = part.split('\n').find((l) => l.startsWith('data: '));
      if (!line) continue;
      const data = line.slice(6).trim();
      if (!data || data === '[DONE]') continue;
      let parsed: { delta?: string; error?: string };
      try {
        parsed = JSON.parse(data) as { delta?: string; error?: string };
      } catch {
        continue;
      }
      if (parsed.error) throw new Error(parsed.error);
      if (parsed.delta) {
        assembled += parsed.delta;
        opts.onDelta(parsed.delta);
      }
    }
  }
  if (!assembled.trim()) throw new Error('Bot chat is not available');
  return assembled;
}
