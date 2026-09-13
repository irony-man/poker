import { describe, expect, it } from 'vitest';
import { parseCard } from './cards.js';
import {
  createMatch,
  playCard,
  setReady,
  setTrump,
  sit,
  startMatch,
} from './match.js';
import { legalCards, scoreHand, teamOf, trickWinner } from './rules.js';
import type { CourtpieceState } from './types.js';

function seatFour(variant: 'classic' | 'classic_full' | 'hokm' = 'classic') {
  let s = createMatch({ matchId: 't', rulesVariant: variant });
  s = sit(s, 0, 'a', 'A').state;
  s = sit(s, 1, 'b', 'B').state;
  s = sit(s, 2, 'c', 'C').state;
  s = sit(s, 3, 'd', 'D').state;
  s = setReady(s, 0, true).state;
  s = setReady(s, 1, true).state;
  s = setReady(s, 2, true).state;
  s = setReady(s, 3, true).state;
  return s;
}

describe('partners', () => {
  it('maps seats to teams', () => {
    expect(teamOf(0)).toBe(0);
    expect(teamOf(2)).toBe(0);
    expect(teamOf(1)).toBe(1);
    expect(teamOf(3)).toBe(1);
  });
});

describe('trickWinner', () => {
  it('follows suit and trump beats', () => {
    const plays = [
      { seat: 0, card: parseCard('9h') },
      { seat: 1, card: parseCard('Kh') },
      { seat: 2, card: parseCard('2s') },
      { seat: 3, card: parseCard('Ah') },
    ];
    expect(trickWinner(plays, 's')).toBe(2); // trump
    expect(trickWinner(plays, 'd')).toBe(3); // ace of led
  });
});

describe('classic deal and trump', () => {
  it('deals 13 and sets trump then plays', () => {
    let s = seatFour('classic');
    const identity = <T>(a: T[]) => a;
    s = startMatch(s, { shuffle: identity }).state;
    expect(s.phase).toBe('choosing_trump');
    expect(s.seats.every((p) => p.hand.length === 13)).toBe(true);
    expect(s.trumpSetter).toBe(1); // left of dealer 0

    const r = setTrump(s, 1, 'h');
    expect(r.ok).toBe(true);
    s = r.state;
    expect(s.phase).toBe('playing');
    expect(s.trump).toBe('h');
    expect(s.toAct).toBe(1);
  });
});

describe('hokm preview', () => {
  it('gives hakem 5 then completes after trump', () => {
    let s = seatFour('hokm');
    const identity = <T>(a: T[]) => a;
    s = startMatch(s, { shuffle: identity }).state;
    expect(s.phase).toBe('choosing_trump');
    expect(s.hakem).toBe(0);
    expect(s.seats[0]!.hand.length).toBe(5);
    expect(s.seats[1]!.hand.length).toBe(0);
    expect(s.undealt.length).toBe(47);

    s = setTrump(s, 0, 's').state;
    expect(s.seats.every((p) => p.hand.length === 13)).toBe(true);
    expect(s.undealt.length).toBe(0);
    expect(s.toAct).toBe(0);
  });
});

describe('follow suit', () => {
  it('requires following when able', () => {
    let s = seatFour('classic');
    s = startMatch(s).state;
    s = setTrump(s, s.trumpSetter!, 'c').state;

    // Force hands
    s.seats[0]!.hand = [parseCard('Ah'), parseCard('2c')];
    s.seats[1]!.hand = [parseCard('Kh'), parseCard('3d')];
    s.seats[2]!.hand = [parseCard('Qh'), parseCard('4d')];
    s.seats[3]!.hand = [parseCard('Jh'), parseCard('5d')];
    s.toAct = 0;
    s.trickLeader = 0;
    s.currentTrick = [];
    s.phase = 'playing';
    s.trump = 'c';

    s = playCard(s, 0, parseCard('Ah')).state;
    const legal = legalCards(s, 1);
    expect(legal.map((c) => `${c.rank}${c.suit}`)).toEqual(['13h']);
    const bad = playCard(s, 1, parseCard('3d'));
    expect(bad.ok).toBe(false);
    const good = playCard(s, 1, parseCard('Kh'));
    expect(good.ok).toBe(true);
  });
});

describe('classic_full scoring', () => {
  it('awards 2 hands for court', () => {
    const s = {
      config: { rulesVariant: 'classic_full' as const, turnTimeMs: 1, handsToWin: 7 },
      seats: [
        { seat: 0, tricksThisHand: 7, status: 'seated' },
        { seat: 1, tricksThisHand: 0, status: 'seated' },
        { seat: 2, tricksThisHand: 6, status: 'seated' },
        { seat: 3, tricksThisHand: 0, status: 'seated' },
      ],
    } as unknown as CourtpieceState;
    // team0 = 13
    const scored = scoreHand(s);
    expect(scored.winningTeam).toBe(0);
    expect(scored.handsAwarded).toBe(2);
  });

  it('awards 2 hands for baazi', () => {
    const s = {
      config: { rulesVariant: 'classic_full' as const, turnTimeMs: 1, handsToWin: 7 },
      seats: [
        { seat: 0, tricksThisHand: 5, status: 'seated' },
        { seat: 1, tricksThisHand: 2, status: 'seated' },
        { seat: 2, tricksThisHand: 5, status: 'seated' },
        { seat: 3, tricksThisHand: 1, status: 'seated' },
      ],
    } as unknown as CourtpieceState;
    // team0=10, team1=3 → baazi
    const scored = scoreHand(s);
    expect(scored.winningTeam).toBe(0);
    expect(scored.handsAwarded).toBe(2);
  });
});
