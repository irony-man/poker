import { describe, expect, it } from 'vitest';
import { chooseBotAction } from './bot.js';
import { parseCard } from './cards.js';
import { createMatch, sit } from './match.js';
import type { CourtpieceState } from './types.js';

function basePlaying(): CourtpieceState {
  let s = createMatch({ matchId: 'bot', rulesVariant: 'classic' });
  s = sit(s, 0, 'a', 'A').state;
  s = sit(s, 1, 'b', 'B').state;
  s = sit(s, 2, 'c', 'C').state;
  s = sit(s, 3, 'd', 'D').state;
  s.phase = 'playing';
  s.trump = 's';
  s.trickLeader = 0;
  s.currentTrick = [];
  s.toAct = 1;
  s.lastHand = null;
  return s;
}

describe('chooseBotAction', () => {
  it('wins cheapest when it can take the trick', () => {
    const s = basePlaying();
    s.currentTrick = [
      { seat: 0, card: parseCard('9h') },
      { seat: 1, card: parseCard('Th') }, // overwritten — bot is seat 1
    ];
    // Reset: only seat 0 has played
    s.currentTrick = [{ seat: 0, card: parseCard('9h') }];
    s.toAct = 1;
    s.seats[1]!.hand = [parseCard('Qh'), parseCard('Kh'), parseCard('2c')];
    const action = chooseBotAction(s);
    expect(action.type).toBe('play');
    if (action.type === 'play') {
      expect(action.card).toEqual(parseCard('Qh'));
    }
  });

  it('ducks when partner is winning', () => {
    const s = basePlaying();
    // Partner of seat 2 is seat 0 — Ace led by partner
    s.currentTrick = [{ seat: 0, card: parseCard('Ah') }];
    s.toAct = 2;
    s.seats[2]!.hand = [parseCard('Kh'), parseCard('2h')];
    const action = chooseBotAction(s);
    expect(action.type).toBe('play');
    if (action.type === 'play') {
      expect(action.card).toEqual(parseCard('2h'));
    }
  });

  it('dumps low when it cannot win', () => {
    const s = basePlaying();
    s.currentTrick = [{ seat: 0, card: parseCard('Ah') }];
    s.toAct = 1;
    s.trump = 's';
    s.seats[1]!.hand = [parseCard('Kh'), parseCard('2h'), parseCard('3s')];
    const action = chooseBotAction(s);
    expect(action.type).toBe('play');
    if (action.type === 'play') {
      // Prefer non-trump dump
      expect(action.card).toEqual(parseCard('2h'));
    }
  });

  it('leads high from strongest non-trump suit', () => {
    const s = basePlaying();
    s.currentTrick = [];
    s.toAct = 0;
    s.trump = 'c';
    s.seats[0]!.hand = [
      parseCard('2c'),
      parseCard('3c'),
      parseCard('Ah'),
      parseCard('Kh'),
      parseCard('Qh'),
      parseCard('2d'),
    ];
    const action = chooseBotAction(s);
    expect(action.type).toBe('play');
    if (action.type === 'play') {
      expect(action.card.suit).toBe('h');
      expect(action.card.rank).toBe(14);
    }
  });
});
