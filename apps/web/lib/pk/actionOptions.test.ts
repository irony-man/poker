import { describe, expect, it } from 'vitest';
import {
  applyAction,
  createEmptyTable,
  legalActions,
  sitDown,
  startHand,
  type TableConfig,
} from '@poker/engine';
import { actionBarModel, clampRaise, raisePresets, timerRing } from './actionOptions';

const config: TableConfig = {
  maxSeats: 2,
  smallBlind: 5,
  bigBlind: 10,
  buyIn: 1000,
  turnTimeMs: 20000,
};

function headsUp() {
  let state = createEmptyTable(config);
  state = sitDown(state, 0, 'a', 'Ada', 1000).state;
  state = sitDown(state, 1, 'b', 'Bea', 1000).state;
  return startHand(state, config, 'h1', () => new Uint8Array(32).fill(7)).state;
}

describe('action bar', () => {
  it('matches legal actions from the engine', () => {
    const state = headsUp();
    const seat = state.toAct!;
    const legal = legalActions(state, seat, config);
    const bar = actionBarModel(legal, state.pot, state.currentBet, config.bigBlind);
    expect(bar.types).toEqual([...legal.types]);
    expect(bar.callAmount).toBe(legal.callAmount);
    expect(bar.min).toBe(legal.minRaiseTo);
    expect(bar.max).toBe(legal.maxRaiseTo);
  });

  it('clamps raise presets inside the legal bounds', () => {
    const state = headsUp();
    const seat = state.toAct!;
    const legal = legalActions(state, seat, config);
    const presets = raisePresets(state.pot, state.currentBet, legal.minRaiseTo, legal.maxRaiseTo, config.bigBlind);
    expect(presets.halfPot).toBeGreaterThanOrEqual(legal.minRaiseTo);
    expect(presets.halfPot).toBeLessThanOrEqual(legal.maxRaiseTo);
    expect(clampRaise(1, legal.minRaiseTo, legal.maxRaiseTo, config.bigBlind)).toBe(legal.minRaiseTo);
    expect(clampRaise(999999, legal.minRaiseTo, legal.maxRaiseTo, config.bigBlind)).toBeLessThanOrEqual(legal.maxRaiseTo);
    const raised = applyAction(state, seat, { type: 'call', seq: state.actionSeq }, config);
    expect(raised.ok).toBe(true);
  });

  it('marks the last five seconds on the timer ring', () => {
    const now = 10_000;
    expect(timerRing(now, now + 4_000, 20_000).warning).toBe(true);
    expect(timerRing(now, now + 8_000, 20_000).warning).toBe(false);
    expect(timerRing(now, now + 10_000, 20_000).fraction).toBeCloseTo(0.5);
  });
});
