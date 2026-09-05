import { describe, expect, it } from 'vitest';
import { chooseBotAction, chooseBotToken, createMatch, roll, setReady, sit, startMatch } from './index.js';
import type { LudoState, TokenPos } from './types.js';

function readyTwoPlayer(): LudoState {
  let state = createMatch({ maxSeats: 2 });
  state = sit(state, 0, 'bot:a', 'A', { bot: true }).state;
  state = sit(state, 2, 'u2', 'Bob').state;
  state = setReady(state, 2, true).state;
  return startMatch(state).state;
}

function setToken(state: LudoState, seat: number, tokenIndex: number, pos: TokenPos): void {
  state.seats[seat]!.tokens[tokenIndex]!.pos = pos;
}

describe('bot helper', () => {
  it('rolls when the phase is rolling', () => {
    const state = readyTwoPlayer();
    expect(chooseBotAction(state)).toEqual({ type: 'roll' });
  });

  it('prefers capture over enter-home / leave-yard / advance', () => {
    const state = readyTwoPlayer();
    setToken(state, 0, 0, { kind: 'main', index: 4 });
    setToken(state, 0, 1, { kind: 'stretch', index: 2 });
    setToken(state, 0, 2, { kind: 'yard' });
    setToken(state, 0, 3, { kind: 'main', index: 40 });
    setToken(state, 2, 0, { kind: 'main', index: 7 });
    const rolled = roll(state, 0, () => 3);
    expect(chooseBotToken(rolled.state)).toBe(0);
    expect(chooseBotAction(rolled.state)).toEqual({ type: 'move', tokenIndex: 0 });
  });

  it('prefers enter home over leave yard and advance', () => {
    const state = readyTwoPlayer();
    setToken(state, 0, 0, { kind: 'main', index: 51 });
    setToken(state, 0, 1, { kind: 'yard' });
    setToken(state, 0, 2, { kind: 'main', index: 20 });
    setToken(state, 0, 3, { kind: 'yard' });
    const rolled = roll(state, 0, () => 6);
    expect(chooseBotToken(rolled.state)).toBe(0);
  });

  it('prefers leave yard over advancing when both are legal', () => {
    const state = readyTwoPlayer();
    setToken(state, 0, 0, { kind: 'yard' });
    setToken(state, 0, 1, { kind: 'main', index: 10 });
    const rolled = roll(state, 0, () => 6);
    expect(chooseBotToken(rolled.state)).toBe(0);
  });

  it('advances the token closest to home', () => {
    const state = readyTwoPlayer();
    setToken(state, 0, 0, { kind: 'main', index: 3 });
    setToken(state, 0, 1, { kind: 'main', index: 30 });
    setToken(state, 0, 2, { kind: 'home' });
    setToken(state, 0, 3, { kind: 'home' });
    const rolled = roll(state, 0, () => 2);
    expect(chooseBotToken(rolled.state)).toBe(1);
  });
});
