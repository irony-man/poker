import { describe, expect, it } from 'vitest';
import {
  createMatch,
  legalMoves,
  move,
  roll,
  setReady,
  sit,
  stand,
  startMatch,
  toPublicView,
} from './index.js';
import type { LudoState, TokenPos } from './types.js';

function readyTwoPlayer(seats: [number, number] = [0, 2]): LudoState {
  let state = createMatch({ maxSeats: 2, matchId: 'm1' });
  state = sit(state, seats[0], 'u1', 'Alice').state;
  state = sit(state, seats[1], 'u2', 'Bob').state;
  state = setReady(state, seats[0], true).state;
  state = setReady(state, seats[1], true).state;
  return startMatch(state).state;
}

function setToken(state: LudoState, seat: number, tokenIndex: number, pos: TokenPos): void {
  state.seats[seat]!.tokens[tokenIndex]!.pos = pos;
}

describe('create / sit / ready / start', () => {
  it('creates four color seats and exposes turnTimeMs', () => {
    const state = createMatch({ maxSeats: 3 });
    expect(state.seats.map((s) => s.color)).toEqual(['red', 'green', 'yellow', 'blue']);
    expect(state.config.turnTimeMs).toBe(20_000);
    expect(state.phase).toBe('lobby');
    expect(toPublicView(state).turnTimeMs).toBe(20_000);
    expect(toPublicView(state).maxSeats).toBe(3);
  });

  it('starts when ≥2 seated humans are ready', () => {
    const state = readyTwoPlayer();
    expect(state.phase).toBe('rolling');
    expect(state.toAct).toBe(0);
    expect(state.seats[0]!.tokens.every((t) => t.pos.kind === 'yard')).toBe(true);
    expect(state.seats[0]!.ready).toBe(false);
  });

  it('rejects start until humans are ready and allows bots without ready', () => {
    let state = createMatch({ maxSeats: 2 });
    state = sit(state, 0, 'u1', 'Alice').state;
    state = sit(state, 1, 'bot:rex', 'Rex', { bot: true }).state;
    expect(startMatch(state).ok).toBe(false);
    state = setReady(state, 0, true).state;
    const started = startMatch(state);
    expect(started.ok).toBe(true);
    expect(started.state.toAct).toBe(0);
  });

  it('caps seating at maxSeats and blocks sit mid-match', () => {
    let state = createMatch({ maxSeats: 2 });
    state = sit(state, 0, 'u1', 'Alice').state;
    state = sit(state, 2, 'u2', 'Bob').state;
    expect(sit(state, 1, 'u3', 'Cara').ok).toBe(false);
    state = setReady(state, 0, true).state;
    state = setReady(state, 2, true).state;
    state = startMatch(state).state;
    expect(stand(state, 0).ok).toBe(false);
    expect(sit(state, 1, 'u3', 'Cara').ok).toBe(false);
  });
});

describe('leave yard', () => {
  it('requires a 6 to leave the yard onto the color start square', () => {
    const state = readyTwoPlayer();
    const miss = roll(state, 0, () => 5);
    expect(miss.ok).toBe(true);
    expect(miss.legalMoves).toEqual([]);
    expect(miss.state.phase).toBe('rolling');
    expect(miss.state.toAct).toBe(2);

    const six = roll(state, 0, () => 6);
    expect(six.legalMoves).toEqual([0, 1, 2, 3]);
    expect(six.extraTurn).toBe(true);
    const moved = move(six.state, 0, 0);
    expect(moved.ok).toBe(true);
    expect(moved.state.seats[0]!.tokens[0]!.pos).toEqual({ kind: 'main', index: 0 });
    expect(moved.extraTurn).toBe(true);
    expect(moved.state.toAct).toBe(0);
    expect(moved.state.phase).toBe('rolling');
  });
});

describe('capture vs safe / stack', () => {
  it('captures a single opponent on a non-safe square and does not grant an extra turn', () => {
    const state = readyTwoPlayer();
    setToken(state, 0, 0, { kind: 'main', index: 4 });
    setToken(state, 2, 0, { kind: 'main', index: 7 });
    const rolled = roll(state, 0, () => 3);
    expect(rolled.legalMoves).toEqual([0]);
    const moved = move(rolled.state, 0, 0);
    expect(moved.ok).toBe(true);
    expect(moved.state.seats[0]!.tokens[0]!.pos).toEqual({ kind: 'main', index: 7 });
    expect(moved.state.seats[2]!.tokens[0]!.pos).toEqual({ kind: 'yard' });
    expect(moved.captured).toEqual([{ seat: 2, tokenIndex: 0 }]);
    expect(moved.extraTurn).toBe(false);
    expect(moved.state.toAct).toBe(2);
  });

  it('does not capture on a safe square', () => {
    const state = readyTwoPlayer();
    setToken(state, 0, 0, { kind: 'main', index: 5 });
    setToken(state, 2, 0, { kind: 'main', index: 8 });
    const rolled = roll(state, 0, () => 3);
    const moved = move(rolled.state, 0, 0);
    expect(moved.state.seats[0]!.tokens[0]!.pos).toEqual({ kind: 'main', index: 8 });
    expect(moved.state.seats[2]!.tokens[0]!.pos).toEqual({ kind: 'main', index: 8 });
    expect(moved.captured).toEqual([]);
  });

  it('treats 2+ stacked opponent tokens as safe (landing blocked)', () => {
    const state = readyTwoPlayer();
    setToken(state, 0, 0, { kind: 'main', index: 4 });
    setToken(state, 2, 0, { kind: 'main', index: 7 });
    setToken(state, 2, 1, { kind: 'main', index: 7 });
    const rolled = roll(state, 0, () => 3);
    expect(rolled.legalMoves).toEqual([]);
    expect(rolled.state.toAct).toBe(2);
    expect(rolled.state.seats[2]!.tokens[0]!.pos).toEqual({ kind: 'main', index: 7 });
    expect(rolled.state.seats[2]!.tokens[1]!.pos).toEqual({ kind: 'main', index: 7 });
  });
});

describe('exact home', () => {
  it('requires an exact roll to enter home and overshoot is illegal', () => {
    const state = readyTwoPlayer();
    setToken(state, 0, 0, { kind: 'stretch', index: 3 });
    const overshoot = roll(state, 0, () => 3);
    expect(overshoot.legalMoves).toEqual([]);
    expect(overshoot.state.toAct).toBe(2);

    const exact = roll(state, 0, () => 2);
    expect(exact.legalMoves).toEqual([0]);
    const moved = move(exact.state, 0, 0);
    expect(moved.state.seats[0]!.tokens[0]!.pos).toEqual({ kind: 'home' });
  });

  it('enters home from the last stretch square on a 1', () => {
    const state = readyTwoPlayer();
    setToken(state, 0, 0, { kind: 'stretch', index: 4 });
    const rolled = roll(state, 0, () => 1);
    expect(legalMoves(rolled.state)).toEqual([0]);
    const moved = move(rolled.state, 0, 0);
    expect(moved.state.seats[0]!.tokens[0]!.pos).toEqual({ kind: 'home' });
  });
});

describe('three consecutive 6s', () => {
  it('forfeits the third 6 with no leftover move', () => {
    let state = readyTwoPlayer();
    let r = roll(state, 0, () => 6);
    state = move(r.state, 0, 0).state;
    expect(state.seats[0]!.tokens[0]!.pos).toEqual({ kind: 'main', index: 0 });

    r = roll(state, 0, () => 6);
    state = move(r.state, 0, 0).state;
    expect(state.seats[0]!.tokens[0]!.pos).toEqual({ kind: 'main', index: 6 });
    expect(state.toAct).toBe(0);

    r = roll(state, 0, () => 6);
    expect(r.ok).toBe(true);
    expect(r.die).toBe(6);
    expect(r.legalMoves).toEqual([]);
    expect(r.extraTurn).toBe(false);
    expect(r.state.toAct).toBe(2);
    expect(r.state.phase).toBe('rolling');
    expect(r.state.seats[0]!.tokens[0]!.pos).toEqual({ kind: 'main', index: 6 });
    expect(r.state.consecutiveSixes).toBe(0);
    expect(r.events.some((e) => e.type === 'turn_forfeit' && e.reason === 'three_sixes')).toBe(
      true,
    );
  });
});

describe('no legal move', () => {
  it('passes the turn when every token is in the yard and the roll is not 6', () => {
    const state = readyTwoPlayer();
    const r = roll(state, 0, () => 4);
    expect(r.legalMoves).toEqual([]);
    expect(r.state.toAct).toBe(2);
    expect(r.state.phase).toBe('rolling');
    expect(r.events.some((e) => e.type === 'turn_forfeit' && e.reason === 'no_moves')).toBe(true);
  });
});

describe('2-player win', () => {
  it('ends the match immediately when all four tokens are home', () => {
    const state = readyTwoPlayer([0, 2]);
    setToken(state, 0, 0, { kind: 'home' });
    setToken(state, 0, 1, { kind: 'home' });
    setToken(state, 0, 2, { kind: 'home' });
    setToken(state, 0, 3, { kind: 'stretch', index: 4 });
    const rolled = roll(state, 0, () => 1);
    expect(rolled.legalMoves).toEqual([3]);
    const moved = move(rolled.state, 0, 3);
    expect(moved.ok).toBe(true);
    expect(moved.state.phase).toBe('finished');
    expect(moved.state.winnerSeat).toBe(0);
    expect(moved.state.toAct).toBeNull();
    expect(moved.extraTurn).toBe(false);
    expect(moved.state.seats[0]!.tokens.every((t) => t.pos.kind === 'home')).toBe(true);
    expect(toPublicView(moved.state).winnerSeat).toBe(0);
  });

  it('does not grant an extra turn on a winning 6', () => {
    const state = readyTwoPlayer();
    setToken(state, 0, 0, { kind: 'home' });
    setToken(state, 0, 1, { kind: 'home' });
    setToken(state, 0, 2, { kind: 'home' });
    setToken(state, 0, 3, { kind: 'main', index: 51 });
    const moved = move(roll(state, 0, () => 6).state, 0, 3);
    expect(moved.state.phase).toBe('finished');
    expect(moved.extraTurn).toBe(false);
    expect(moved.state.winnerSeat).toBe(0);
  });
});

describe('turn / seq guards', () => {
  it('rejects roll or move from the wrong seat', () => {
    const state = readyTwoPlayer();
    expect(roll(state, 2, () => 6).ok).toBe(false);
    const rolled = roll(state, 0, () => 6);
    expect(move(rolled.state, 2, 0).ok).toBe(false);
    expect(move(rolled.state, 0, 0, rolled.state.actionSeq + 1).ok).toBe(false);
  });
});
