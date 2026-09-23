import { describe, expect, it } from 'vitest';
import { parseBotChatBody } from './bot-chat.parse.js';

describe('parseBotChatBody', () => {
  it('accepts banter and clips history', () => {
    const messages = Array.from({ length: 24 }, (_, i) => ({
      role: i % 2 === 0 ? 'user' : 'assistant',
      content: `msg ${i}`,
    }));
    const parsed = parseBotChatBody({ persona: 'banter', messages, stream: true });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.value.persona).toBe('banter');
    expect(parsed.value.stream).toBe(true);
    expect(parsed.value.messages).toHaveLength(20);
  });

  it('defaults persona to banter when omitted', () => {
    const parsed = parseBotChatBody({
      messages: [{ role: 'user', content: 'hi' }],
    });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.value.persona).toBe('banter');
  });

  it('rejects boost and missing user turns', () => {
    expect(parseBotChatBody({ persona: 'boost', messages: [{ role: 'user', content: 'hi' }] }).ok).toBe(
      false,
    );
    expect(parseBotChatBody({ persona: 'banter', messages: [{ role: 'assistant', content: 'hi' }] }).ok).toBe(
      false,
    );
  });
});
