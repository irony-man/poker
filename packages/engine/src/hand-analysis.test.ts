import { describe, expect, it } from 'vitest';
import { createDeck, parseCards, type Card } from '../src/cards.js';
import { evaluateBest } from '../src/eval.js';
import {
  analyzeHand,
  computeEquity,
  fastHandRank,
  handOpponents,
  handPayouts,
  isAnalyzableHand,
} from '../src/hand-analysis.js';
import type { HandResultPayload } from '../src/player-exploit.js';

const c = (s: string) => parseCards(s);
const hole = (s: string) => parseCards(s) as [Card, Card];

function streetEvents(board: string) {
  const cards = c(board);
  return [
    { type: 'street', street: 'flop', cards: cards.slice(0, 3) },
    { type: 'street', street: 'turn', cards: cards.slice(3, 4) },
    { type: 'street', street: 'river', cards: cards.slice(4, 5) },
  ];
}

describe('fastHandRank', () => {
  it('matches evaluateBest on random 5–7 card hands', () => {
    let seed = 12345;
    const rand = () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed / 0x7fffffff;
    };
    for (let t = 0; t < 20000; t++) {
      const deck = createDeck();
      const n = 5 + (t % 3);
      const cards = [];
      for (let i = 0; i < n; i++) cards.push(deck.splice(Math.floor(rand() * deck.length), 1)[0]!);
      expect(fastHandRank(cards)).toBe(evaluateBest(cards));
    }
  });

  it('handles wheel straights and double trips', () => {
    expect(fastHandRank(c('Ah 2d 3c 4s 5h Kd Kc'))).toBe(evaluateBest(c('Ah 2d 3c 4s 5h Kd Kc')));
    expect(fastHandRank(c('Ah Ad Ac Ks Kh Kd 2c'))).toBe(evaluateBest(c('Ah Ad Ac Ks Kh Kd 2c')));
    expect(fastHandRank(c('Ah 2h 3h 4h 5h Kh 9c'))).toBe(evaluateBest(c('Ah 2h 3h 4h 5h Kh 9c')));
  });
});

describe('computeEquity', () => {
  it('gives aces about 82% preflop against kings', () => {
    const eq = computeEquity(
      [
        { seat: 0, hole: hole('Ah Ad') },
        { seat: 1, hole: hole('Kh Kd') },
      ],
      [],
      { seed: 7 },
    );
    expect(eq.get(0)).toBeGreaterThan(78);
    expect(eq.get(0)).toBeLessThan(86);
    expect((eq.get(0) ?? 0) + (eq.get(1) ?? 0)).toBeCloseTo(100, 0);
  });

  it('is exact on a complete board', () => {
    const eq = computeEquity(
      [
        { seat: 0, hole: hole('Ah Ad') },
        { seat: 1, hole: hole('Kh Kd') },
      ],
      c('Ks 7c 2d 9h 3s'),
    );
    expect(eq.get(1)).toBe(100);
    expect(eq.get(0)).toBe(0);
  });

  it('splits ties evenly', () => {
    const eq = computeEquity(
      [
        { seat: 0, hole: hole('2h 3d') },
        { seat: 1, hole: hole('2c 3s') },
      ],
      c('As Ks Qs Js Ts'),
    );
    expect(eq.get(0)).toBe(50);
    expect(eq.get(1)).toBe(50);
  });

  it('is stable for the same seed', () => {
    const hands = [
      { seat: 0, hole: hole('Ah Kh') },
      { seat: 1, hole: null },
    ];
    expect(computeEquity(hands, [], { seed: 3 })).toEqual(computeEquity(hands, [], { seed: 3 }));
  });
});

describe('analyzeHand', () => {
  const botHand: HandResultPayload = {
    winners: [{ seat: 0, amount: 40 }],
    community: c('Ks 7c 2d 9h 3s'),
    players: [
      { seat: 0, userId: 'u1', name: 'Hero', revealed: true, holeCards: c('Ah Ad') },
      { seat: 1, userId: 'bot:tight:a', name: 'Tia', revealed: false, holeCards: c('Qh Jh') },
      { seat: 2, userId: 'bot:loose:b', name: 'Lou', revealed: true, holeCards: c('Kh Kd') },
    ],
    actions: [
      { type: 'hand_started', handId: 'h1' },
      { type: 'blinds_posted', sb: 1, bb: 2, sbSeat: 1, bbSeat: 2 },
      { type: 'action', seat: 0, action: 'raise', amount: 6 },
      { type: 'action', seat: 1, action: 'call', amount: 5 },
      { type: 'action', seat: 2, action: 'call', amount: 4 },
      ...streetEvents('Ks 7c 2d 9h 3s').slice(0, 1),
      { type: 'action', seat: 1, action: 'fold', amount: 0 },
      ...streetEvents('Ks 7c 2d 9h 3s').slice(1),
    ],
  };

  it('lists every bet with the chips paid and the running pot', () => {
    const analysis = analyzeHand(botHand, 'u1', { seed: 'h1' });
    const preflop = analysis.streets[0]!;
    expect(preflop.potStart).toBe(0);
    expect(
      preflop.actions.map((a) => [a.seat, a.kind, a.amount, a.streetTotal, a.potAfter]),
    ).toEqual([
      [1, 'small_blind', 1, 1, 1],
      [2, 'big_blind', 2, 2, 3],
      [0, 'raise', 6, 6, 9],
      [1, 'call', 5, 6, 14],
      [2, 'call', 4, 6, 18],
    ]);
    expect(preflop.actions[2]!.isViewer).toBe(true);
    const flop = analysis.streets[1]!;
    expect(flop.potStart).toBe(18);
    expect(flop.actions.map((a) => a.kind)).toEqual(['fold']);
  });

  it('tracks each player balance through the betting', () => {
    const hand: HandResultPayload = {
      community: c('Ks 7c 2d'),
      winners: [{ seat: 0, amount: 250 }],
      players: [
        { seat: 0, userId: 'u1', name: 'Hero', stack: 1100, revealed: false, holeCards: c('Ah Ad') },
        { seat: 1, userId: 'bot:x:1', name: 'Bot', stack: 400, revealed: false, holeCards: c('Kh Qd') },
      ],
      actions: [
        { type: 'blinds_posted', sb: 10, bb: 20, sbSeat: 0, bbSeat: 1 },
        { type: 'action', seat: 0, action: 'raise', amount: 100 },
        { type: 'action', seat: 1, action: 'call', amount: 80 },
        { type: 'street', street: 'flop', cards: c('Ks 7c 2d') },
        { type: 'action', seat: 0, action: 'bet', amount: 50 },
        { type: 'action', seat: 1, action: 'fold', amount: 0 },
      ],
    };
    const [preflop, flop] = analyzeHand(hand, 'u1').streets;
    expect(preflop!.players.map((p) => p.stack)).toEqual([1000, 500]);
    expect(preflop!.actions.map((a) => a.stackAfter)).toEqual([990, 480, 900, 400]);
    expect(flop!.players.map((p) => p.stack)).toEqual([900, 400]);
    expect(flop!.actions.map((a) => a.stackAfter)).toEqual([850, 400]);
  });

  it('leaves balances unknown when stacks were not saved', () => {
    const preflop = analyzeHand(botHand, 'u1').streets[0]!;
    expect(preflop.players.every((p) => p.stack === null)).toBe(true);
    expect(preflop.actions.every((a) => a.stackAfter === null)).toBe(true);
  });

  it('separates all-in raises from all-in calls', () => {
    const allIn: HandResultPayload = {
      players: [
        { seat: 0, userId: 'u1', name: 'Hero', revealed: true, holeCards: c('Ah Ad') },
        { seat: 1, userId: 'bot:x:1', name: 'Bot', revealed: true, holeCards: c('Kh Kd') },
      ],
      actions: [
        { type: 'blinds_posted', sb: 5, bb: 10, sbSeat: 0, bbSeat: 1 },
        { type: 'action', seat: 0, action: 'allin', amount: 100 },
        { type: 'action', seat: 1, action: 'allin', amount: 60 },
      ],
    };
    const preflop = analyzeHand(allIn, 'u1').streets[0]!;
    expect(preflop.actions.slice(2).map((a) => [a.amount, a.streetTotal, a.potAfter])).toEqual([
      [95, 100, 110],
      [60, 70, 170],
    ]);
  });

  it('treats a returned uncalled bet as chips back, not a win', () => {
    const shortAllIn: HandResultPayload = {
      community: c('As 3d Qs Td 7s'),
      winners: [
        { seat: 1, amount: 2000, handName: 'Two Pair' },
        { seat: 0, amount: 2000, handName: 'One Pair' },
      ],
      players: [
        { seat: 0, userId: 'u1', name: 'Hero', revealed: true, holeCards: c('Qc Jd') },
        { seat: 1, userId: 'u2', name: 'Villain', revealed: true, holeCards: c('Ac 3c') },
      ],
      actions: [
        { type: 'blinds_posted', sb: 10, bb: 20, sbSeat: 0, bbSeat: 1 },
        { type: 'action', seat: 0, action: 'raise', amount: 3000 },
        { type: 'action', seat: 1, action: 'allin', amount: 980 },
        ...streetEvents('As 3d Qs Td 7s'),
      ],
    };
    expect(handPayouts(shortAllIn)).toEqual([
      { seat: 1, awarded: 2000, returned: 0, won: 2000, handName: 'Two Pair' },
      { seat: 0, awarded: 2000, returned: 2000, won: 0, handName: 'One Pair' },
    ]);
  });

  it('nets a fold-out win against the winner own uncalled chips', () => {
    const foldOut: HandResultPayload = {
      winners: [{ seat: 0, amount: 70 }],
      players: [
        { seat: 0, userId: 'u1', name: 'Hero', revealed: false, holeCards: c('Qc Jd') },
        { seat: 1, userId: 'bot:x:1', name: 'Bot', revealed: false, holeCards: c('2c 7d') },
      ],
      actions: [
        { type: 'blinds_posted', sb: 10, bb: 20, sbSeat: 0, bbSeat: 1 },
        { type: 'action', seat: 0, action: 'raise', amount: 50 },
        { type: 'action', seat: 1, action: 'fold', amount: 0 },
      ],
    };
    expect(handPayouts(foldOut)[0]).toMatchObject({ awarded: 70, returned: 30, won: 40 });
  });

  it('treats every bot hand as analysable', () => {
    expect(isAnalyzableHand(botHand, 'u1', 'online')).toBe(true);
  });

  it('builds a snapshot for every street and drops folded players', () => {
    const analysis = analyzeHand(botHand, 'u1', { seed: 'h1' });
    expect(analysis.viewerSeat).toBe(0);
    expect(analysis.streets.map((s) => s.street)).toEqual(['preflop', 'flop', 'turn', 'river']);
    const flop = analysis.streets[1]!;
    expect(flop.board).toEqual(['Ks', '7c', '2d']);
    expect(flop.players.find((p) => p.seat === 1)!.foldsThisStreet).toBe(true);
    const turn = analysis.streets[2]!;
    expect(turn.players.find((p) => p.seat === 1)!.folded).toBe(true);
    expect(turn.players.find((p) => p.seat === 1)!.winPct).toBeNull();
    const river = analysis.streets[3]!;
    expect(river.players.find((p) => p.seat === 2)!.winPct).toBe(100);
    expect(river.players.find((p) => p.seat === 0)!.winPct).toBe(0);
  });

  const humanShowdown: HandResultPayload = {
    community: c('Ks 7c 2d 9h 3s'),
    players: [
      { seat: 0, userId: 'u1', name: 'Hero', revealed: true, holeCards: c('Ah Ad') },
      { seat: 1, userId: 'u2', name: 'Villain', revealed: true, holeCards: c('Kh Kd') },
      { seat: 2, userId: 'u3', name: 'Folder', revealed: false, holeCards: null },
    ],
    actions: [
      { type: 'blinds_posted', sb: 1, bb: 2, sbSeat: 1, bbSeat: 2 },
      { type: 'action', seat: 2, action: 'fold', amount: 0 },
      ...streetEvents('Ks 7c 2d 9h 3s'),
    ],
  };

  it('allows hands against people that reached showdown', () => {
    expect(isAnalyzableHand(humanShowdown, 'u1', 'online')).toBe(true);
    const analysis = analyzeHand(humanShowdown, 'u1', { seed: 'h2' });
    const preflop = analysis.streets[0]!;
    const folder = preflop.players.find((p) => p.seat === 2)!;
    expect(folder.holeCards).toBeNull();
    expect(folder.winPct).not.toBeNull();
    expect(analysis.streets[1]!.players.find((p) => p.seat === 2)!.folded).toBe(true);
  });

  it('rejects hands against people without a showdown', () => {
    const noShow: HandResultPayload = {
      community: [],
      players: [
        { seat: 0, userId: 'u1', name: 'Hero', revealed: false, holeCards: c('Ah Ad') },
        { seat: 1, userId: 'u2', name: 'Villain', revealed: false, holeCards: null },
      ],
      actions: [
        { type: 'blinds_posted', sb: 1, bb: 2, sbSeat: 0, bbSeat: 1 },
        { type: 'action', seat: 1, action: 'fold', amount: 0 },
      ],
    };
    expect(isAnalyzableHand(noShow, 'u1', 'online')).toBe(false);
  });

  it('classifies opponents as bots or players', () => {
    expect(handOpponents(botHand, 'u1', 'online')).toBe('bots');
    expect(handOpponents(humanShowdown, 'u1', 'online')).toBe('players');
    expect(handOpponents(humanShowdown, 'u1', 'offline')).toBe('bots');
  });

  it('always allows offline hands', () => {
    const offline: HandResultPayload = {
      players: [
        { seat: 0, userId: 'u1', name: 'Hero', revealed: false, holeCards: c('Ah Ad') },
        { seat: 1, userId: 'bot:nit:x', name: 'Nit', revealed: false, holeCards: c('2c 7d') },
      ],
      actions: [],
    };
    expect(isAnalyzableHand(offline, 'u1', 'offline')).toBe(true);
  });
});
