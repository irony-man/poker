import { afterEach, describe, expect, it } from 'vitest';
import { resolvePersonaModel } from './bot-chat.prompts.js';

const KEYS = ['BOT_CHAT_MODEL', 'BANTER_LLM_MODEL'] as const;

afterEach(() => {
  for (const key of KEYS) delete process.env[key];
});

describe('resolvePersonaModel', () => {
  it('defaults to FunGPT banterbot', () => {
    expect(resolvePersonaModel('banter')).toBe('banterbot');
  });

  it('uses a hosted model when set', () => {
    process.env.BANTER_LLM_MODEL = 'gpt-4o-mini';
    expect(resolvePersonaModel('banter')).toBe('gpt-4o-mini');
  });

  it('prefers BOT_CHAT_MODEL over BANTER_LLM_MODEL', () => {
    process.env.BANTER_LLM_MODEL = 'table-model';
    process.env.BOT_CHAT_MODEL = 'lobby-model';
    expect(resolvePersonaModel()).toBe('lobby-model');
  });
});
