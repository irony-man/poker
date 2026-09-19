import { describe, expect, it, vi } from 'vitest';
import { BotChatService, clipBotChatReply } from './bot-chat.service.js';

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
    await expect(svc.complete('banter', [{ role: 'user', content: 'hi' }])).resolves.toBeNull();
  });

  it('posts FunGPT persona + history to chat completions', async () => {
    const fetchFn = vi.fn(async () =>
      Response.json({
        choices: [{ message: { content: 'You showed up. That already counts.' } }],
      }),
    ) as unknown as typeof fetch;
    const svc = BotChatService.create({
      baseUrl: 'http://llm.test',
      apiKey: 'secret',
      fetchFn,
    });
    const text = await svc.complete('boost', [
      { role: 'user', content: 'I shipped a feature' },
    ]);
    expect(text).toBe('You showed up. That already counts.');
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
    expect(body.model).toBe('boostbot');
    expect(body.messages[0]?.role).toBe('system');
    expect(body.messages[0]?.content).toContain('Compliment Master');
    expect(body.messages.at(-1)).toEqual({ role: 'user', content: 'I shipped a feature' });
  });
});
