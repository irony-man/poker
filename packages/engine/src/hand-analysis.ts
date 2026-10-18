import { cardToString, createDeck, parseCard, type Card, type Rank, type Suit } from './cards.js';
import type { HandResultPayload } from './player-exploit.js';

/** Mirror of bot user id prefix — avoid importing bot.js (circular with chooseBotAction). */
function isBotUserId(userId: string | null | undefined): boolean {
  return !!userId && userId.startsWith('bot:');
}

export type AnalysisStreet = 'preflop' | 'flop' | 'turn' | 'river';

export interface AnalysisPlayer {
  seat: number;
  name: string;
  userId: string | null;
  isViewer: boolean;
  isBot: boolean;
  /** Null when the cards are hidden (folded human who never showed). */
  holeCards: [string, string] | null;
  /** Folded before this street was dealt. */
  folded: boolean;
  /** Folded during this street's betting. */
  foldsThisStreet: boolean;
  /** 0–100 share of the pot equity; null once folded. */
  winPct: number | null;
  /** Chips in front of the player when this street was dealt; null if unknown. */
  stack: number | null;
}

export type StreetActionKind =
  | 'small_blind'
  | 'big_blind'
  | 'fold'
  | 'check'
  | 'call'
  | 'bet'
  | 'raise'
  | 'allin';

export interface StreetAction {
  seat: number;
  name: string;
  isViewer: boolean;
  kind: StreetActionKind;
  /** Chips this action put into the pot. */
  amount: number;
  /** The player's total bet on this street after the action. */
  streetTotal: number;
  potAfter: number;
  /** The player's remaining chips after the action; null if unknown. */
  stackAfter: number | null;
}

export interface StreetSnapshot {
  street: AnalysisStreet;
  board: string[];
  players: AnalysisPlayer[];
  /** Pot carried in from earlier streets. */
  potStart: number;
  actions: StreetAction[];
}

export interface HandAnalysis {
  viewerSeat: number | null;
  streets: StreetSnapshot[];
}

const RANK_FROM_CHAR: Record<string, Rank> = {
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

/** Accepts `{ rank, suit }` objects (stored history) or codes like `"Ah"`. */
export function toAnalysisCard(raw: unknown): Card | null {
  if (typeof raw === 'string') {
    try {
      return parseCard(raw);
    } catch {
      return null;
    }
  }
  if (!raw || typeof raw !== 'object') return null;
  const rec = raw as { rank?: unknown; suit?: unknown };
  const suit = typeof rec.suit === 'string' ? (rec.suit.toLowerCase() as Suit) : null;
  if (!suit || !['c', 'd', 'h', 's'].includes(suit)) return null;
  let rank: Rank | undefined;
  if (typeof rec.rank === 'number' && rec.rank >= 2 && rec.rank <= 14) rank = rec.rank as Rank;
  else if (typeof rec.rank === 'string') rank = RANK_FROM_CHAR[rec.rank.toUpperCase()];
  return rank ? { rank, suit } : null;
}

function toCards(raw: unknown): Card[] {
  if (!Array.isArray(raw)) return [];
  const out: Card[] = [];
  for (const c of raw) {
    const card = toAnalysisCard(c);
    if (card) out.push(card);
  }
  return out;
}

function holeOf(raw: unknown): [Card, Card] | null {
  const cards = toCards(raw);
  return cards.length >= 2 ? [cards[0]!, cards[1]!] : null;
}

interface DealtSeat {
  seat: number;
  name: string;
  userId: string | null;
  isBot: boolean;
  revealed: boolean;
  hole: [Card, Card] | null;
}

/** Seats dealt into the hand: stored players with cards, plus seats that acted but were vacated. */
function dealtSeats(result: HandResultPayload): DealtSeat[] {
  const acted = new Set<number>();
  for (const a of result.actions ?? []) {
    if (a.type === 'action' && typeof a.seat === 'number') acted.add(a.seat);
    if (a.type === 'blinds_posted') {
      if (typeof a.sbSeat === 'number') acted.add(a.sbSeat);
      if (typeof a.bbSeat === 'number') acted.add(a.bbSeat);
    }
  }
  const bySeat = new Map<number, DealtSeat>();
  for (const p of result.players ?? []) {
    if (!p || typeof p.seat !== 'number') continue;
    const hole = holeOf(p.holeCards);
    if (!hole && !p.userId) continue;
    // Redacted or sitting out: only counts when the log shows them in the hand.
    if (!hole && !p.revealed && !acted.has(p.seat)) continue;
    bySeat.set(p.seat, {
      seat: p.seat,
      name: (typeof p.name === 'string' && p.name) || `Seat ${p.seat + 1}`,
      userId: p.userId ?? null,
      isBot: isBotUserId(p.userId),
      revealed: p.revealed === true,
      hole,
    });
  }
  for (const seat of acted) {
    if (bySeat.has(seat)) continue;
    bySeat.set(seat, {
      seat,
      name: `Seat ${seat + 1}`,
      userId: null,
      isBot: false,
      revealed: false,
      hole: null,
    });
  }
  return [...bySeat.values()].sort((x, y) => x.seat - y.seat);
}

/**
 * Bot hands (every opponent a bot, or an offline game) are always analysable.
 * Hands against people need a showdown with at least two hands revealed.
 */
export function isAnalyzableHand(
  result: HandResultPayload | null | undefined,
  viewerUserId: string,
  source?: string | null,
): boolean {
  if (!result) return false;
  const seats = dealtSeats(result);
  const viewer = seats.find((s) => s.userId === viewerUserId);
  if (!viewer?.hole) return false;
  const opponents = seats.filter((s) => s !== viewer);
  if (opponents.length === 0) return false;
  if (handOpponents(result, viewerUserId, source) === 'bots') return true;
  return seats.filter((s) => s.revealed).length >= 2;
}

export type HandOpponents = 'bots' | 'players';

/** `bots` for offline games and hands where every other dealt-in seat is a bot. */
export function handOpponents(
  result: HandResultPayload | null | undefined,
  viewerUserId: string,
  source?: string | null,
): HandOpponents {
  if (source === 'offline') return 'bots';
  if (!result) return 'players';
  const opponents = dealtSeats(result).filter((s) => s.userId !== viewerUserId);
  return opponents.length > 0 && opponents.every((s) => s.isBot) ? 'bots' : 'players';
}

/** Deterministic PRNG so the same hand shows the same numbers on every view. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashSeed(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export interface EquityHand {
  seat: number;
  hole: [Card, Card] | null;
}

const SUIT_INDEX: Record<Suit, number> = { c: 0, d: 1, h: 2, s: 3 };
const rankCounts = new Uint8Array(15);
const suitCounts = new Uint8Array(4);
const suitMasks = new Uint16Array(4);

function packRank(category: number, k0 = 0, k1 = 0, k2 = 0, k3 = 0, k4 = 0): number {
  return (category << 20) | (k0 << 16) | (k1 << 12) | (k2 << 8) | (k3 << 4) | k4;
}

/** Highest straight in a rank bitmask (bit r = rank r), wheel = 5, or 0. */
function straightHighOf(mask: number): number {
  for (let hi = 14; hi >= 6; hi--) {
    const run = 0b11111 << (hi - 4);
    if ((mask & run) === run) return hi;
  }
  const wheel = (1 << 14) | 0b111100;
  return (mask & wheel) === wheel ? 5 : 0;
}

function topRanks(mask: number, n: number, skipA = 0, skipB = 0): number[] {
  const out: number[] = [];
  for (let r = 14; r >= 2 && out.length < n; r--) {
    if (r !== skipA && r !== skipB && mask & (1 << r)) out.push(r);
  }
  return out;
}

/**
 * Same packed value as `evaluateBest` for 5–7 cards, without the per-combination
 * allocations, so equity enumeration stays fast in the browser.
 */
export function fastHandRank(cards: Card[]): number {
  rankCounts.fill(0);
  suitCounts.fill(0);
  suitMasks.fill(0);
  let mask = 0;
  for (const card of cards) {
    const s = SUIT_INDEX[card.suit];
    rankCounts[card.rank]! += 1;
    suitCounts[s]! += 1;
    suitMasks[s]! |= 1 << card.rank;
    mask |= 1 << card.rank;
  }

  let flushMask = 0;
  for (let s = 0; s < 4; s++) if (suitCounts[s]! >= 5) flushMask = suitMasks[s]!;
  if (flushMask) {
    const sf = straightHighOf(flushMask);
    if (sf) return packRank(8, sf);
  }

  let quad = 0;
  let trip = 0;
  let trip2 = 0;
  let pair = 0;
  let pair2 = 0;
  for (let r = 14; r >= 2; r--) {
    const n = rankCounts[r]!;
    if (n === 4 && !quad) quad = r;
    else if (n === 3) {
      if (!trip) trip = r;
      else if (!trip2) trip2 = r;
    } else if (n === 2) {
      if (!pair) pair = r;
      else if (!pair2) pair2 = r;
    }
  }

  if (quad) return packRank(7, quad, topRanks(mask, 1, quad)[0] ?? 0);
  if (trip && (trip2 || pair)) return packRank(6, trip, Math.max(trip2, pair));
  if (flushMask) {
    const f = topRanks(flushMask, 5);
    return packRank(5, f[0], f[1], f[2], f[3], f[4]);
  }
  const straight = straightHighOf(mask);
  if (straight) return packRank(4, straight);
  if (trip) {
    const k = topRanks(mask, 2, trip);
    return packRank(3, trip, k[0], k[1]);
  }
  if (pair && pair2) return packRank(2, pair, pair2, topRanks(mask, 1, pair, pair2)[0] ?? 0);
  if (pair) {
    const k = topRanks(mask, 3, pair);
    return packRank(1, pair, k[0], k[1], k[2]);
  }
  const h = topRanks(mask, 5);
  return packRank(0, h[0], h[1], h[2], h[3], h[4]);
}

function scoreShowdown(
  holes: [Card, Card][],
  board: Card[],
  wins: number[],
): void {
  let best = -1;
  let tied = 0;
  const ranks = holes.map((h) => fastHandRank([h[0], h[1], ...board]));
  for (const r of ranks) {
    if (r > best) {
      best = r;
      tied = 1;
    } else if (r === best) {
      tied += 1;
    }
  }
  const share = 1 / tied;
  for (let i = 0; i < ranks.length; i++) {
    if (ranks[i] === best) wins[i]! += share;
  }
}

function combinations(n: number, k: number, visit: (idx: number[]) => void): void {
  const idx: number[] = [];
  const rec = (start: number) => {
    if (idx.length === k) {
      visit(idx);
      return;
    }
    for (let i = start; i <= n - (k - idx.length); i++) {
      idx.push(i);
      rec(i + 1);
      idx.pop();
    }
  };
  rec(0);
}

/**
 * Win share per seat (0–100). Exact enumeration when every hand is known and the
 * flop is out, otherwise seeded Monte Carlo with hidden hands dealt at random.
 */
export function computeEquity(
  hands: EquityHand[],
  boardCards: Card[],
  opts: { seed?: number; trials?: number } = {},
): Map<number, number> {
  const out = new Map<number, number>();
  if (hands.length === 0) return out;
  if (hands.length === 1) {
    out.set(hands[0]!.seat, 100);
    return out;
  }
  const board = boardCards.slice(0, 5);
  const known = new Set(board.map(cardToString));
  for (const h of hands) {
    if (!h.hole) continue;
    known.add(cardToString(h.hole[0]));
    known.add(cardToString(h.hole[1]));
  }
  const deck = createDeck().filter((c) => !known.has(cardToString(c)));
  const needBoard = 5 - board.length;
  const hidden = hands.filter((h) => !h.hole).length;
  const wins = hands.map(() => 0);
  let total = 0;

  if (hidden === 0 && board.length >= 3) {
    const holes = hands.map((h) => h.hole!);
    if (needBoard === 0) {
      scoreShowdown(holes, board, wins);
      total = 1;
    } else {
      combinations(deck.length, needBoard, (idx) => {
        scoreShowdown(holes, [...board, ...idx.map((i) => deck[i]!)], wins);
        total += 1;
      });
    }
  } else {
    const rand = mulberry32(opts.seed ?? 1);
    const trials = opts.trials ?? 3000;
    const draw = needBoard + hidden * 2;
    const pool = deck.slice();
    for (let t = 0; t < trials; t++) {
      for (let i = 0; i < draw; i++) {
        const j = i + Math.floor(rand() * (pool.length - i));
        const tmp = pool[i]!;
        pool[i] = pool[j]!;
        pool[j] = tmp;
      }
      let next = 0;
      const holes = hands.map((h) => {
        if (h.hole) return h.hole;
        const hole: [Card, Card] = [pool[next]!, pool[next + 1]!];
        next += 2;
        return hole;
      });
      const runout = board.slice();
      for (let i = 0; i < needBoard; i++) runout.push(pool[next + i]!);
      scoreShowdown(holes, runout, wins);
      total += 1;
    }
  }

  hands.forEach((h, i) => {
    out.set(h.seat, total > 0 ? Math.round((wins[i]! / total) * 1000) / 10 : 0);
  });
  return out;
}

const STREET_ORDER: AnalysisStreet[] = ['preflop', 'flop', 'turn', 'river'];

type DecodedEntry =
  | { type: 'street'; street: AnalysisStreet; cards: Card[]; potStart: number }
  | {
      type: 'bet';
      seat: number;
      kind: StreetActionKind;
      amount: number;
      streetTotal: number;
      potAfter: number;
    };

/**
 * Action log with chips paid per action. Calls log the chips paid, bets and raises
 * log the "raise to" street total, and all-ins log either depending on whether
 * they raised.
 */
function decodeActionLog(result: HandResultPayload): DecodedEntry[] {
  const out: DecodedEntry[] = [];
  let pot = 0;
  let currentBet = 0;
  let streetBets = new Map<number, number>();
  const record = (seat: number, kind: StreetActionKind, paid: number) => {
    const amount = Math.max(0, paid);
    const streetTotal = (streetBets.get(seat) ?? 0) + amount;
    streetBets.set(seat, streetTotal);
    currentBet = Math.max(currentBet, streetTotal);
    pot += amount;
    out.push({ type: 'bet', seat, kind, amount, streetTotal, potAfter: pot });
  };

  for (const a of result.actions ?? []) {
    if (a.type === 'street' && STREET_ORDER.includes(a.street as AnalysisStreet)) {
      out.push({
        type: 'street',
        street: a.street as AnalysisStreet,
        cards: toCards(a.cards),
        potStart: pot,
      });
      currentBet = 0;
      streetBets = new Map();
    } else if (a.type === 'blinds_posted') {
      if (typeof a.sbSeat === 'number' && typeof a.sb === 'number') {
        record(a.sbSeat, 'small_blind', a.sb);
      }
      if (typeof a.bbSeat === 'number' && typeof a.bb === 'number') {
        record(a.bbSeat, 'big_blind', a.bb);
      }
    } else if (a.type === 'action' && typeof a.seat === 'number') {
      const amount = typeof a.amount === 'number' ? a.amount : 0;
      const already = streetBets.get(a.seat) ?? 0;
      switch (a.action) {
        case 'fold':
        case 'check':
          record(a.seat, a.action as 'fold' | 'check', 0);
          break;
        case 'call':
          record(a.seat, 'call', amount);
          break;
        case 'bet':
        case 'raise':
          record(a.seat, a.action as 'bet' | 'raise', amount - already);
          break;
        case 'allin':
          record(a.seat, 'allin', amount > currentBet ? amount - already : amount);
          break;
      }
    }
  }
  return out;
}

/**
 * Stack each seat sat down with for this hand. Only the final stack is stored, so
 * this works back from it: final stack plus chips put in minus chips paid out.
 */
function startingStacks(result: HandResultPayload, log: DecodedEntry[]): Map<number, number> {
  const committed = new Map<number, number>();
  for (const entry of log) {
    if (entry.type === 'bet') committed.set(entry.seat, (committed.get(entry.seat) ?? 0) + entry.amount);
  }
  const awarded = new Map<number, number>();
  for (const w of result.winners ?? []) {
    if (!w || typeof w.seat !== 'number' || typeof w.amount !== 'number') continue;
    awarded.set(w.seat, (awarded.get(w.seat) ?? 0) + w.amount);
  }
  const out = new Map<number, number>();
  for (const p of result.players ?? []) {
    if (!p || typeof p.seat !== 'number' || typeof p.stack !== 'number' || !p.userId) continue;
    const start = p.stack + (committed.get(p.seat) ?? 0) - (awarded.get(p.seat) ?? 0);
    if (start >= 0) out.set(p.seat, start);
  }
  return out;
}

export interface SeatPayout {
  seat: number;
  /** Chips the engine paid this seat, including any returned uncalled bet. */
  awarded: number;
  /** Part of `awarded` that was the seat's own uncalled chips coming back. */
  returned: number;
  /** Chips actually won from other players. */
  won: number;
  handName?: string;
}

/**
 * Splits pot awards into real winnings and uncalled chips handed back. The engine
 * pays the biggest contributor a side pot nobody else could match, which looks like
 * a win in `winners` even when that player lost the hand.
 */
export function handPayouts(result: HandResultPayload): SeatPayout[] {
  const committed = new Map<number, number>();
  for (const entry of decodeActionLog(result)) {
    if (entry.type === 'bet') committed.set(entry.seat, (committed.get(entry.seat) ?? 0) + entry.amount);
  }
  const ranked = [...committed.entries()].sort((a, b) => b[1] - a[1]);
  const top = ranked[0];
  const excess = top ? top[1] - (ranked[1]?.[1] ?? 0) : 0;
  return (result.winners ?? []).flatMap((w) => {
    if (!w || typeof w.seat !== 'number') return [];
    const awarded = typeof w.amount === 'number' ? w.amount : 0;
    const returned = top && w.seat === top[0] && ranked.length > 1 ? Math.min(awarded, excess) : 0;
    return [{ seat: w.seat, awarded, returned, won: awarded - returned, handName: w.handName }];
  });
}

/** Rebuilds board and live players at the start of each street, with win chances. */
export function analyzeHand(
  result: HandResultPayload,
  viewerUserId: string,
  opts: { seed?: string | number; trials?: number } = {},
): HandAnalysis {
  const seats = dealtSeats(result);
  const viewerSeat = seats.find((s) => s.userId === viewerUserId)?.seat ?? null;
  const seed =
    typeof opts.seed === 'number' ? opts.seed : hashSeed(String(opts.seed ?? 'hand'));

  const finalBoard = toCards(result.community);
  const streetBoards = new Map<AnalysisStreet, Card[]>([['preflop', []]]);
  const foldsByStreet = new Map<AnalysisStreet, Set<number>>([['preflop', new Set()]]);
  const actionsByStreet = new Map<AnalysisStreet, StreetAction[]>([['preflop', []]]);
  const potStartByStreet = new Map<AnalysisStreet, number>([['preflop', 0]]);
  const nameBySeat = new Map(seats.map((s) => [s.seat, s.name]));
  const log = decodeActionLog(result);
  const stacks = startingStacks(result, log);
  const stackStartByStreet = new Map<AnalysisStreet, Map<number, number>>([
    ['preflop', new Map(stacks)],
  ]);
  let current: AnalysisStreet = 'preflop';
  let board: Card[] = [];

  for (const entry of log) {
    if (entry.type === 'street') {
      current = entry.street;
      board = [...board, ...entry.cards];
      streetBoards.set(current, board);
      foldsByStreet.set(current, new Set());
      actionsByStreet.set(current, []);
      potStartByStreet.set(current, entry.potStart);
      stackStartByStreet.set(current, new Map(stacks));
      continue;
    }
    if (entry.kind === 'fold') foldsByStreet.get(current)!.add(entry.seat);
    const before = stacks.get(entry.seat);
    if (before !== undefined) stacks.set(entry.seat, before - entry.amount);
    actionsByStreet.get(current)!.push({
      seat: entry.seat,
      name: nameBySeat.get(entry.seat) ?? `Seat ${entry.seat + 1}`,
      isViewer: entry.seat === viewerSeat,
      kind: entry.kind,
      amount: entry.amount,
      streetTotal: entry.streetTotal,
      potAfter: entry.potAfter,
      stackAfter: stacks.get(entry.seat) ?? null,
    });
  }
  // Older rows without street events: fall back to the final board.
  if (streetBoards.size === 1 && finalBoard.length >= 3) {
    streetBoards.set('flop', finalBoard.slice(0, 3));
    if (finalBoard.length >= 4) streetBoards.set('turn', finalBoard.slice(0, 4));
    if (finalBoard.length >= 5) streetBoards.set('river', finalBoard.slice(0, 5));
  }

  const foldedBefore = new Set<number>();
  const streets: StreetSnapshot[] = [];
  for (const street of STREET_ORDER) {
    const streetBoard = streetBoards.get(street);
    if (!streetBoard) continue;
    const live = seats.filter((s) => !foldedBefore.has(s.seat));
    const equity = computeEquity(
      live.map((s) => ({ seat: s.seat, hole: s.hole })),
      streetBoard,
      { seed: seed + STREET_ORDER.indexOf(street), trials: opts.trials },
    );
    const foldsHere = foldsByStreet.get(street) ?? new Set<number>();
    streets.push({
      street,
      board: streetBoard.map(cardToString),
      players: seats.map((s) => ({
        seat: s.seat,
        name: s.name,
        userId: s.userId,
        isViewer: s.seat === viewerSeat,
        isBot: s.isBot,
        holeCards: s.hole ? [cardToString(s.hole[0]), cardToString(s.hole[1])] : null,
        folded: foldedBefore.has(s.seat),
        foldsThisStreet: foldsHere.has(s.seat),
        winPct: foldedBefore.has(s.seat) ? null : (equity.get(s.seat) ?? null),
        stack: stackStartByStreet.get(street)?.get(s.seat) ?? null,
      })),
      potStart: potStartByStreet.get(street) ?? 0,
      actions: actionsByStreet.get(street) ?? [],
    });
    for (const seat of foldsHere) foldedBefore.add(seat);
  }
  return { viewerSeat, streets };
}
