import {
  DEFAULT_BANTER_MODEL,
  DEFAULT_BOOST_CHAT_MODEL,
  DEFAULT_COHERE_CHAT_MODEL,
  type BotChatPersona,
} from './bot-chat.prompts.js';

/** Lobby `/chat` backends (hosted only in UI; table banter may still use FunGPT sidecar). */
export type BotChatLlmProvider = 'cohere' | 'boost';

export const BOT_CHAT_LLM_PROVIDERS: readonly BotChatLlmProvider[] = ['cohere', 'boost'] as const;

export interface BotChatRuntimeConfig {
  provider: BotChatLlmProvider;
  baseUrl: string;
  apiKey: string | null;
  path: string;
  model: string;
}

const DEFAULT_PATH = '/v1/chat/completions';

/** Bearer for FunGPT sidecar / table banter (not lobby boost). */
export function resolveSidecarApiKey(): string | null {
  const key =
    process.env.FUNGPT_API_KEY?.trim() || process.env.BANTER_LLM_API_KEY?.trim() || '';
  return key || null;
}

function resolveChatPath(baseUrl: string, explicitPath?: string): string {
  let path =
    explicitPath?.trim() ||
    (baseUrl.includes('cohere.ai/compatibility') ? '/chat/completions' : '') ||
    process.env.BANTER_LLM_PATH?.trim() ||
    DEFAULT_PATH;
  if (baseUrl.includes('cohere.ai/compatibility') && path.startsWith('/v1/')) {
    path = path.replace(/^\/v1/, '') || '/chat/completions';
  }
  return path;
}

function resolveCohereLobbyConfig(): BotChatRuntimeConfig | null {
  const baseUrl = (process.env.BOT_CHAT_LLM_BASE_URL ?? '').trim().replace(/\/$/, '');
  if (!baseUrl) return null;
  const chatPath = process.env.BOT_CHAT_LLM_PATH?.trim();
  return {
    provider: 'cohere',
    baseUrl,
    apiKey: (process.env.BOT_CHAT_LLM_API_KEY ?? '').trim() || null,
    path: resolveChatPath(baseUrl, chatPath),
    model: resolvePersonaModelForProvider('banter', 'cohere'),
  };
}

export function parseBotChatProvider(raw: unknown): BotChatLlmProvider | null {
  if (raw === 'cohere' || raw === 'boost') return raw;
  /** Legacy clients / stored prefs. */
  if (raw === 'fungpt') return 'boost';
  return null;
}

export function defaultBotChatProvider(): BotChatLlmProvider {
  return 'cohere';
}

export function resolvePersonaModelForProvider(
  _persona: BotChatPersona,
  provider: BotChatLlmProvider,
): string {
  if (provider === 'boost') {
    return (
      process.env.BOT_CHAT_BOOST_MODEL?.trim() ||
      process.env.BOT_CHAT_MODEL?.trim() ||
      DEFAULT_BOOST_CHAT_MODEL
    );
  }
  return (
    process.env.BOT_CHAT_MODEL?.trim() ||
    DEFAULT_COHERE_CHAT_MODEL
  );
}

export function providerConfigError(provider: BotChatLlmProvider): string | null {
  const cfg = resolveProviderConfig(provider);
  if (!cfg) {
    return 'Chat is not configured (set BOT_CHAT_LLM_BASE_URL and BOT_CHAT_LLM_API_KEY)';
  }
  const hosted =
    !cfg.baseUrl.includes('127.0.0.1') &&
    !cfg.baseUrl.includes('localhost') &&
    !cfg.baseUrl.includes('fungpt:');
  if (hosted && !cfg.apiKey) {
    return 'Chat API key missing (set BOT_CHAT_LLM_API_KEY)';
  }
  return null;
}

export function resolveProviderConfig(
  provider: BotChatLlmProvider,
): BotChatRuntimeConfig | null {
  const cohere = resolveCohereLobbyConfig();
  if (!cohere) return null;
  if (provider === 'cohere') return cohere;
  return {
    ...cohere,
    provider: 'boost',
    model: resolvePersonaModelForProvider('banter', 'boost'),
  };
}

export function listAvailableBotChatProviders(): BotChatLlmProvider[] {
  if (providerConfigError('cohere') !== null) return [];
  return [...BOT_CHAT_LLM_PROVIDERS];
}

/** Hosted APIs: use non-streaming completions (Next /api rewrite buffers SSE). */
export function providerPrefersNonStream(baseUrl: string): boolean {
  return (
    !baseUrl.includes('fungpt:') &&
    !baseUrl.includes('127.0.0.1') &&
    !baseUrl.includes('localhost')
  );
}

/** @deprecated Sidecar model id — table banter only. */
export { DEFAULT_BANTER_MODEL };
