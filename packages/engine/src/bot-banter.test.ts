import { describe, expect, it } from 'vitest';
import {
  banterBucket,
  botBanterChance,
  botBanterDelayMs,
  fillBanterTemplate,
  maybeBotBanter,
  pickBotBanterLine,
  pickReactingBot,
  resolveChatReplyBot,
  shouldAttemptBotBanter,
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
  it('maps actions, reacts, chat replies, and wins', () => {
    expect(banterBucket({ kind: 'win' })).toBe('win');
    expect(banterBucket({ kind: 'chat_reply' })).toBe('chatReply');
    expect(banterBucket({ kind: 'action', action: 'fold', street: 'preflop' })).toBe('fold');
    expect(banterBucket({ kind: 'react', action: 'check', street: 'flop' })).toBe('check');
    expect(banterBucket({ kind: 'react', action: 'call', street: 'turn' })).toBe('call');
    expect(banterBucket({ kind: 'action', action: 'bet', street: 'river' })).toBe('betRaise');
    expect(banterBucket({ kind: 'react', action: 'raise', street: 'preflop' })).toBe('betRaise');
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

  it('makes react-to-allin more likely than react-to-check', () => {
    const check = botBanterChance('balanced', {
      kind: 'react',
      action: 'check',
      street: 'flop',
    });
    const allin = botBanterChance('balanced', {
      kind: 'react',
      action: 'allin',
      street: 'river',
    });
    expect(allin).toBeGreaterThan(check);
  });

  it('gives chat_reply a solid base chance', () => {
    const chance = botBanterChance('balanced', { kind: 'chat_reply' });
    expect(chance).toBeCloseTo(0.35, 5);
    expect(botBanterChance('maniac', { kind: 'chat_reply' })).toBeGreaterThan(chance);
    expect(botBanterChance('nit', { kind: 'chat_reply' })).toBeLessThan(chance);
  });
});

describe('fillBanterTemplate', () => {
  it('fills known slots', () => {
    expect(
      fillBanterTemplate('{name} bets {amount} on the {street} into {pot}', {
        actorName: 'Ada',
        amount: 40,
        street: 'flop',
        pot: 120,
      }),
    ).toBe('Ada bets 40 on the flop into 120');
  });

  it('returns null when a required slot is missing', () => {
    expect(fillBanterTemplate('Call {amount}', {})).toBeNull();
  });

  it('allows empty {hand} when handName is absent', () => {
    expect(fillBanterTemplate('Mine{hand}.', {})).toBe('Mine.');
  });
});

describe('maybeBotBanter', () => {
  it('returns null when roll misses', () => {
    const line = maybeBotBanter({
      personalityId: 'balanced',
      trigger: { kind: 'action', action: 'check', street: 'flop' },
      rng: seqRng([0.99, 0]),
    });
    expect(line).toBeNull();
  });

  it('returns a line from the personality pool when roll hits', () => {
    const line = maybeBotBanter({
      personalityId: 'maniac',
      trigger: { kind: 'action', action: 'allin', street: 'river' },
      context: { street: 'river' },
      rng: seqRng([0, 0]),
    });
    expect(line).toBeTruthy();
    expect(typeof line).toBe('string');
    expect(line!.length).toBeGreaterThan(0);
    expect(line!.length).toBeLessThanOrEqual(160);
  });

  it('interpolates context into self lines', () => {
    const line = pickBotBanterLine({
      personalityId: 'balanced',
      trigger: { kind: 'action', action: 'call', street: 'turn' },
      context: { amount: 25, pot: 80, street: 'turn' },
      rng: seqRng([0]),
    });
    expect(line).toBeTruthy();
    expect(line).toMatch(/25|80|turn/);
  });

  it('react lines mention the actor when provided', () => {
    const line = pickBotBanterLine({
      personalityId: 'humanoid',
      trigger: { kind: 'react', action: 'raise', street: 'flop' },
      context: { actorName: 'Sam', amount: 50, pot: 100, street: 'flop' },
      rng: seqRng([0]),
    });
    expect(line).toBeTruthy();
    expect(line).toContain('Sam');
  });

  it('chat_reply lines mention the speaker', () => {
    const line = pickBotBanterLine({
      personalityId: 'balanced',
      trigger: { kind: 'chat_reply' },
      context: { actorName: 'Alex', message: 'gg' },
      rng: seqRng([0]),
    });
    expect(line).toBeTruthy();
    expect(line).toContain('Alex');
    expect(line!.length).toBeLessThanOrEqual(140);
  });

  it('picks different pools for different personalities', () => {
    const trigger: BotBanterTrigger = { kind: 'win' };
    const nit = maybeBotBanter({
      personalityId: 'nit',
      trigger,
      context: { winAmount: 40 },
      rng: seqRng([0, 0]),
    });
    const maniac = maybeBotBanter({
      personalityId: 'maniac',
      trigger,
      context: { winAmount: 40 },
      rng: seqRng([0, 0]),
    });
    expect(nit).toBeTruthy();
    expect(maniac).toBeTruthy();
    expect(nit).not.toBe(maniac);
  });

  it('covers every personality × trigger with a hit', () => {
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
      { kind: 'chat_reply' },
      { kind: 'action', action: 'fold', street: 'preflop' },
      { kind: 'action', action: 'check', street: 'flop' },
      { kind: 'action', action: 'call', street: 'turn' },
      { kind: 'action', action: 'bet', street: 'river' },
      { kind: 'action', action: 'allin', street: 'river' },
      { kind: 'react', action: 'raise', street: 'flop' },
      { kind: 'react', action: 'allin', street: 'river' },
    ];
    for (const personalityId of ids) {
      for (const trigger of triggers) {
        const line = maybeBotBanter({
          personalityId,
          trigger,
          context: {
            street: trigger.kind !== 'win' ? trigger.street : 'river',
            amount: 30,
            pot: 90,
            actorName: 'Pat',
            winAmount: 55,
            handName: 'Two Pair',
          },
          rng: seqRng([0, 0]),
        });
        expect(line, `${personalityId} ${JSON.stringify(trigger)}`).toBeTruthy();
      }
    }
  });
});

describe('shouldAttemptBotBanter', () => {
  it('respects the chance gate', () => {
    expect(
      shouldAttemptBotBanter({
        personalityId: 'balanced',
        trigger: { kind: 'action', action: 'check', street: 'flop' },
        rng: seqRng([0.99]),
      }),
    ).toBe(false);
    expect(
      shouldAttemptBotBanter({
        personalityId: 'maniac',
        trigger: { kind: 'action', action: 'allin', street: 'river' },
        rng: seqRng([0]),
      }),
    ).toBe(true);
  });
});

describe('pickReactingBot', () => {
  it('picks an in-hand bot excluding the actor', () => {
    const pick = pickReactingBot(
      [
        { userId: 'offline-human', name: 'You', status: 'active' },
        { userId: 'bot:ace', name: 'Ace', status: 'active' },
        { userId: 'bot:bee', name: 'Bee', status: 'folded' },
        { userId: 'bot:cee', name: 'Cee', status: 'allin' },
      ],
      'offline-human',
      seqRng([0]),
    );
    expect(pick).toEqual({ userId: 'bot:ace', name: 'Ace' });
  });

  it('returns null when no bots remain', () => {
    expect(
      pickReactingBot(
        [{ userId: 'offline-human', name: 'You', status: 'active' }],
        'offline-human',
      ),
    ).toBeNull();
  });
});

describe('resolveChatReplyBot', () => {
  const seats = [
    { userId: 'offline-human', name: 'You', status: 'active' as const },
    { userId: 'bot:ace', name: 'AceBot', status: 'active' as const },
    { userId: 'bot:bee', name: 'Bee', status: 'folded' as const },
    { userId: 'bot:cee', name: 'Cee', status: 'seated' as const },
  ];

  it('targets an @mentioned bot by name', () => {
    const pick = resolveChatReplyBot(seats, 'hey @Bee nice hand', 'offline-human', seqRng([0]));
    expect(pick).toEqual({ userId: 'bot:bee', name: 'Bee', mentioned: true });
  });

  it('is case-insensitive for mentions', () => {
    const pick = resolveChatReplyBot(seats, '@acebot you there?', 'offline-human');
    expect(pick?.userId).toBe('bot:ace');
    expect(pick?.mentioned).toBe(true);
  });

  it('falls back to an in-hand bot when not mentioned', () => {
    const pick = resolveChatReplyBot(seats, 'anyone listening?', 'offline-human', seqRng([0]));
    expect(pick).toEqual({ userId: 'bot:ace', name: 'AceBot', mentioned: false });
  });

  it('returns null when no bots are seated', () => {
    expect(
      resolveChatReplyBot(
        [{ userId: 'offline-human', name: 'You', status: 'active' }],
        '@nobody',
        'offline-human',
      ),
    ).toBeNull();
  });
});

describe('botBanterDelayMs', () => {
  it('stays in 400–1200ms', () => {
    expect(botBanterDelayMs(() => 0)).toBe(400);
    expect(botBanterDelayMs(() => 0.999)).toBeGreaterThanOrEqual(400);
    expect(botBanterDelayMs(() => 0.999)).toBeLessThan(1200);
  });
});
