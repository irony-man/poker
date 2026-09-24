import {
  DEFAULT_BANTER_MODEL,
  DEFAULT_COHERE_CHAT_MODEL,
  type BotChatPersona,
} from './bot-chat.prompts.js';

export type BotChatLlmProvider = 'cohere' | 'fungpt';

export const BOT_CHAT_LLM_PROVIDERS: readonly BotChatLlmProvider[] = ['cohere', 'fungpt'] as const;

export interface BotChatRuntimeConfig {
  provider: BotChatLlmProvider;
  baseUrl: string;
  apiKey: string | null;
  path: string;
  model: string;
}

const DEFAULT_PATH = '/v1/chat/completions';

/** Bearer token for FunGPT / table banter (must match sidecar `FUNGPT_API_KEY`). */
export function resolveSidecarApiKey(): string | null {
  const key =
    process.env.BANTER_LLM_API_KEY?.trim() || process.env.FUNGPT_API_KEY?.trim() || '';
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

export function parseBotChatProvider(raw: unknown): BotChatLlmProvider | null {
  if (raw === 'cohere' || raw === 'fungpt') return raw;
  return null;
}

export function defaultBotChatProvider(): BotChatLlmProvider {
  if (process.env.BOT_CHAT_LLM_BASE_URL?.trim()) return 'cohere';
  return 'fungpt';
}

export function resolvePersonaModelForProvider(
  _persona: BotChatPersona,
  provider: BotChatLlmProvider,
): string {
  if (provider === 'cohere') {
    return (
      process.env.BOT_CHAT_MODEL?.trim() ||
      DEFAULT_COHERE_CHAT_MODEL
    );
  }
  return process.env.BANTER_LLM_MODEL?.trim() || DEFAULT_BANTER_MODEL;
}

export function providerConfigError(provider: BotChatLlmProvider): string | null {
  const cfg = resolveProviderConfig(provider);
  if (!cfg) {
    if (provider === 'cohere') {
      return 'Cohere is not configured (set BOT_CHAT_LLM_BASE_URL and BOT_CHAT_LLM_API_KEY)';
    }
    return 'FunGPT is not configured (set BANTER_LLM_BASE_URL for the sidecar)';
  }
  const hosted =
    !cfg.baseUrl.includes('127.0.0.1') &&
    !cfg.baseUrl.includes('localhost') &&
    !cfg.baseUrl.includes('fungpt:');
  if (hosted && !cfg.apiKey) {
    return provider === 'cohere'
      ? 'Cohere API key missing (set BOT_CHAT_LLM_API_KEY)'
      : 'FunGPT API key missing (set BANTER_LLM_API_KEY)';
  }
  return null;
}

export function resolveProviderConfig(
  provider: BotChatLlmProvider,
): BotChatRuntimeConfig | null {
  if (provider === 'cohere') {
    const baseUrl = (process.env.BOT_CHAT_LLM_BASE_URL ?? '').trim().replace(/\/$/, '');
    if (!baseUrl) return null;
    const chatPath = process.env.BOT_CHAT_LLM_PATH?.trim();
    return {
      provider,
      baseUrl,
      apiKey: (process.env.BOT_CHAT_LLM_API_KEY ?? '').trim() || null,
      path: resolveChatPath(baseUrl, chatPath),
      model: resolvePersonaModelForProvider('banter', 'cohere'),
    };
  }
  const baseUrl = (process.env.BANTER_LLM_BASE_URL ?? '').trim().replace(/\/$/, '');
  if (!baseUrl) return null;
  return {
    provider,
    baseUrl,
    apiKey: resolveSidecarApiKey(),
    path: resolveChatPath(baseUrl, process.env.BANTER_LLM_PATH?.trim()),
    model: resolvePersonaModelForProvider('banter', 'fungpt'),
  };
}

export function listAvailableBotChatProviders(): BotChatLlmProvider[] {
  return BOT_CHAT_LLM_PROVIDERS.filter((p) => providerConfigError(p) === null);
}

/** Hosted APIs: use non-streaming completions (Next /api rewrite buffers SSE). */
export function providerPrefersNonStream(baseUrl: string): boolean {
  return (
    !baseUrl.includes('fungpt:') &&
    !baseUrl.includes('127.0.0.1') &&
    !baseUrl.includes('localhost')
  );
}
