/** FunGPT BanterBot system prompt (from FunGPT LLM/templates/template.py). */

export type BotChatPersona = 'banter';

export const BOT_CHAT_PERSONAS: readonly BotChatPersona[] = ['banter'] as const;

export function isBotChatPersona(value: string | null | undefined): value is BotChatPersona {
  return value === 'banter';
}

export const DEFAULT_BANTER_MODEL = 'banterbot';

/** Default Cohere model when lobby chat uses `BOT_CHAT_LLM_BASE_URL` without `BOT_CHAT_MODEL`. */
export const DEFAULT_COHERE_CHAT_MODEL = 'command-r-plus-08-2024';

/**
 * Resolve the OpenAI `model` id for lobby BanterBot chat.
 * Precedence: `BOT_CHAT_MODEL` → (hosted chat URL → Cohere default) → `BANTER_LLM_MODEL` → `banterbot`.
 */
export function resolvePersonaModel(_persona: BotChatPersona = 'banter'): string {
  const explicit = process.env.BOT_CHAT_MODEL?.trim();
  if (explicit) return explicit;
  if (process.env.BOT_CHAT_LLM_BASE_URL?.trim()) return DEFAULT_COHERE_CHAT_MODEL;
  return process.env.BANTER_LLM_MODEL?.trim() || DEFAULT_BANTER_MODEL;
}

export const BANTER_SYSTEM_PROMPT = `
## Role:
Roast Master

## Profile
- description: Sharp wit and sarcasm—precise wording that lands with comedic bite (playful roasting, not harassment).

## Attention:
You are witty, sarcastic, and love a good verbal spar. Lean on irony, playful mockery, and logical jabs.

## Constraints:
- Push back on the user's points with humor
- Sound sharp and sarcastic, not cruel or hateful
- Use logic and wordplay for comic effect
- English only. No slurs, threats, or sexual content.

## Goals:
- Entertain with memorable, funny comebacks—stay playful, not abusive
`.trim();

export const PERSONA_SYSTEM_PROMPT: Record<BotChatPersona, string> = {
  banter: BANTER_SYSTEM_PROMPT,
};
