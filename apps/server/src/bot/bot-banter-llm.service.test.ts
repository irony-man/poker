import { describe, expect, it, vi } from 'vitest';
import {
  BotBanterLlmService,
  sanitizeBanterLine,
} from './bot-banter-llm.service.js';

describe('sanitizeBanterLine', () => {
  it('trims and strips wrapping quotes', () => {
    expect(sanitizeBanterLine('  "Nice raise."  ')).toBe('Nice raise.');
    expect(sanitizeBanterLine("'Ship it.'")).toBe('Ship it.');
  });

  it('rejects empty or oversized lines', () => {
    expect(sanitizeBanterLine('')).toBeNull();
    expect(sanitizeBanterLine('   ')).toBeNull();
    expect(sanitizeBanterLine('x'.repeat(161))).toBeNull();
  });
});

describe('BotBanterLlmService', () => {
  it('returns null when base URL is unset', async () => {
    const svc = BotBanterLlmService.create({
      baseUrl: '',
      model: 'banter',
      fetchFn: vi.fn() as unknown as typeof fetch,
    });
    expect(svc.isConfigured()).toBe(false);
    const line = await svc.generateBanter({
      personalityId: 'balanced',
      botName: 'Ace',
      trigger: { kind: 'action', action: 'raise', street: 'flop' },
      context: { amount: 40, pot: 100 },
    });
    expect(line).toBeNull();
  });

  it('returns sanitized content from a successful chat completion', async () => {
    const fetchFn = vi.fn(async () =>
      Response.json({
        choices: [{ message: { content: '"Big bet on the flop — respect."' } }],
      }),
    ) as unknown as typeof fetch;
    const svc = BotBanterLlmService.create({
      baseUrl: 'http://llm.test',
      apiKey: 'secret',
      model: 'banter-v1',
      fetchFn,
    });
    expect(svc.isConfigured()).toBe(true);
    const line = await svc.generateBanter({
      personalityId: 'aggro',
      botName: 'BluffBot',
      trigger: { kind: 'react', action: 'raise', street: 'flop' },
      context: { actorName: 'Sam', amount: 50, pot: 120 },
    });
    expect(line).toBe('Big bet on the flop — respect.');
    expect(fetchFn).toHaveBeenCalledOnce();
    const [url, init] = (fetchFn as ReturnType<typeof vi.fn>).mock.calls[0]!;
    expect(url).toBe('http://llm.test/v1/chat/completions');
    expect((init as RequestInit).headers).toMatchObject({
      Authorization: 'Bearer secret',
    });
  });

  it('returns null on HTTP failure', async () => {
    const fetchFn = vi.fn(async () => new Response('nope', { status: 500 })) as unknown as typeof fetch;
    const svc = BotBanterLlmService.create({
      baseUrl: 'http://llm.test',
      model: 'banter',
      fetchFn,
    });
    const line = await svc.generateBanter({
      personalityId: 'nit',
      botName: 'Nit',
      trigger: { kind: 'win' },
      context: { winAmount: 80 },
    });
    expect(line).toBeNull();
  });

  it('returns null when fetch throws / aborts', async () => {
    const fetchFn = vi.fn(async () => {
      throw new Error('network');
    }) as unknown as typeof fetch;
    const svc = BotBanterLlmService.create({
      baseUrl: 'http://llm.test',
      model: 'banter',
      fetchFn,
    });
    const line = await svc.generateBanter({
      personalityId: 'maniac',
      botName: 'Maniac',
      trigger: { kind: 'action', action: 'allin', street: 'river' },
    });
    expect(line).toBeNull();
  });
});
