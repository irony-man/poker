import { randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  applyAction,
  applyTimeout,
  createEmptyTable,
  sitDown,
  startHand,
  type TableConfig,
} from '@poker/engine';

const config: TableConfig = {
  maxSeats: 6,
  smallBlind: 5,
  bigBlind: 10,
  minBuyIn: 100,
  maxBuyIn: 2000,
  turnTimeMs: 1000,
};

function rng() {
  return (n: number) => randomBytes(n);
}

describe('QA edge cases', () => {
  it('timeout folds when facing a bet', () => {
    let state = createEmptyTable(config);
    state = sitDown(state, 0, 'a', 'A', 500).state;
    state = sitDown(state, 1, 'b', 'B', 500).state;
    state = startHand(state, config, 'h1', rng()).state;
    const actor = state.toAct!;
    // Raise to put pressure
    const r1 = applyAction(
      state,
      actor,
      { type: 'raise', amount: 40, seq: state.actionSeq },
      config,
    );
    expect(r1.ok).toBe(true);
    state = r1.state;
    expect(state.toAct).not.toBeNull();
    const before = state.players[state.toAct!]!.status;
    expect(before).toBe('active');
    const t = applyTimeout(state, config);
    expect(t.ok).toBe(true);
    expect(t.state.players.find((p) => p.seat === state.toAct)!.status).toBe('folded');
  });

  it('three-way all-in different stacks produces side pots and awards', () => {
    let state = createEmptyTable(config);
    state = sitDown(state, 0, 'a', 'A', 50).state;
    state = sitDown(state, 1, 'b', 'B', 100).state;
    state = sitDown(state, 2, 'c', 'C', 300).state;
    state = startHand(state, config, 'h2', rng()).state;

    let guard = 0;
    while (state.street !== 'payout' && state.toAct !== null && guard++ < 40) {
      const seat = state.toAct;
      const p = state.players[seat]!;
      const r = applyAction(
        state,
        seat,
        { type: 'raise', amount: p.bet + p.stack, seq: state.actionSeq },
        config,
      );
      if (!r.ok) {
        const r2 = applyAction(state, seat, { type: 'call', seq: state.actionSeq }, config);
        if (!r2.ok) {
          const r3 = applyAction(state, seat, { type: 'check', seq: state.actionSeq }, config);
          expect(r3.ok).toBe(true);
          state = r3.state;
        } else state = r2.state;
      } else state = r.state;
    }
    expect(state.street).toBe('payout');
    expect(state.winners.reduce((s, w) => s + w.amount, 0)).toBeGreaterThan(0);
    const totalStacks = state.players.reduce((s, p) => s + p.stack, 0);
    expect(totalStacks).toBe(450); // chips conserved
  });

  it('illegal raise when not to act leaves state unchanged', () => {
    let state = createEmptyTable(config);
    state = sitDown(state, 0, 'a', 'A', 500).state;
    state = sitDown(state, 1, 'b', 'B', 500).state;
    state = startHand(state, config, 'h3', rng()).state;
    const version = state.version;
    const notToAct = state.toAct === 0 ? 1 : 0;
    const r = applyAction(state, notToAct, { type: 'fold', seq: state.actionSeq }, config);
    expect(r.ok).toBe(false);
    expect(r.state.version).toBe(version);
  });
});
