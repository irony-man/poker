import {
  createDeck,
  evaluateBest,
  parseCard,
  cardToString,
  type Card,
} from '@poker/engine';

export type RevealedHole = {
  seat: number;
  holeCards: [string, string];
};

/** Seat → win share percent (0–100), summing to ~100 across seats. */
export type SeatWinPct = Map<number, number>;

function parseSafe(code: string): Card | null {
  try {
    return parseCard(code);
  } catch {
    return null;
  }
}

function parseBoard(codes: string[]): Card[] | null {
  const board: Card[] = [];
  for (const code of codes) {
    const card = parseSafe(code);
    if (!card) return null;
    board.push(card);
  }
  return board;
}

function parseHoles(
  hands: RevealedHole[],
): { seat: number; hole: [Card, Card] }[] | null {
  const out: { seat: number; hole: [Card, Card] }[] = [];
  for (const h of hands) {
    const a = parseSafe(h.holeCards[0]);
    const b = parseSafe(h.holeCards[1]);
    if (!a || !b) return null;
    out.push({ seat: h.seat, hole: [a, b] });
  }
  return out;
}

function cardKey(c: Card): string {
  return cardToString(c);
}

function shuffleInPlace(deck: Card[]): void {
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = deck[i]!;
    deck[i] = deck[j]!;
    deck[j] = tmp;
  }
}

/** Exact equity when the board is complete (5 cards). */
function exactEquity(
  holes: { seat: number; hole: [Card, Card] }[],
  board: Card[],
): SeatWinPct {
  const ranks = holes.map(({ seat, hole }) => ({
    seat,
    rank: evaluateBest([hole[0], hole[1], ...board]),
  }));
  let best = -1;
  for (const r of ranks) if (r.rank > best) best = r.rank;
  const winners = ranks.filter((r) => r.rank === best);
  const share = 100 / winners.length;
  const map: SeatWinPct = new Map();
  for (const r of ranks) {
    map.set(r.seat, r.rank === best ? Math.round(share) : 0);
  }
  // Fix rounding so totals stay ~100 when ties
  if (winners.length > 0) {
    const assigned = [...map.values()].reduce((a, b) => a + b, 0);
    if (assigned !== 100) {
      const first = winners[0]!.seat;
      map.set(first, (map.get(first) ?? 0) + (100 - assigned));
    }
  }
  return map;
}

/** Monte Carlo among known hole cards when the board is incomplete. */
function monteCarloEquity(
  holes: { seat: number; hole: [Card, Card] }[],
  board: Card[],
  trials = 200,
): SeatWinPct {
  const known = new Set<string>();
  for (const c of board) known.add(cardKey(c));
  for (const { hole } of holes) {
    known.add(cardKey(hole[0]));
    known.add(cardKey(hole[1]));
  }
  const remaining = createDeck().filter((c) => !known.has(cardKey(c)));
  const needBoard = 5 - board.length;
  if (needBoard <= 0 || remaining.length < needBoard) {
    return exactEquity(holes, board);
  }

  const wins = new Map<number, number>();
  for (const { seat } of holes) wins.set(seat, 0);

  for (let t = 0; t < trials; t++) {
    const deck = remaining.slice();
    shuffleInPlace(deck);
    const fullBoard = board.slice();
    for (let i = 0; i < needBoard; i++) fullBoard.push(deck[i]!);

    const ranks = holes.map(({ seat, hole }) => ({
      seat,
      rank: evaluateBest([hole[0], hole[1], ...fullBoard]),
    }));
    let best = -1;
    for (const r of ranks) if (r.rank > best) best = r.rank;
    const tied = ranks.filter((r) => r.rank === best);
    const share = 1 / tied.length;
    for (const r of tied) {
      wins.set(r.seat, (wins.get(r.seat) ?? 0) + share);
    }
  }

  const map: SeatWinPct = new Map();
  for (const { seat } of holes) {
    map.set(seat, Math.round(((wins.get(seat) ?? 0) / trials) * 100));
  }
  const assigned = [...map.values()].reduce((a, b) => a + b, 0);
  if (holes.length > 0 && assigned !== 100) {
    const first = holes[0]!.seat;
    map.set(first, (map.get(first) ?? 0) + (100 - assigned));
  }
  return map;
}

/**
 * Win shares among currently revealed hole cards given the community board.
 * Single revealed hand → 100%. Empty → empty map.
 */
export function computeRevealedWinPct(
  hands: RevealedHole[],
  boardCodes: string[],
): SeatWinPct {
  if (hands.length === 0) return new Map();
  if (hands.length === 1) {
    return new Map([[hands[0]!.seat, 100]]);
  }
  const board = parseBoard(boardCodes);
  const holes = parseHoles(hands);
  if (!board || !holes) return new Map();

  if (board.length >= 5) return exactEquity(holes, board.slice(0, 5));
  if (board.length >= 3) return monteCarloEquity(holes, board);
  // Preflop / incomplete: treat as equal among shown hands
  const share = Math.round(100 / holes.length);
  const map: SeatWinPct = new Map();
  for (const h of holes) map.set(h.seat, share);
  const assigned = share * holes.length;
  if (holes.length > 0 && assigned !== 100) {
    map.set(holes[0]!.seat, (map.get(holes[0]!.seat) ?? 0) + (100 - assigned));
  }
  return map;
}

/** Collect public revealed holes from table players. */
export function revealedHolesFromPlayers(
  players: { seat: number; holeCards: [string, string] | null; status: string }[],
): RevealedHole[] {
  const out: RevealedHole[] = [];
  for (const p of players) {
    if (p.status === 'folded' || p.status === 'empty') continue;
    if (p.holeCards && p.holeCards.length === 2) {
      out.push({ seat: p.seat, holeCards: p.holeCards });
    }
  }
  return out;
}
