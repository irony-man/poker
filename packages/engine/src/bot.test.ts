import { describe, expect, it } from 'vitest';
import { parseCard } from './cards.js';
import {
  BOT_NAME_PERSONALITIES,
  BOT_PERSONALITIES,
  boardTexture,
  botThinkDelayMs,
  chooseBotAction,
  chenScore,
  estimateEquity,
  isBotUserId,
  makeBotUserId,
  personalityForBot,
} from './bot.js';
import {
  applyAction,
  createEmptyTable,
  sitDown,
  startHand,
  type HandState,
  type TableConfig,
} from './hand.js';
import { randomBytes } from 'node:crypto';

const config: TableConfig = {
  maxSeats: 6,
  smallBlind: 5,
  bigBlind: 10,
  buyIn: 1000,
  turnTimeMs: 15000,
};

function forceHole(state: HandState, seat: number, c1: string, c2: string): HandState {
  const players = state.players.map((p, i) =>
    i === seat
      ? {
          ...p,
          holeCards: [parseCard(c1), parseCard(c2)] as [import('./cards.js').Card, import('./cards.js').Card],
        }
      : p,
  );
  return { ...state, players };
}

describe('pro bot', () => {
  it('identifies bot ids', () => {
    expect(isBotUserId(makeBotUserId('z'))).toBe(true);
    expect(isBotUserId('human')).toBe(false);
  });

  it('ranks pocket aces above 72o on Chen', () => {
    expect(chenScore(parseCard('As'), parseCard('Ad'))).toBeGreaterThan(
      chenScore(parseCard('7h'), parseCard('2c')),
    );
  });

  it('gives high equity to AA preflop', () => {
    const eq = estimateEquity([parseCard('As'), parseCard('Ad')], [], 2, 40);
    expect(eq).toBeGreaterThan(0.7);
  });

  it('maps default roster names to distinct personalities', () => {
    expect(personalityForBot('bot:x', 'FoldBot').id).toBe('nit');
    expect(personalityForBot('bot:y', 'AllInAnnie').id).toBe('maniac');
    expect(personalityForBot('bot:z', 'CallCart').id).toBe('caller');
    expect(personalityForBot('bot:w', 'PotOdds').id).toBe('balanced');
    expect(Object.keys(BOT_NAME_PERSONALITIES).length).toBeGreaterThanOrEqual(8);
  });

  it('encodes admin styles into the bot user id', () => {
    const id = makeBotUserId('xyz', 'maniac');
    expect(isBotUserId(id)).toBe(true);
    expect(personalityForBot(id, 'Whatever').id).toBe('maniac');
  });

  it('honors seating-time name overrides over the built-in roster', () => {
    expect(
      personalityForBot(makeBotUserId('a'), 'FoldBot', {
        namePersonalities: { FoldBot: 'maniac' },
      }).id,
    ).toBe('maniac');
    expect(
      personalityForBot(makeBotUserId('b'), 'Custom', {
        defaultPersonality: 'nit',
      }).id,
    ).toBe('nit');
  });

  it('is stable for the same userId when name is unknown', () => {
    const a = personalityForBot(makeBotUserId('stable-seed-1'), 'RandomName');
    const b = personalityForBot(makeBotUserId('stable-seed-1'), 'RandomName');
    expect(a.id).toBe(b.id);
    expect(a).toEqual(BOT_PERSONALITIES[a.id]);
  });

  it('always returns a legal action through a hand', () => {
    let state = createEmptyTable(config);
    state = sitDown(state, 0, 'u1', 'Alice', 500).state;
    state = sitDown(state, 1, makeBotUserId('x'), 'AceBot', 500).state;
    state = startHand(state, config, 'h1', (n) => randomBytes(n)).state;

    let guard = 0;
    while (state.street !== 'payout' && state.toAct !== null && guard++ < 80) {
      const seat = state.toAct;
      const intent = chooseBotAction(state, seat, config);
      expect(intent).not.toBeNull();
      const r = applyAction(state, seat, intent!, config);
      expect(r.ok, r.error).toBe(true);
      state = r.state;
    }
    expect(state.street).toBe('payout');
  });

  it('plays legally under each personality style for a full hand', () => {
    for (const style of Object.values(BOT_PERSONALITIES)) {
      let state = createEmptyTable(config);
      state = sitDown(state, 0, 'u1', 'Alice', 500).state;
      state = sitDown(state, 1, makeBotUserId(style.id), style.id, 500).state;
      state = startHand(state, config, `h-${style.id}`, (n) => randomBytes(n)).state;

      let guard = 0;
      while (state.street !== 'payout' && state.toAct !== null && guard++ < 80) {
        const seat = state.toAct;
        const actor = state.players[seat]!;
        const intent = isBotUserId(actor.userId)
          ? chooseBotAction(state, seat, config, style)
          : {
              type: (state.currentBet - actor.bet > 0 ? 'call' : 'check') as 'call' | 'check',
              seq: state.actionSeq,
            };
        const r = applyAction(state, seat, intent!, config);
        expect(r.ok, `${style.id}: ${r.error}`).toBe(true);
        state = r.state;
      }
      expect(state.street).toBe('payout');
    }
  });

  it('opens or continues with AA; folds trash to a big cold call price often', () => {
    let state = createEmptyTable(config);
    state = sitDown(state, 0, makeBotUserId('a'), 'ProA', 1000).state;
    state = sitDown(state, 1, makeBotUserId('b'), 'ProB', 1000).state;
    state = startHand(state, config, 'h2', (n) => randomBytes(n)).state;

    // Bot with AA should almost never fold preflop when cheap
    if (state.toAct !== null) {
      state = forceHole(state, state.toAct, 'As', 'Ah');
      const intent = chooseBotAction(state, state.toAct, config);
      expect(intent).not.toBeNull();
      expect(intent!.type).not.toBe('fold');
    }
  });

  it('FoldBot knobs are tighter / less jammy than AllInAnnie', () => {
    const nit = personalityForBot(makeBotUserId('n'), 'FoldBot');
    const maniac = personalityForBot(makeBotUserId('m'), 'AllInAnnie');
    expect(nit.rangeOffset).toBeLessThan(maniac.rangeOffset);
    expect(nit.bluffRate).toBeLessThan(maniac.bluffRate);
    expect(nit.jamBias).toBeLessThan(maniac.jamBias);
    expect(nit.aggression).toBeLessThan(maniac.aggression);
  });

  it('maniac push/folds medium hands short-stacked more often than a nit', () => {
    // Build a stable short-stack decision: bot to act preflop with ~9bb and A9o.
    function setup(): { state: HandState; seat: number } {
      let state = createEmptyTable(config);
      state = sitDown(state, 0, makeBotUserId('short'), 'Shorty', 1000).state;
      state = sitDown(state, 1, 'u1', 'Hero', 1000).state;
      state = startHand(state, config, 'push-fold', () => Buffer.alloc(32, 7)).state;
      // Prefer bot as first actor: if hero is to act, fold once so only the bot remains
      // (that ends the hand). Instead force toAct onto the bot and reshape stacks.
      const botSeat = state.players.findIndex((p) => isBotUserId(p.userId));
      expect(botSeat).toBeGreaterThanOrEqual(0);
      const players = state.players.map((pl, i) => {
        if (i !== botSeat) return { ...pl, stack: 1000, bet: 0 };
        return {
          ...pl,
          stack: 90,
          bet: 0,
          status: 'active' as const,
          holeCards: [parseCard('Ah'), parseCard('9d')] as [
            import('./cards.js').Card,
            import('./cards.js').Card,
          ],
        };
      });
      return {
        state: {
          ...state,
          players,
          toAct: botSeat,
          street: 'preflop',
          currentBet: config.bigBlind,
          pot: config.smallBlind + config.bigBlind,
        },
        seat: botSeat,
      };
    }

    const { state, seat } = setup();
    const maniac = chooseBotAction(state, seat, config, BOT_PERSONALITIES.maniac);
    const nit = chooseBotAction(state, seat, config, BOT_PERSONALITIES.nit);
    expect(maniac).not.toBeNull();
    expect(nit).not.toBeNull();
    // Maniac should apply pressure (raise / jam); nit should give it up with A9o ~9bb.
    expect(['allin', 'raise', 'bet', 'call']).toContain(maniac!.type);
    expect(nit!.type).toBe('fold');
  });

  it('maps Humanoid roster name and encodes humanoid user ids', () => {
    expect(personalityForBot('bot:x', 'Humanoid').id).toBe('humanoid');
    expect(personalityForBot(makeBotUserId('h1', 'humanoid'), 'Whatever').id).toBe('humanoid');
    expect(BOT_PERSONALITIES.humanoid.bluffRate).toBeGreaterThan(1);
    expect(BOT_NAME_PERSONALITIES.Humanoid).toBe('humanoid');
  });

  it('classifies dry vs wet board textures', () => {
    expect(
      boardTexture([parseCard('As'), parseCard('7d'), parseCard('2c')]),
    ).toBe('dry');
    expect(
      boardTexture([parseCard('9h'), parseCard('8h'), parseCard('7h')]),
    ).toBe('wet');
    expect(
      boardTexture([parseCard('Kh'), parseCard('Qd'), parseCard('Jc')]),
    ).not.toBe('dry');
  });

  it('thinks longer on hard river spots than free checks', () => {
    let free = createEmptyTable(config);
    free = sitDown(free, 0, makeBotUserId('a', 'humanoid'), 'Humanoid', 1000).state;
    free = sitDown(free, 1, 'u1', 'Hero', 1000).state;
    free = startHand(free, config, 'think-free', () => Buffer.alloc(32, 3)).state;
    const botSeat = free.players.findIndex((p) => isBotUserId(p.userId));
    free = {
      ...free,
      street: 'flop',
      community: [parseCard('As'), parseCard('7d'), parseCard('2c')],
      currentBet: 0,
      pot: 30,
      toAct: botSeat,
      players: free.players.map((pl, i) =>
        i === botSeat
          ? {
              ...pl,
              bet: 0,
              status: 'active' as const,
              holeCards: [parseCard('3h'), parseCard('3d')] as [
                import('./cards.js').Card,
                import('./cards.js').Card,
              ],
            }
          : { ...pl, bet: 0, status: 'active' as const },
      ),
    };
    const freeMs = botThinkDelayMs(free, botSeat, config, BOT_PERSONALITIES.humanoid);

    let hard = createEmptyTable(config);
    hard = sitDown(hard, 0, makeBotUserId('b', 'humanoid'), 'Humanoid', 1000).state;
    hard = sitDown(hard, 1, 'u1', 'Hero', 1000).state;
    hard = startHand(hard, config, 'think-hard', () => Buffer.alloc(32, 5)).state;
    const hardSeat = hard.players.findIndex((p) => isBotUserId(p.userId));
    hard = {
      ...hard,
      street: 'river',
      community: [
        parseCard('As'),
        parseCard('7d'),
        parseCard('2c'),
        parseCard('9h'),
        parseCard('4s'),
      ],
      currentBet: 200,
      pot: 280,
      toAct: hardSeat,
      players: hard.players.map((pl, i) => {
        if (i === hardSeat) {
          return {
            ...pl,
            stack: 800,
            bet: 0,
            status: 'active' as const,
            holeCards: [parseCard('3h'), parseCard('3d')] as [
              import('./cards.js').Card,
              import('./cards.js').Card,
            ],
          };
        }
        return { ...pl, stack: 800, bet: 200, status: 'active' as const };
      }),
    };
    const hardMs = botThinkDelayMs(hard, hardSeat, config, BOT_PERSONALITIES.humanoid);

    expect(freeMs).toBeGreaterThanOrEqual(420);
    expect(freeMs).toBeLessThanOrEqual(3200);
    expect(hardMs).toBeGreaterThan(freeMs);
    expect(hardMs).toBeLessThanOrEqual(3200);
  });

  it('humanoid stabs dry flops in a bluff band more often than a nit', () => {
    function setupBluffSpot(): { state: HandState; seat: number } {
      let state = createEmptyTable(config);
      state = sitDown(state, 0, makeBotUserId('bluff'), 'Bluffer', 1000).state;
      state = sitDown(state, 1, 'u1', 'Hero', 1000).state;
      state = startHand(state, config, 'dry-bluff', () => Buffer.alloc(32, 9)).state;
      const botSeat = state.players.findIndex((p) => isBotUserId(p.userId));
      const players = state.players.map((pl, i) => {
        if (i !== botSeat) {
          return { ...pl, bet: 0, status: 'active' as const };
        }
        return {
          ...pl,
          bet: 0,
          status: 'active' as const,
          // Weak unpaired holdings on a dry board → bluff equity band
          holeCards: [parseCard('8h'), parseCard('3d')] as [
            import('./cards.js').Card,
            import('./cards.js').Card,
          ],
        };
      });
      return {
        state: {
          ...state,
          players,
          toAct: botSeat,
          street: 'flop',
          community: [parseCard('As'), parseCard('7d'), parseCard('2c')],
          currentBet: 0,
          pot: 60,
          dealerButton: botSeat,
        },
        seat: botSeat,
      };
    }

    const { state, seat } = setupBluffSpot();
    let humanoidBets = 0;
    let nitBets = 0;
    const trials = 40;
    for (let i = 0; i < trials; i++) {
      const h = chooseBotAction(state, seat, config, BOT_PERSONALITIES.humanoid);
      const n = chooseBotAction(state, seat, config, BOT_PERSONALITIES.nit);
      if (h && (h.type === 'bet' || h.type === 'raise' || h.type === 'allin')) humanoidBets += 1;
      if (n && (n.type === 'bet' || n.type === 'raise' || n.type === 'allin')) nitBets += 1;
    }
    expect(humanoidBets).toBeGreaterThan(nitBets);
    expect(humanoidBets).toBeGreaterThan(0);
  });
});
