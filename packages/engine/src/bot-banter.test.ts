import { describe, expect, it } from 'vitest';
import {
  banterBucket,
  botBanterChance,
  botBanterDelayMs,
  maybeBotBanter,
  type BotBanterTrigger,
} from './bot-banter.js';
import type { BotPersonalityId } from './bot.js';

function seqRng(values: number[]): () => number {
  let i = 0;
  return () => {
    const v = values[Math.min(i, values.length - 1)]!;
    i += 1;
    return v;
  };
}

describe('banterBucket', () => {
  it('maps actions and wins', () => {
    expect(banterBucket({ kind: 'win' })).toBe('win');
    expect(banterBucket({ kind: 'action', action: 'fold', street: 'preflop' })).toBe('fold');
    expect(banterBucket({ kind: 'action', action: 'check', street: 'flop' })).toBe('check');
    expect(banterBucket({ kind: 'action', action: 'call', street: 'turn' })).toBe('call');
    expect(banterBucket({ kind: 'action', action: 'bet', street: 'river' })).toBe('betRaise');
    expect(banterBucket({ kind: 'action', action: 'raise', street: 'preflop' })).toBe('betRaise');
    expect(banterBucket({ kind: 'action', action: 'allin', street: 'river' })).toBe('allin');
  });
});

describe('botBanterChance', () => {
  it('makes all-in more likely than check', () => {
    const check = botBanterChance('balanced', {
      kind: 'action',
      action: 'check',
      street: 'flop',
    });
    const allin = botBanterChance('balanced', {
      kind: 'action',
      action: 'allin',
      street: 'river',
    });
    expect(allin).toBeGreaterThan(check);
  });

  it('scales chatty vs silent personalities', () => {
    const trigger: BotBanterTrigger = {
      kind: 'action',
      action: 'raise',
      street: 'flop',
    };
    expect(botBanterChance('maniac', trigger)).toBeGreaterThan(botBanterChance('nit', trigger));
    expect(botBanterChance('humanoid', trigger)).toBeGreaterThan(botBanterChance('tight', trigger));
  });
});

describe('maybeBotBanter', () => {
  it('returns null when roll misses', () => {
    const line = maybeBotBanter({
      personalityId: 'balanced',
      trigger: { kind: 'action', action: 'check', street: 'flop' },
      // First draw is chance gate — 0.99 always misses (~5% check chance)
      rng: seqRng([0.99, 0]),
    });
    expect(line).toBeNull();
  });

  it('returns a line from the personality pool when roll hits', () => {
    const line = maybeBotBanter({
      personalityId: 'maniac',
      trigger: { kind: 'action', action: 'allin', street: 'river' },
      // Hit chance (allin ~0.65), then pick index 0
      rng: seqRng([0, 0]),
    });
    expect(line).toBeTruthy();
    expect(typeof line).toBe('string');
    expect(line!.length).toBeGreaterThan(0);
    expect(line!.length).toBeLessThanOrEqual(80);
  });

  it('picks different pools for different personalities', () => {
    const trigger: BotBanterTrigger = { kind: 'win' };
    const nit = maybeBotBanter({
      personalityId: 'nit',
      trigger,
      rng: seqRng([0, 0]),
    });
    const maniac = maybeBotBanter({
      personalityId: 'maniac',
      trigger,
      rng: seqRng([0, 0]),
    });
    expect(nit).toBeTruthy();
    expect(maniac).toBeTruthy();
    expect(nit).not.toBe(maniac);
  });

  it('covers every personality × bucket with a hit', () => {
    const ids: BotPersonalityId[] = [
      'balanced',
      'tight',
      'loose',
      'aggro',
      'passive',
      'maniac',
      'caller',
      'nit',
      'lag',
      'humanoid',
    ];
    const triggers: BotBanterTrigger[] = [
      { kind: 'win' },
      { kind: 'action', action: 'fold', street: 'preflop' },
      { kind: 'action', action: 'check', street: 'flop' },
      { kind: 'action', action: 'call', street: 'turn' },
      { kind: 'action', action: 'bet', street: 'river' },
      { kind: 'action', action: 'allin', street: 'river' },
    ];
    for (const personalityId of ids) {
      for (const trigger of triggers) {
        const line = maybeBotBanter({
          personalityId,
          trigger,
          rng: seqRng([0, 0]),
        });
        expect(line, `${personalityId} ${JSON.stringify(trigger)}`).toBeTruthy();
      }
    }
  });
});

describe('botBanterDelayMs', () => {
  it('stays in 400–1200ms', () => {
    expect(botBanterDelayMs(() => 0)).toBe(400);
    expect(botBanterDelayMs(() => 0.999)).toBeGreaterThanOrEqual(400);
    expect(botBanterDelayMs(() => 0.999)).toBeLessThan(1200);
  });
});
