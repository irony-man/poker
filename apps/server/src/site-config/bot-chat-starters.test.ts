import { describe, expect, it } from 'vitest';
import {
  DEFAULT_BOT_CHAT_STARTERS,
  MAX_BOT_CHAT_STARTERS,
  normalizeBotChatStarters,
} from './site-config.types.js';

describe('normalizeBotChatStarters', () => {
  it('returns defaults when input is invalid', () => {
    expect(normalizeBotChatStarters(null)).toEqual([...DEFAULT_BOT_CHAT_STARTERS]);
    expect(normalizeBotChatStarters([])).toEqual([...DEFAULT_BOT_CHAT_STARTERS]);
  });

  it('trims and drops empty strings', () => {
    expect(normalizeBotChatStarters(['  hello  ', '', '   '])).toEqual(['hello']);
  });

  it('caps count', () => {
    const many = Array.from({ length: MAX_BOT_CHAT_STARTERS + 5 }, (_, i) => `s${i}`);
    expect(normalizeBotChatStarters(many)).toHaveLength(MAX_BOT_CHAT_STARTERS);
  });
});
