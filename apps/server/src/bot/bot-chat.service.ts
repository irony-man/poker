import { Injectable } from '@nestjs/common';
import type { Response } from 'express';
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
  const trimmed = explicitPath?.trim();
  if (trimmed) return trimmed;
  const envChatPath = process.env.BOT_CHAT_LLM_PATH?.trim();
  if (envChatPath) return envChatPath;
  if (baseUrl.includes('cohere.ai/compatibility')) return '/chat/completions';
  return process.env.BANTER_LLM_PATH?.trim() ?? DEFAULT_PATH;
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
    return Boolean(this.baseUrl);
  }

  private headers(): Record<string, string> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (this.apiKey) headers.Authorization = `Bearer ${this.apiKey}`;
    return headers;
  }

  async complete(persona: BotChatPersona, messages: BotChatMessage[]): Promise<string | null> {
    if (!this.baseUrl) return null;
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
      if (!res.ok) return null;
      const data = (await res.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      return clipBotChatReply(data.choices?.[0]?.message?.content);
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  async streamTo(
    res: Response,
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

    if (!this.baseUrl) {
      writeEvent({ error: 'Bot chat is not available' });
      writeEvent('[DONE]');
      res.end();
      return;
    }

    const url = llmUrl(this.baseUrl, this.path);
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
      if (!upstream.ok || !upstream.body) {
        writeEvent({ error: 'Bot chat is not available' });
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
            choices?: Array<{ delta?: { content?: string } }>;
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
          const delta = parsed.choices?.[0]?.delta?.content;
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
