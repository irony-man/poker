import { Injectable } from '@nestjs/common';
import type { Response as ExpressResponse } from 'express';
import {
  PERSONA_SYSTEM_PROMPT,
  resolvePersonaModel,
  type BotChatPersona,
} from './bot-chat.prompts.js';
import type { BotChatMessage } from './bot-chat.parse.js';

const DEFAULT_PATH = '/v1/chat/completions';
const DEFAULT_TIMEOUT_MS = 60_000;
const MAX_REPLY_CHARS = 800;

export interface BotChatLlmConfig {
  baseUrl: string;
  apiKey?: string;
  path?: string;
  timeoutMs?: number;
  fetchFn?: typeof fetch;
}

function resolveTimeoutMs(config: Partial<BotChatLlmConfig>): number {
  if (config.timeoutMs != null && Number.isFinite(config.timeoutMs) && config.timeoutMs > 0) {
    return config.timeoutMs;
  }
  const env = Number(process.env.BOT_CHAT_TIMEOUT_MS ?? process.env.BANTER_LLM_TIMEOUT_MS);
  if (Number.isFinite(env) && env > 0) return env;
  return DEFAULT_TIMEOUT_MS;
}

function llmUrl(baseUrl: string, path: string): string {
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${baseUrl}${p}`;
}

function resolveChatPath(baseUrl: string, explicitPath?: string): string {
  let path =
    explicitPath?.trim() ||
    process.env.BOT_CHAT_LLM_PATH?.trim() ||
    (baseUrl.includes('cohere.ai/compatibility') ? '/chat/completions' : '') ||
    process.env.BANTER_LLM_PATH?.trim() ||
    DEFAULT_PATH;
  // Avoid .../compatibility/v1/v1/chat/completions when BANTER_LLM_PATH leaked into chat.
  if (baseUrl.includes('cohere.ai/compatibility') && path.startsWith('/v1/')) {
    path = path.replace(/^\/v1/, '') || '/chat/completions';
  }
  return path;
}

async function readUpstreamError(res: globalThis.Response): Promise<string> {
  try {
    const raw = await res.text();
    if (!raw) return `LLM request failed (${res.status})`;
    try {
      const json = JSON.parse(raw) as {
        error?: { message?: string } | string;
        message?: string;
      };
      const err = json.error;
      if (typeof err === 'string') return err;
      if (err?.message) return err.message;
      if (json.message) return json.message;
    } catch {
      /* plain text body */
    }
    return raw.slice(0, 240);
  } catch {
    return `LLM request failed (${res.status})`;
  }
}

/** OpenAI-compatible and Cohere compatibility chat completion bodies. */
export function extractCompletionText(data: unknown): string | null {
  if (!data || typeof data !== 'object') return null;
  const root = data as Record<string, unknown>;
  const choices = root.choices;
  if (!Array.isArray(choices) || !choices[0] || typeof choices[0] !== 'object') {
    return null;
  }
  const choice = choices[0] as Record<string, unknown>;
  if (typeof choice.text === 'string' && choice.text.trim()) return choice.text;
  const message = choice.message;
  if (!message || typeof message !== 'object') return null;
  const content = (message as Record<string, unknown>).content;
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    const parts = content
      .map((part) => {
        if (!part || typeof part !== 'object') return '';
        const row = part as Record<string, unknown>;
        if (typeof row.text === 'string') return row.text;
        if (typeof row.content === 'string') return row.content;
        return '';
      })
      .join('');
    if (parts.trim()) return parts;
  }
  return null;
}

export interface BotChatCompletionResult {
  text: string | null;
  error: string | null;
}

function streamTextDelta(parsed: {
  choices?: Array<{
    delta?: { content?: string };
    text?: string;
    message?: { content?: string };
  }>;
}): string | undefined {
  const choice = parsed.choices?.[0];
  const fromDelta = choice?.delta?.content;
  if (fromDelta) return fromDelta;
  if (typeof choice?.text === 'string') return choice.text;
  const msg = choice?.message?.content;
  if (typeof msg === 'string' && msg) return msg;
  return undefined;
}

export function clipBotChatReply(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const text = raw.replace(/\s+\n/g, '\n').trim();
  if (!text) return null;
  if (text.length <= MAX_REPLY_CHARS) return text;
  return `${text.slice(0, MAX_REPLY_CHARS - 1).trimEnd()}…`;
}

function withPersonaSystem(persona: BotChatPersona, messages: BotChatMessage[]): BotChatMessage[] {
  const system: BotChatMessage = { role: 'system', content: PERSONA_SYSTEM_PROMPT[persona] };
  const rest = messages.filter((m) => m.role !== 'system');
  return [system, ...rest];
}

/**
 * Lobby FunGPT chat client (OpenAI-compatible chat completions).
 * Nest constructs from env; tests use `create()`.
 */
@Injectable()
export class BotChatService {
  private baseUrl: string | null;
  private apiKey: string | null;
  private path: string;
  private timeoutMs: number;
  private fetchFn: typeof fetch;

  constructor() {
    this.applyConfig({});
  }

  static create(config: BotChatLlmConfig): BotChatService {
    const svc = new BotChatService();
    svc.applyConfig(config);
    return svc;
  }

  private applyConfig(config: Partial<BotChatLlmConfig>): void {
    const envChatBase = process.env.BOT_CHAT_LLM_BASE_URL?.trim();
    const envBanterBase = process.env.BANTER_LLM_BASE_URL?.trim();
    const base = (
      config.baseUrl ??
      envChatBase ??
      envBanterBase ??
      ''
    ).replace(/\/$/, '');
    this.baseUrl = base || null;
    this.apiKey =
      (config.apiKey ?? process.env.BOT_CHAT_LLM_API_KEY ?? process.env.BANTER_LLM_API_KEY)?.trim() ||
      null;
    this.path = base ? resolveChatPath(base, config.path) : DEFAULT_PATH;
    this.timeoutMs = resolveTimeoutMs(config);
    this.fetchFn = config.fetchFn ?? fetch;
  }

  isConfigured(): boolean {
    return this.configurationError() === null;
  }

  /** Human-readable misconfiguration (shown in API 503). */
  configurationError(): string | null {
    if (!this.baseUrl) {
      return 'Bot chat is not configured (set BOT_CHAT_LLM_BASE_URL for Cohere, or BANTER_LLM_BASE_URL)';
    }
    const hosted =
      !this.baseUrl.includes('127.0.0.1') &&
      !this.baseUrl.includes('localhost') &&
      !this.baseUrl.includes('fungpt:');
    if (hosted && !this.apiKey) {
      return 'Bot chat API key missing (set BOT_CHAT_LLM_API_KEY)';
    }
    return null;
  }

  private headers(): Record<string, string> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (this.apiKey) headers.Authorization = `Bearer ${this.apiKey}`;
    return headers;
  }

  async complete(persona: BotChatPersona, messages: BotChatMessage[]): Promise<string | null> {
    const result = await this.completeDetailed(persona, messages);
    return result.text;
  }

  async completeDetailed(
    persona: BotChatPersona,
    messages: BotChatMessage[],
  ): Promise<BotChatCompletionResult> {
    const configErr = this.configurationError();
    if (configErr) return { text: null, error: configErr };
    if (!this.baseUrl) {
      return { text: null, error: 'Bot chat is not configured' };
    }
    const url = llmUrl(this.baseUrl, this.path);
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), this.timeoutMs);
    try {
      const res = await this.fetchFn(url, {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify({
          model: resolvePersonaModel(persona),
          temperature: 0.8,
          max_tokens: 256,
          messages: withPersonaSystem(persona, messages),
        }),
        signal: ac.signal,
      });
      if (!res.ok) {
        const error = await readUpstreamError(res);
        console.warn('[bot-chat] LLM error:', error);
        return { text: null, error };
      }
      const data: unknown = await res.json();
      const text = clipBotChatReply(extractCompletionText(data));
      if (!text) {
        return { text: null, error: 'LLM returned empty content' };
      }
      return { text, error: null };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Bot chat timed out';
      console.warn('[bot-chat] LLM request failed:', err);
      return { text: null, error: message };
    } finally {
      clearTimeout(timer);
    }
  }

  async streamTo(
    res: ExpressResponse,
    persona: BotChatPersona,
    messages: BotChatMessage[],
  ): Promise<void> {
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();

    const writeEvent = (payload: unknown) => {
      if (res.writableEnded) return;
      const data = typeof payload === 'string' ? payload : JSON.stringify(payload);
      res.write(`data: ${data}\n\n`);
    };

    const configErr = this.configurationError();
    if (configErr) {
      writeEvent({ error: configErr });
      writeEvent('[DONE]');
      res.end();
      return;
    }

    // Hosted APIs (Cohere): avoid upstream SSE — Next /api rewrites often buffer event streams.
    if (this.baseUrl && !this.baseUrl.includes('fungpt:') && !this.baseUrl.includes('127.0.0.1')) {
      const { text, error } = await this.completeDetailed(persona, messages);
      if (text) writeEvent({ delta: text });
      else writeEvent({ error: error ?? 'Bot chat is not available' });
      writeEvent('[DONE]');
      res.end();
      return;
    }

    const url = llmUrl(this.baseUrl!, this.path);
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), this.timeoutMs);
    try {
      const upstream = await this.fetchFn(url, {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify({
          model: resolvePersonaModel(persona),
          temperature: 0.8,
          max_tokens: 256,
          stream: true,
          messages: withPersonaSystem(persona, messages),
        }),
        signal: ac.signal,
      });
      if (!upstream.ok) {
        writeEvent({ error: await readUpstreamError(upstream) });
        writeEvent('[DONE]');
        res.end();
        return;
      }
      if (!upstream.body) {
        writeEvent({ error: 'Bot chat is not available (empty LLM response)' });
        writeEvent('[DONE]');
        res.end();
        return;
      }

      const reader = upstream.body.getReader();
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
          let parsed: {
            error?: { message?: string } | string;
            choices?: Array<{
              delta?: { content?: string };
              text?: string;
              message?: { content?: string };
            }>;
          };
          try {
            parsed = JSON.parse(data) as typeof parsed;
          } catch {
            continue;
          }
          const err =
            typeof parsed.error === 'string' ? parsed.error : parsed.error?.message;
          if (err) {
            writeEvent({ error: err });
            writeEvent('[DONE]');
            res.end();
            return;
          }
          const delta = streamTextDelta(parsed);
          if (!delta) continue;
          const next = assembled + delta;
          if (next.length > MAX_REPLY_CHARS) {
            const room = MAX_REPLY_CHARS - assembled.length;
            if (room > 0) writeEvent({ delta: `${delta.slice(0, room)}…` });
            writeEvent('[DONE]');
            res.end();
            return;
          }
          assembled = next;
          writeEvent({ delta });
        }
      }
      if (!assembled.trim()) {
        const fallback = await this.complete(persona, messages);
        if (fallback) {
          writeEvent({ delta: fallback });
          writeEvent('[DONE]');
          res.end();
          return;
        }
        writeEvent({ error: 'Bot chat is not available (LLM returned no text)' });
        writeEvent('[DONE]');
        res.end();
        return;
      }
      writeEvent('[DONE]');
      res.end();
    } catch {
      writeEvent({ error: 'Bot chat timed out' });
      writeEvent('[DONE]');
      res.end();
    } finally {
      clearTimeout(timer);
    }
  }
}
