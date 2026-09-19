import { describe, expect, it } from 'vitest';
import {
  applyAction,
  createEmptyTable,
  muckHand,
  returnToWaiting,
  showHand,
  sitDown,
  sitIn,
  sitOut,
  startHand,
  type TableConfig,
} from '../src/hand.js';

const config: TableConfig = {
  maxSeats: 6,
  smallBlind: 5,
  bigBlind: 10,
  buyIn: 1000,
  turnTimeMs: 15000,
};

/** Deterministic RNG from a seed sequence. */
function fixedRng(bytes: number[]): (n: number) => Uint8Array {
  let i = 0;
  return (n: number) => {
    const out = new Uint8Array(n);
    for (let j = 0; j < n; j++) {
      out[j] = bytes[i % bytes.length]!;
      i++;
    }
    return out;
  };
}

function setupTwoPlayers() {
  let state = createEmptyTable(config);
  state = sitDown(state, 0, 'u1', 'Alice', 500).state;
  state = sitDown(state, 1, 'u2', 'Bob', 500).state;
  return state;
}

describe('hand lifecycle', () => {
  it('posts blinds and deals hole cards', () => {
    let state = setupTwoPlayers();
    const result = startHand(state, config, 'hand-1', fixedRng([1, 2, 3, 4, 5, 6, 7, 8]));
    expect(result.ok).toBe(true);
    state = result.state;
    expect(state.street).toBe('preflop');
    expect(state.players[0]!.holeCards).not.toBeNull();
    expect(state.players[1]!.holeCards).not.toBeNull();
    expect(state.pot).toBe(15);
  });

  it('heads-up: button acts first preflop', () => {
    let state = setupTwoPlayers();
    state = startHand(state, config, 'hand-1', fixedRng([9, 8, 7, 6, 5, 4, 3, 2])).state;
    // After start, dealer is moved to first occupied from 0 → seat 1? 
    // nextOccupiedSeat from dealerButton 0 → finds seat 1 first with active...
    // Actually reset keeps dealerButton 0, then nextOccupiedSeat(0) returns seat 1
    // HU: sb = dealer = 1, bb = 0, toAct = sb = 1
    expect(state.toAct).toBe(state.sbSeat);
  });

  it('fold awards pot without showdown reveal', () => {
    let state = setupTwoPlayers();
    state = startHand(state, config, 'hand-1', fixedRng([1, 2, 3, 4])).state;
    const actor = state.toAct!;
    const other = actor === 0 ? 1 : 0;
    const before = state.players[other]!.stack;
    const pot = state.pot;
    const r = applyAction(state, actor, { type: 'fold', seq: state.actionSeq }, config);
    expect(r.ok).toBe(true);
    state = r.state;
    expect(state.street).toBe('payout');
    expect(state.players[other]!.stack).toBe(before + pot);
    expect(state.players[other]!.revealed).toBe(false);
    expect(state.players[actor]!.revealed).toBe(false);
    expect(state.winners[0]?.handName).toBeUndefined();
  });

  it('rejects action when not to act', () => {
    let state = setupTwoPlayers();
    state = startHand(state, config, 'hand-1', fixedRng([1, 2, 3, 4])).state;
    const notToAct = state.toAct === 0 ? 1 : 0;
    const r = applyAction(state, notToAct, { type: 'fold', seq: state.actionSeq }, config);
    expect(r.ok).toBe(false);
  });

  it('rejects stale action seq', () => {
    let state = setupTwoPlayers();
    state = startHand(state, config, 'hand-1', fixedRng([1, 2, 3, 4])).state;
    const r = applyAction(state, state.toAct!, { type: 'fold', seq: state.actionSeq + 1 }, config);
    expect(r.ok).toBe(false);
  });

  it('check/check through streets to showdown', () => {
    let state = createEmptyTable(config);
    state = sitDown(state, 0, 'u1', 'Alice', 1000).state;
    state = sitDown(state, 1, 'u2', 'Bob', 1000).state;
    state = sitDown(state, 2, 'u3', 'Carol', 1000).state;
    state = startHand(state, config, 'hand-1', fixedRng([11, 22, 33, 44, 55, 66, 77, 88, 99])).state;

    // Preflop: UTG call, SB call, BB check — or fold to simplify
    let guard = 0;
    while (state.street === 'preflop' && state.toAct !== null && guard++ < 20) {
      const seat = state.toAct;
      const p = state.players[seat]!;
      const toCall = state.currentBet - p.bet;
      const r = applyAction(
        state,
        seat,
        toCall > 0 ? { type: 'call', seq: state.actionSeq } : { type: 'check', seq: state.actionSeq },
        config,
      );
      expect(r.ok).toBe(true);
      state = r.state;
    }
    expect(['flop', 'turn', 'river', 'showdown', 'payout']).toContain(state.street);

    while (
      (state.street === 'flop' || state.street === 'turn' || state.street === 'river') &&
      state.toAct !== null &&
      guard++ < 50
    ) {
      const r = applyAction(state, state.toAct, { type: 'check', seq: state.actionSeq }, config);
      expect(r.ok).toBe(true);
      state = r.state;
    }
    expect(state.street).toBe('payout');
    expect(state.winners.length).toBeGreaterThan(0);
    state = returnToWaiting(state);
    expect(state.street).toBe('waiting');
  });

  it('human fold vs bots ends hand without bot-vs-bot betting', () => {
    let state = createEmptyTable(config);
    state = sitDown(state, 0, 'human-1', 'You', 500).state;
    state = sitDown(state, 1, 'bot:a', 'AceBot', 500).state;
    state = sitDown(state, 2, 'bot:b', 'RiverRat', 500).state;
    state = startHand(state, config, 'hand-bots', fixedRng([1, 2, 3, 4, 5, 6, 7, 8, 9])).state;

    let guard = 0;
    while (state.street !== 'payout' && state.toAct !== null && guard++ < 30) {
      const seat = state.toAct;
      const actor = state.players[seat]!;
      if (actor.userId === 'human-1') {
        const r = applyAction(state, seat, { type: 'fold', seq: state.actionSeq }, config);
        expect(r.ok).toBe(true);
        state = r.state;
        break;
      }
      const toCall = state.currentBet - actor.bet;
      const type = toCall > 0 ? 'call' : 'check';
      const r = applyAction(state, seat, { type, seq: state.actionSeq }, config);
      expect(r.ok).toBe(true);
      state = r.state;
    }

    expect(state.street).toBe('payout');
    expect(state.players.find((p) => p.userId === 'human-1')!.status).toBe('folded');
    expect(state.toAct).toBeNull();
  });

  it('contested showdown auto-reveals winners only', () => {
    let state = createEmptyTable(config);
    state = sitDown(state, 0, 'u1', 'Alice', 1000).state;
    state = sitDown(state, 1, 'u2', 'Bob', 1000).state;
    state = startHand(state, config, 'hand-show', fixedRng([11, 22, 33, 44, 55, 66, 77, 88])).state;

    let guard = 0;
    while (state.street !== 'payout' && state.toAct !== null && guard++ < 80) {
      const seat = state.toAct;
      const p = state.players[seat]!;
      const toCall = state.currentBet - p.bet;
      const r = applyAction(
        state,
        seat,
        toCall > 0 ? { type: 'call', seq: state.actionSeq } : { type: 'check', seq: state.actionSeq },
        config,
      );
      expect(r.ok).toBe(true);
      state = r.state;
    }
    expect(state.street).toBe('payout');
    const winnerSeats = new Set(state.winners.map((w) => w.seat));
    for (const p of state.players) {
      if (!p.holeCards || p.status === 'folded') continue;
      if (winnerSeats.has(p.seat)) {
        expect(p.revealed).toBe(true);
      } else {
        expect(p.revealed).toBe(false);
      }
    }
  });

  it('showHand and muckHand during payout', () => {
    let state = setupTwoPlayers();
    state = startHand(state, config, 'hand-1', fixedRng([1, 2, 3, 4])).state;
    const actor = state.toAct!;
    const other = actor === 0 ? 1 : 0;
    state = applyAction(state, actor, { type: 'fold', seq: state.actionSeq }, config).state;
    expect(state.street).toBe('payout');
    expect(state.players[other]!.revealed).toBe(false);

    const shown = showHand(state, other);
    expect(shown.ok).toBe(true);
    state = shown.state;
    expect(state.players[other]!.revealed).toBe(true);
    expect(state.showdownHands.some((h) => h.seat === other)).toBe(true);

    // Cannot muck after show
    expect(muckHand(state, other).ok).toBe(false);

    // Fresh uncontested for muck
    state = returnToWaiting(state);
    state = startHand(state, config, 'hand-2', fixedRng([5, 6, 7, 8])).state;
    const a2 = state.toAct!;
    const o2 = a2 === 0 ? 1 : 0;
    state = applyAction(state, a2, { type: 'fold', seq: state.actionSeq }, config).state;
    const mucked = muckHand(state, o2);
    expect(mucked.ok).toBe(true);
    state = mucked.state;
    expect(state.players[o2]!.mucked).toBe(true);
    expect(state.players[o2]!.revealed).toBe(false);
    expect(showHand(state, o2).ok).toBe(false);
  });

  it('sitting out skips hands but keeps seat and stack', () => {
    let state = createEmptyTable(config);
    state = sitDown(state, 0, 'human-1', 'You', 500).state;
    state = sitDown(state, 1, 'bot:a', 'AceBot', 500).state;
    state = sitDown(state, 2, 'bot:b', 'RiverRat', 500).state;

    const out = sitOut(state, 0);
    expect(out.ok).toBe(true);
    state = out.state;
    expect(state.players[0]!.status).toBe('sittingOut');
    expect(state.players[0]!.stack).toBe(500);

    state = startHand(state, config, 'hand-sitout', fixedRng([1, 2, 3, 4, 5, 6, 7, 8, 9])).state;
    expect(state.players[0]!.status).toBe('sittingOut');
    expect(state.players[0]!.holeCards).toBeNull();
    expect(state.players.filter((p) => p.status === 'active').length).toBe(2);

    state = returnToWaiting(state);
    expect(state.players[0]!.status).toBe('sittingOut');

    const back = sitIn(state, 0);
    expect(back.ok).toBe(true);
    state = back.state;
    expect(state.players[0]!.status).toBe('seated');
  });
});
