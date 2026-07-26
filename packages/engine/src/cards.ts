/** Rank: 2=deuce … 14=Ace. Suit: c d h s */
export type Suit = 'c' | 'd' | 'h' | 's';
export type Rank = 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14;

export interface Card {
  rank: Rank;
  suit: Suit;
}

export const SUITS: Suit[] = ['c', 'd', 'h', 's'];
export const RANKS: Rank[] = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];

const RANK_CHARS: Record<string, Rank> = {
  '2': 2,
  '3': 3,
  '4': 4,
  '5': 5,
  '6': 6,
  '7': 7,
  '8': 8,
  '9': 9,
  T: 10,
  J: 11,
  Q: 12,
  K: 13,
  A: 14,
};

const RANK_TO_CHAR: Record<number, string> = {
  2: '2',
  3: '3',
  4: '4',
  5: '5',
  6: '6',
  7: '7',
  8: '8',
  9: '9',
  10: 'T',
  11: 'J',
  12: 'Q',
  13: 'K',
  14: 'A',
};

export function cardToString(card: Card): string {
  return `${RANK_TO_CHAR[card.rank]}${card.suit}`;
}

export function parseCard(s: string): Card {
  if (s.length !== 2) throw new Error(`Invalid card: ${s}`);
  const rank = RANK_CHARS[s[0]!.toUpperCase()];
  const suit = s[1]!.toLowerCase() as Suit;
  if (!rank || !SUITS.includes(suit)) throw new Error(`Invalid card: ${s}`);
  return { rank, suit };
}

export function parseCards(s: string): Card[] {
  return s.trim().split(/\s+/).filter(Boolean).map(parseCard);
}

export function createDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ rank, suit });
    }
  }
  return deck;
}

/** Fisher–Yates with CSPRNG (Node crypto or Web Crypto). */
export function shuffle<T>(items: T[], randomBytes: (n: number) => Uint8Array): T[] {
  const arr = items.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const buf = randomBytes(4);
    const rand = (buf[0]! << 24) | (buf[1]! << 16) | (buf[2]! << 8) | buf[3]!;
    const j = (rand >>> 0) % (i + 1);
    const tmp = arr[i]!;
    arr[i] = arr[j]!;
    arr[j] = tmp;
  }
  return arr;
}
