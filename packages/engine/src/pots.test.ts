import { describe, expect, it } from 'vitest';
import { awardPots, buildSidePots } from '../src/pots.js';

describe('buildSidePots', () => {
  it('builds main and side pots for 3 all-ins', () => {
    // A: 50, B: 100, C: 300 (C covers)
    const pots = buildSidePots([
      { seat: 0, amount: 50, folded: false },
      { seat: 1, amount: 100, folded: false },
      { seat: 2, amount: 300, folded: false },
    ]);
    // Layer 50*3=150 eligible all; layer 50*2=100 eligible 1,2; layer 200*1=200 eligible 2
    expect(pots).toEqual([
      { amount: 150, eligible: [0, 1, 2] },
      { amount: 100, eligible: [1, 2] },
      { amount: 200, eligible: [2] },
    ]);
  });

  it('excludes folded from eligibility but keeps chips', () => {
    const pots = buildSidePots([
      { seat: 0, amount: 100, folded: true },
      { seat: 1, amount: 100, folded: false },
      { seat: 2, amount: 100, folded: false },
    ]);
    expect(pots).toEqual([{ amount: 300, eligible: [1, 2] }]);
  });
});

describe('awardPots', () => {
  it('splits pot on exact tie and gives odd chip left of dealer', () => {
    const awards = awardPots(
      [{ amount: 101, eligible: [0, 2] }],
      new Map([
        [0, 100],
        [2, 100],
      ]),
      0, // dealer seat 0 → left is seat 1, then 2 gets odd chip first among winners
      3,
    );
    const bySeat = Object.fromEntries(awards.map((a) => [a.seat, a.amount]));
    expect(bySeat[0]! + bySeat[2]!).toBe(101);
    expect(bySeat[2]).toBe(51); // seat 2 is closer clockwise from dealer+1
    expect(bySeat[0]).toBe(50);
  });

  it('awards side pot correctly when short stack wins main', () => {
    const pots = buildSidePots([
      { seat: 0, amount: 50, folded: false },
      { seat: 1, amount: 100, folded: false },
      { seat: 2, amount: 100, folded: false },
    ]);
    // seat 0 has best hand
    const awards = awardPots(
      pots,
      new Map([
        [0, 500],
        [1, 100],
        [2, 100],
      ]),
      0,
      3,
    );
    const bySeat = Object.fromEntries(awards.map((a) => [a.seat, a.amount]));
    expect(bySeat[0]).toBe(150); // main pot
    // side pot 100 between 1 and 2 — tie → split
    expect((bySeat[1] ?? 0) + (bySeat[2] ?? 0)).toBe(100);
  });
});
