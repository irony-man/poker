import { describe, expect, it } from 'vitest';
import { createMatch, roll, setReady, sit, startMatch } from './match.js';
import { resolveMove } from './rules.js';

describe('resolveMove', () => {
  it('applies ladders and snakes', () => {
    expect(resolveMove(1, 3)).toEqual({ to: 14, teleport: 14 }); // 4→14
    expect(resolveMove(10, 7)).toEqual({ to: 7, teleport: 7 }); // 17→7
  });

  it('bounces past 100', () => {
    expect(resolveMove(98, 5)).toEqual({ to: 97, teleport: null }); // 103 → 97
  });

  it('wins on exact 100', () => {
    expect(resolveMove(97, 3)).toEqual({ to: 100, teleport: null });
  });
});

describe('match', () => {
  it('plays to a winner', () => {
    let s = createMatch({ maxSeats: 2, matchId: 't' });
    s = sit(s, 0, 'a', 'A').state;
    s = sit(s, 1, 'b', 'B').state;
    s = setReady(s, 0, true).state;
    s = setReady(s, 1, true).state;
    s = startMatch(s).state;
    expect(s.phase).toBe('rolling');
    expect(s.toAct).toBe(0);

    // Force win for seat 0
    s.seats[0]!.position = 97;
    const r = roll(s, 0, () => 3);
    expect(r.ok).toBe(true);
    expect(r.state.phase).toBe('finished');
    expect(r.state.winnerSeat).toBe(0);
  });
});
