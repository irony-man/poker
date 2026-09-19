import { Injectable } from '@nestjs/common';
import type {
  BotBanterContext,
  BotBanterTrigger,
  BotPersonalityId,
} from '@poker/engine';

const DEFAULT_PATH = '/v1/chat/completions';
const DEFAULT_TIMEOUT_MS = 8000;
const MAX_LINE_CHARS = 160;

export interface GenerateBanterInput {
  personalityId: BotPersonalityId;
  botName: string;
  trigger: BotBanterTrigger;
  context?: BotBanterContext;
}

export interface BotBanterLlmConfig {
  baseUrl: string;
  apiKey?: string;
  model: string;
  path?: string;
  timeoutMs?: number;
  /** Injectable fetch for tests. */
  fetchFn?: typeof fetch;
}

const PERSONALITY_VOICE: Record<BotPersonalityId, string> = {
  balanced: 'calm, conversational regular at the table',
  tight: 'terse, disciplined, few words',
  loose: 'playful, loose, loves action',
  aggro: 'aggressive, needling, confident',
  passive: 'polite, soft-spoken, mild',
  maniac: 'chaotic, loud, hype',
  caller: 'calling-station vibes, chill about calling',
  nit: 'ultra-tight, clipped, judgmental',
  lag: 'tricky LAG, talks about lines and pressure',
  humanoid: 'natural human poker chat, thoughtful',
};

function resolveBanterTimeoutMs(explicit?: number): number {
  if (explicit != null && Number.isFinite(explicit) && explicit > 0) return explicit;
  const env = Number(process.env.BANTER_LLM_TIMEOUT_MS);
  if (Number.isFinite(env) && env > 0) return env;
  return DEFAULT_TIMEOUT_MS;
}

/** Strip quotes/newlines and enforce length; null if unusable. */
export function sanitizeBanterLine(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let text = raw.replace(/\s+/g, ' ').trim();
  if (
    (text.startsWith('"') && text.endsWith('"')) ||
    (text.startsWith("'") && text.endsWith("'"))
  ) {
    text = text.slice(1, -1).trim();
  }
  if (!text || text.length > MAX_LINE_CHARS) return null;
  return text;
}

function buildSystemPrompt(personalityId: BotPersonalityId, botName: string): string {
  const voice = PERSONALITY_VOICE[personalityId] ?? PERSONALITY_VOICE.balanced;
  return [
    `You are ${botName}, a poker bot at a live cash table.`,
    `Voice: ${voice}.`,
    'Write ONE short table-chat line (1–2 sentences, ≤140 characters).',
    'React to the given poker action only. No hole cards, equity, or AI meta.',
    'No slurs, threats, or sexual content. English only. No quotation marks around the whole line.',
  ].join(' ');
}

function buildUserPrompt(trigger: BotBanterTrigger, context?: BotBanterContext): string {
  const parts: string[] = [];
  if (trigger.kind === 'win') {
    parts.push('You just won the hand.');
  } else if (trigger.kind === 'react') {
    const who = context?.actorName?.trim() || 'an opponent';
    parts.push(`${who} just ${trigger.action} on the ${trigger.street}. Comment on their move.`);
  } else if (trigger.kind === 'chat_reply') {
    const who = context?.actorName?.trim() || 'a player';
    const msg = context?.message?.trim();
    parts.push(
      msg
        ? `${who} said in chat: "${msg.slice(0, 120)}". Reply briefly.`
        : `${who} said something in chat. Reply briefly.`,
    );
  } else {
    parts.push(`You just ${trigger.action} on the ${trigger.street}.`);
  }
  if (context?.amount != null) parts.push(`Amount: ${context.amount}.`);
  if (context?.pot != null) parts.push(`Pot: ${context.pot}.`);
  if (context?.winAmount != null) parts.push(`You won ${context.winAmount}.`);
  if (context?.handName && context.handName !== 'Uncontested') {
    parts.push(`Hand: ${context.handName}.`);
  }
  parts.push('Reply with only the chat line.');
  return parts.join(' ');
}

/**
 * In-house LLM client for bot table banter (OpenAI-compatible chat completions).
 * Returns null when unset, timed out, or response is unusable.
 *
 * Nest constructs with a no-arg constructor (env config). Tests use `create()`.
 */
@Injectable()
export class BotBanterLlmService {
  private baseUrl: string | null;
  private apiKey: string | null;
  private model: string;
  private path: string;
  private timeoutMs: number;
  private fetchFn: typeof fetch;

  constructor() {
    this.applyConfig({});
  }

  /** Manual / test construction with explicit config (overrides env). */
  static create(config: BotBanterLlmConfig): BotBanterLlmService {
    const svc = new BotBanterLlmService();
    svc.applyConfig(config);
    return svc;
  }

  private applyConfig(config: Partial<BotBanterLlmConfig>): void {
    const base = (config.baseUrl ?? process.env.BANTER_LLM_BASE_URL ?? '').replace(/\/$/, '');
    this.baseUrl = base || null;
    this.apiKey = (config.apiKey ?? process.env.BANTER_LLM_API_KEY)?.trim() || null;
    this.model = config.model ?? process.env.BANTER_LLM_MODEL?.trim() ?? 'banterbot';
    this.path = config.path ?? process.env.BANTER_LLM_PATH?.trim() ?? DEFAULT_PATH;
    this.timeoutMs = resolveBanterTimeoutMs(config.timeoutMs);
    this.fetchFn = config.fetchFn ?? fetch;
  }

  isConfigured(): boolean {
    return Boolean(this.baseUrl);
  }

  async generateBanter(input: GenerateBanterInput): Promise<string | null> {
    if (!this.baseUrl) return null;

    const url = `${this.baseUrl}${this.path.startsWith('/') ? this.path : `/${this.path}`}`;
    const body = {
      model: this.model,
      temperature: 0.9,
      max_tokens: 80,
      messages: [
        {
          role: 'system',
          content: buildSystemPrompt(input.personalityId, input.botName),
        },
        {
          role: 'user',
          content: buildUserPrompt(input.trigger, input.context),
        },
      ],
    };

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.apiKey) headers.Authorization = `Bearer ${this.apiKey}`;

    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), this.timeoutMs);
    try {
      const res = await this.fetchFn(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: ac.signal,
      });
      if (!res.ok) return null;
      const data = (await res.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const content = data.choices?.[0]?.message?.content;
      return sanitizeBanterLine(content);
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  }
}
