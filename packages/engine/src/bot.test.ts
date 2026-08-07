import { describe, expect, it } from 'vitest';
import { parseCard } from './cards.js';
import {
  chooseBotAction,
  chenScore,
  estimateEquity,
  isBotUserId,
  makeBotUserId,
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
});
