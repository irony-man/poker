import {
  HAND_CATEGORY_NAMES,
  HandCategory,
  cardToString,
  categoryOf,
  createDeck,
  estimateEquity,
  evaluateBest,
  parseCard,
  type Card,
} from '@poker/engine';

export type HeroHudOdds = {
  handName: string;
  winPct: number;
  improveLabel: string | null;
  improvePct: number | null;
};

const HUD_CATEGORY_NAMES: Record<HandCategory, string> = {
  [HandCategory.HighCard]: 'High Card',
  [HandCategory.OnePair]: 'Pair',
  [HandCategory.TwoPair]: 'Two Pair',
  [HandCategory.ThreeOfAKind]: 'Three of a Kind',
  [HandCategory.Straight]: 'Straight',
  [HandCategory.Flush]: 'Flush',
  [HandCategory.FullHouse]: 'Full House',
  [HandCategory.FourOfAKind]: 'Four of a Kind',
  [HandCategory.StraightFlush]: 'Straight Flush',
};

function parseSafe(code: string): Card | null {
  try {
    return parseCard(code);
  } catch {
    return null;
  }
}

function forEachCombo(cards: Card[], k: number, visit: (picked: Card[]) => void): void {
  const n = cards.length;
  if (k <= 0 || k > n) return;
  const idx = Array.from({ length: k }, (_, i) => i);
  const pick = () => visit(idx.map((i) => cards[i]!));
  pick();
  while (true) {
    let i = k - 1;
    while (i >= 0 && idx[i] === n - k + i) i -= 1;
    if (i < 0) return;
    idx[i]! += 1;
    for (let j = i + 1; j < k; j++) idx[j] = idx[j - 1]! + 1;
    pick();
  }
}

function madeHandName(hole: [Card, Card], board: Card[]): string {
  if (board.length < 3) {
    return hole[0].rank === hole[1].rank
      ? HUD_CATEGORY_NAMES[HandCategory.OnePair]
      : HUD_CATEGORY_NAMES[HandCategory.HighCard];
  }
  const cat = categoryOf(evaluateBest([hole[0], hole[1], ...board]));
  return HUD_CATEGORY_NAMES[cat] ?? HAND_CATEGORY_NAMES[cat];
}

function improvementOdds(
  hole: [Card, Card],
  board: Card[],
): { label: string; pct: number } | null {
  const need = 5 - board.length;
  if (need <= 0 || board.length < 3) return null;

  const known = new Set([cardToString(hole[0]), cardToString(hole[1]), ...board.map(cardToString)]);
  const remaining = createDeck().filter((c) => !known.has(cardToString(c)));
  const current = categoryOf(evaluateBest([hole[0], hole[1], ...board]));
  const counts = new Map<HandCategory, number>();
  let improve = 0;
  let total = 0;

  forEachCombo(remaining, need, (extra) => {
    total += 1;
    const next = categoryOf(evaluateBest([hole[0], hole[1], ...board, ...extra]));
    if (next > current) {
      improve += 1;
      counts.set(next, (counts.get(next) ?? 0) + 1);
    }
  });

  if (total === 0 || improve === 0) return null;
  let bestCat = HandCategory.OnePair;
  let bestN = 0;
  for (const [cat, n] of counts) {
    if (n > bestN) {
      bestN = n;
      bestCat = cat;
    }
  }
  return {
    label: HUD_CATEGORY_NAMES[bestCat] ?? HAND_CATEGORY_NAMES[bestCat],
    pct: Math.round((improve / total) * 100),
  };
}

export function computeHeroHandName(
  holeCodes: [string, string],
  boardCodes: string[],
): string | null {
  const a = parseSafe(holeCodes[0]);
  const b = parseSafe(holeCodes[1]);
  if (!a || !b) return null;
  const board: Card[] = [];
  for (const code of boardCodes) {
    const card = parseSafe(code);
    if (!card) return null;
    board.push(card);
  }
  return madeHandName([a, b], board);
}

export function computeHeroHudOdds(
  holeCodes: [string, string],
  boardCodes: string[],
  opponents: number,
): HeroHudOdds | null {
  const a = parseSafe(holeCodes[0]);
  const b = parseSafe(holeCodes[1]);
  if (!a || !b) return null;
  const board: Card[] = [];
  for (const code of boardCodes) {
    const card = parseSafe(code);
    if (!card) return null;
    board.push(card);
  }

  const handName = madeHandName([a, b], board);
  const winPct = Math.round(estimateEquity([a, b], board, Math.max(1, opponents)) * 100);
  const improve = improvementOdds([a, b], board);

  return {
    handName,
    winPct,
    improveLabel: improve?.label ?? null,
    improvePct: improve?.pct ?? null,
  };
}
