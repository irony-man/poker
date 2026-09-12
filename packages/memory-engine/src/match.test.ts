import { describe, expect, it } from 'vitest';
import { createMatch, flip, resolveMiss, setReady, sit, startMatch } from './match.js';

describe('memory match', () => {
  it('matches keep turn; miss passes turn', () => {
    let s = createMatch({ maxSeats: 2, matchId: 'm', gridSize: 16 });
    s = sit(s, 0, 'a', 'A').state;
    s = sit(s, 1, 'b', 'B').state;
    s = setReady(s, 0, true).state;
    s = setReady(s, 1, true).state;

    // Deterministic deck: pairs adjacent [0,0,1,1,...]
    const shuffle = <T>(arr: T[]) => {
      const out: T[] = [];
      const n = arr.length / 2;
      for (let i = 0; i < n; i++) {
        out.push(arr[i * 2]!, arr[i * 2 + 1]!);
      }
      return out;
    };
    // buildDeck maps shuffled ids — inject identity order by providing already-paired list
    // Easier: startMatch then overwrite cards
    s = startMatch(s).state;
    s.cards = Array.from({ length: 16 }, (_, i) => ({
      pairId: Math.floor(i / 2),
      matched: false,
    }));
    s.toAct = 0;
    s.phase = 'playing';
    s.faceUp = [];

    let r = flip(s, 0, 0);
    expect(r.ok).toBe(true);
    s = r.state;
    r = flip(s, 0, 1);
    expect(r.ok).toBe(true);
    expect(r.state.seats[0]!.pairs).toBe(1);
    expect(r.state.toAct).toBe(0);
    expect(r.state.phase).toBe('playing');
    s = r.state;

    r = flip(s, 0, 2);
    s = r.state;
    r = flip(s, 0, 4); // miss: pair 1 vs pair 2
    expect(r.ok).toBe(true);
    expect(r.state.phase).toBe('resolving');
    s = r.state;
    r = resolveMiss(s);
    expect(r.state.toAct).toBe(1);
    expect(r.state.phase).toBe('playing');
  });
});
