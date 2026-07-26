import type { Card, Rank } from './cards.js';

/** Hand categories, higher is better. */
export enum HandCategory {
  HighCard = 0,
  OnePair = 1,
  TwoPair = 2,
  ThreeOfAKind = 3,
  Straight = 4,
  Flush = 5,
  FullHouse = 6,
  FourOfAKind = 7,
  StraightFlush = 8,
}

export const HAND_CATEGORY_NAMES: Record<HandCategory, string> = {
  [HandCategory.HighCard]: 'High Card',
  [HandCategory.OnePair]: 'One Pair',
  [HandCategory.TwoPair]: 'Two Pair',
  [HandCategory.ThreeOfAKind]: 'Three of a Kind',
  [HandCategory.Straight]: 'Straight',
  [HandCategory.Flush]: 'Flush',
  [HandCategory.FullHouse]: 'Full House',
  [HandCategory.FourOfAKind]: 'Four of a Kind',
  [HandCategory.StraightFlush]: 'Straight Flush',
};

/**
 * Compact comparable rank:
 * bits 20-23: category (0-8)
 * bits 0-19: kickers packed as 4-bit nibbles (high first)
 */
export type HandRank = number;

export function compareHandRanks(a: HandRank, b: HandRank): number {
  return a - b;
}

function pack(category: HandCategory, kickers: number[]): HandRank {
  let value = category << 20;
  const padded = kickers.slice(0, 5);
  while (padded.length < 5) padded.push(0);
  for (let i = 0; i < 5; i++) {
    value |= (padded[i]! & 0xf) << (16 - i * 4);
  }
  return value;
}

function straightHigh(ranksDescUnique: number[]): number | null {
  // Wheel: A-5-4-3-2
  if (
    ranksDescUnique.includes(14) &&
    ranksDescUnique.includes(5) &&
    ranksDescUnique.includes(4) &&
    ranksDescUnique.includes(3) &&
    ranksDescUnique.includes(2)
  ) {
    return 5;
  }
  for (let i = 0; i <= ranksDescUnique.length - 5; i++) {
    const hi = ranksDescUnique[i]!;
    if (
      ranksDescUnique[i + 1] === hi - 1 &&
      ranksDescUnique[i + 2] === hi - 2 &&
      ranksDescUnique[i + 3] === hi - 3 &&
      ranksDescUnique[i + 4] === hi - 4
    ) {
      return hi;
    }
  }
  return null;
}

/** Evaluate exactly 5 cards. */
export function evaluate5(cards: Card[]): HandRank {
  if (cards.length !== 5) throw new Error('evaluate5 requires 5 cards');

  const ranks = cards.map((c) => c.rank).sort((a, b) => b - a);
  const suits = cards.map((c) => c.suit);
  const isFlush = suits.every((s) => s === suits[0]);

  const counts = new Map<Rank, number>();
  for (const r of ranks) counts.set(r, (counts.get(r) ?? 0) + 1);

  const byCount = [...counts.entries()].sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1];
    return b[0] - a[0];
  });

  const uniqueDesc = [...new Set(ranks)].sort((a, b) => b - a);
  const sHigh = straightHigh(uniqueDesc);

  if (isFlush && sHigh !== null) return pack(HandCategory.StraightFlush, [sHigh]);
  if (byCount[0]![1] === 4) {
    return pack(HandCategory.FourOfAKind, [byCount[0]![0], byCount[1]![0]]);
  }
  if (byCount[0]![1] === 3 && byCount[1]![1] === 2) {
    return pack(HandCategory.FullHouse, [byCount[0]![0], byCount[1]![0]]);
  }
  if (isFlush) return pack(HandCategory.Flush, ranks);
  if (sHigh !== null) return pack(HandCategory.Straight, [sHigh]);
  if (byCount[0]![1] === 3) {
    const kickers = byCount.slice(1).map(([r]) => r);
    return pack(HandCategory.ThreeOfAKind, [byCount[0]![0], ...kickers]);
  }
  if (byCount[0]![1] === 2 && byCount[1]![1] === 2) {
    const highPair = Math.max(byCount[0]![0], byCount[1]![0]);
    const lowPair = Math.min(byCount[0]![0], byCount[1]![0]);
    const kicker = byCount[2]![0];
    return pack(HandCategory.TwoPair, [highPair, lowPair, kicker]);
  }
  if (byCount[0]![1] === 2) {
    const kickers = byCount.slice(1).map(([r]) => r);
    return pack(HandCategory.OnePair, [byCount[0]![0], ...kickers]);
  }
  return pack(HandCategory.HighCard, ranks);
}

/** Best 5-card hand from 5–7 cards, including which cards form it. */
export function evaluateBestHand(cards: Card[]): { rank: HandRank; cards: Card[] } {
  if (cards.length < 5 || cards.length > 7) {
    throw new Error('evaluateBestHand requires 5–7 cards');
  }
  if (cards.length === 5) return { rank: evaluate5(cards), cards: cards.map((c) => ({ ...c })) };

  let best = 0;
  let bestCards: Card[] = [];
  const n = cards.length;
  const idx = [0, 1, 2, 3, 4];

  const score = () => evaluate5(idx.map((i) => cards[i]!));

  // Combinations C(n,5)
  const comb = (start: number, depth: number) => {
    if (depth === 5) {
      const r = score();
      if (r > best) {
        best = r;
        bestCards = idx.map((i) => ({ ...cards[i]! }));
      }
      return;
    }
    for (let i = start; i <= n - (5 - depth); i++) {
      idx[depth] = i;
      comb(i + 1, depth + 1);
    }
  };
  comb(0, 0);
  return { rank: best, cards: bestCards };
}

/** Best 5-card hand rank from 5–7 cards. */
export function evaluateBest(cards: Card[]): HandRank {
  return evaluateBestHand(cards).rank;
}

export function categoryOf(rank: HandRank): HandCategory {
  return (rank >> 20) as HandCategory;
}
