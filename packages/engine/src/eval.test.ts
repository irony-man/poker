import { describe, expect, it } from 'vitest';
import { parseCards } from '../src/cards.js';
import { HandCategory, categoryOf, compareHandRanks, evaluateBest, evaluate5 } from '../src/eval.js';

describe('evaluate5', () => {
  it('ranks royal flush highest', () => {
    const royal = evaluate5(parseCards('As Ks Qs Js Ts'));
    const quads = evaluate5(parseCards('Ah Ad Ac As Kh'));
    expect(compareHandRanks(royal, quads)).toBeGreaterThan(0);
    expect(categoryOf(royal)).toBe(HandCategory.StraightFlush);
  });

  it('detects wheel straight', () => {
    const wheel = evaluate5(parseCards('As 2d 3c 4h 5s'));
    expect(categoryOf(wheel)).toBe(HandCategory.Straight);
  });

  it('detects full house', () => {
    const fh = evaluate5(parseCards('Ah Ad Ac Kh Kd'));
    expect(categoryOf(fh)).toBe(HandCategory.FullHouse);
  });

  it('kicker decides high card', () => {
    const a = evaluate5(parseCards('Ah Kd 9c 5s 2d'));
    const b = evaluate5(parseCards('Ah Kd 8c 5s 2d'));
    expect(compareHandRanks(a, b)).toBeGreaterThan(0);
  });
});

describe('evaluateBest 7-card', () => {
  it('finds best five from seven', () => {
    // Pair of aces with flush available on board+hand
    const rank = evaluateBest(parseCards('Ah Kh 2h 3h 4h 9c 9d'));
    expect(categoryOf(rank)).toBe(HandCategory.Flush);
  });

  it('exact tie ranks equal', () => {
    const board = parseCards('As Kd 9c 5h 2d');
    const a = evaluateBest([...parseCards('Ah Kh'), ...board]);
    const b = evaluateBest([...parseCards('Ac Kc'), ...board]);
    expect(a).toBe(b);
  });
});
