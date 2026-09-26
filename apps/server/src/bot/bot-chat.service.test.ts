import { describe, expect, it, vi } from 'vitest';
import {
  BotChatService,
  clipBotChatReply,
  extractCompletionText,
} from './bot-chat.service.js';

describe('extractCompletionText', () => {
  it('reads string and array message content', () => {
    expect(
      extractCompletionText({
        choices: [{ message: { content: 'Hello' } }],
      }),
    ).toBe('Hello');
    expect(
      extractCompletionText({
        choices: [{ message: { content: [{ type: 'text', text: 'Hi there' }] } }],
      }),
    ).toBe('Hi there');
  });
});

describe('clipBotChatReply', () => {
  it('trims and caps length', () => {
    expect(clipBotChatReply('  nice  ')).toBe('nice');
    expect(clipBotChatReply('')).toBeNull();
    const long = 'x'.repeat(900);
    const clipped = clipBotChatReply(long);
    expect(clipped?.endsWith('…')).toBe(true);
    expect(clipped!.length).toBe(800);
  });
});

describe('BotChatService', () => {
  it('is unconfigured without a base URL', async () => {
    const svc = BotChatService.create({
      baseUrl: '',
      fetchFn: vi.fn() as unknown as typeof fetch,
    });
    expect(svc.isConfigured()).toBe(false);
    await expect(svc.complete('banter', [{ role: 'user', content: 'hi' }], 'cohere')).resolves.toBeNull();
  });

  it('posts BanterBot persona + history to chat completions', async () => {
    const prev = process.env.BANTER_LLM_MODEL;
    delete process.env.BANTER_LLM_MODEL;
    delete process.env.BOT_CHAT_MODEL;
    try {
      const fetchFn = vi.fn(async () =>
        Response.json({
          choices: [{ message: { content: 'Keep talking, I need the material.' } }],
        }),
      ) as unknown as typeof fetch;
      const svc = BotChatService.create({
        baseUrl: 'http://llm.test',
        apiKey: 'secret',
        model: 'banterbot',
        fetchFn,
      });
      const text = await svc.complete(
        'banter',
        [{ role: 'user', content: 'I shipped a feature' }],
        'cohere',
      );
      expect(text).toBe('Keep talking, I need the material.');
      expect(fetchFn).toHaveBeenCalledOnce();
      const [url, init] = (fetchFn as ReturnType<typeof vi.fn>).mock.calls[0]!;
      expect(url).toBe('http://llm.test/v1/chat/completions');
      expect((init as RequestInit).headers).toMatchObject({
        Authorization: 'Bearer secret',
      });
      const body = JSON.parse((init as RequestInit).body as string) as {
        model: string;
        messages: Array<{ role: string; content: string }>;
      };
      expect(body.model).toBe('banterbot');
      expect(body.messages[0]?.role).toBe('system');
      expect(body.messages[0]?.content).toContain('BanterBot');
      expect(body.messages[0]?.content).toContain('poker only');
      expect(body.messages.at(-1)).toEqual({ role: 'user', content: 'I shipped a feature' });
    } finally {
      if (prev === undefined) delete process.env.BANTER_LLM_MODEL;
      else process.env.BANTER_LLM_MODEL = prev;
    }
  });

  it('uses BOT_CHAT_LLM_* for lobby chat when set (separate from table banter)', async () => {
    const prev = {
      chatBase: process.env.BOT_CHAT_LLM_BASE_URL,
      chatKey: process.env.BOT_CHAT_LLM_API_KEY,
      banterBase: process.env.BANTER_LLM_BASE_URL,
    };
    process.env.BOT_CHAT_LLM_BASE_URL = 'https://api.cohere.ai/compatibility/v1';
    process.env.BOT_CHAT_LLM_API_KEY = 'cohere-key';
    process.env.BANTER_LLM_BASE_URL = 'http://fungpt:8000';
    process.env.BOT_CHAT_MODEL = 'command-r-plus-08-2024';
    try {
      const fetchFn = vi.fn(async () =>
        Response.json({ choices: [{ message: { content: 'Fast.' } }] }),
      ) as unknown as typeof fetch;
      const svc = BotChatService.create({ fetchFn });
      const text = await svc.complete('banter', [{ role: 'user', content: 'hi' }], 'cohere');
      expect(text).toBe('Fast.');
      const [url, init] = (fetchFn as ReturnType<typeof vi.fn>).mock.calls[0]!;
      expect(url).toBe('https://api.cohere.ai/compatibility/v1/chat/completions');
      expect((init as RequestInit).headers).toMatchObject({
        Authorization: 'Bearer cohere-key',
      });
    } finally {
      for (const [k, v] of Object.entries(prev)) {
        const key =
          k === 'chatBase'
            ? 'BOT_CHAT_LLM_BASE_URL'
            : k === 'chatKey'
              ? 'BOT_CHAT_LLM_API_KEY'
              : 'BANTER_LLM_BASE_URL';
        if (v === undefined) delete process.env[key];
        else process.env[key] = v;
      }
      delete process.env.BOT_CHAT_MODEL;
    }
  });

  it('uses BANTER_LLM_MODEL for hosted OpenAI-style APIs', async () => {
    process.env.BANTER_LLM_MODEL = 'gpt-4o-mini';
    try {
      const fetchFn = vi.fn(async () =>
        Response.json({ choices: [{ message: { content: 'Nice.' } }] }),
      ) as unknown as typeof fetch;
      const svc = BotChatService.create({
        baseUrl: 'http://api.openai.test',
        fetchFn,
      });
      await svc.complete('banter', [{ role: 'user', content: 'hi' }], 'cohere');
      const body = JSON.parse(
        ((fetchFn as ReturnType<typeof vi.fn>).mock.calls[0]![1] as RequestInit).body as string,
      ) as { model: string };
      expect(body.model).toBe('banterbot');
    } finally {
      delete process.env.BANTER_LLM_MODEL;
    }
  });
});
