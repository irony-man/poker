import {
  defaultBotChatProvider,
  parseBotChatProvider,
  type BotChatLlmProvider,
} from './bot-chat.providers.js';
import { isBotChatPersona, type BotChatPersona } from './bot-chat.prompts.js';

export const MAX_BOT_CHAT_TURNS = 20;
export const MAX_BOT_CHAT_MESSAGE_CHARS = 2000;

export type BotChatRole = 'system' | 'user' | 'assistant';

export interface BotChatMessage {
  role: BotChatRole;
  content: string;
}

export interface ParsedBotChatBody {
  persona: BotChatPersona;
  messages: BotChatMessage[];
  stream: boolean;
  llmProvider: BotChatLlmProvider;
}

const ROLES = new Set<string>(['system', 'user', 'assistant']);

export function parseBotChatBody(raw: unknown): { ok: true; value: ParsedBotChatBody } | { ok: false; error: string } {
  if (!raw || typeof raw !== 'object') {
    return { ok: false, error: 'Invalid body' };
  }
  const body = raw as Record<string, unknown>;
  const personaRaw =
    typeof body.persona === 'string' && body.persona.trim()
      ? body.persona.trim()
      : 'banter';
  if (!isBotChatPersona(personaRaw)) {
    return { ok: false, error: 'persona must be banter' };
  }
  if (!Array.isArray(body.messages)) {
    return { ok: false, error: 'messages must be an array' };
  }

  const messages: BotChatMessage[] = [];
  for (const item of body.messages) {
    if (!item || typeof item !== 'object') continue;
    const row = item as Record<string, unknown>;
    const role = typeof row.role === 'string' ? row.role.trim() : '';
    const content = typeof row.content === 'string' ? row.content.trim() : '';
    if (!ROLES.has(role) || !content) continue;
    messages.push({
      role: role as BotChatRole,
      content: content.slice(0, MAX_BOT_CHAT_MESSAGE_CHARS),
    });
  }

  const clipped = messages.slice(-MAX_BOT_CHAT_TURNS);
  if (!clipped.some((m) => m.role === 'user')) {
    return { ok: false, error: 'messages must include a user turn' };
  }

  const providerRaw = parseBotChatProvider(body.llmProvider ?? body.provider);
  const llmProvider = providerRaw ?? defaultBotChatProvider();
  if (body.llmProvider != null || body.provider != null) {
    if (!providerRaw) {
      return { ok: false, error: 'llmProvider must be cohere or fungpt' };
    }
  }

  return {
    ok: true,
    value: {
      persona: personaRaw,
      messages: clipped,
      stream: body.stream === true,
      llmProvider,
    },
  };
}
