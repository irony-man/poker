import { createDeck, type Card } from './cards.js';
import { evaluateBest } from './eval.js';
import { legalActions } from './hand.js';
import type { ActionIntent, ActionType, HandState, TableConfig } from './hand.js';

const BOT_PREFIX = 'bot:';

export function isBotUserId(userId: string | null | undefined): boolean {
  return !!userId && userId.startsWith(BOT_PREFIX);
}

/** Stable playing style for a bot seat. */
export type BotPersonalityId =
  | 'balanced'
  | 'tight'
  | 'loose'
  | 'aggro'
  | 'passive'
  | 'maniac'
  | 'caller'
  | 'nit'
  | 'lag';

export const BOT_PERSONALITY_IDS: readonly BotPersonalityId[] = [
  'balanced',
  'tight',
  'loose',
  'aggro',
  'passive',
  'maniac',
  'caller',
  'nit',
  'lag',
] as const;

export function isBotPersonalityId(value: string | null | undefined): value is BotPersonalityId {
  return !!value && (BOT_PERSONALITY_IDS as readonly string[]).includes(value);
}

/**
 * Build a bot user id. When `personality` is set, encode it as
 * `bot:{style}:{id}` so seating-time admin styles stick for every decision.
 */
export function makeBotUserId(id: string, personality?: BotPersonalityId | null): string {
  let bare = id.startsWith(BOT_PREFIX) ? id.slice(BOT_PREFIX.length) : id;
  // Avoid double-encoding if an already-styled id is passed as the bare part.
  const existing = personalityIdFromRest(bare);
  if (existing) {
    bare = bare.slice(existing.length + 1);
  }
  if (personality && isBotPersonalityId(personality)) {
    return `${BOT_PREFIX}${personality}:${bare}`;
  }
  return `${BOT_PREFIX}${bare}`;
}

function personalityIdFromRest(rest: string): BotPersonalityId | null {
  const i = rest.indexOf(':');
  if (i <= 0) return null;
  const head = rest.slice(0, i);
  return isBotPersonalityId(head) ? head : null;
}

/** Read seating-time style from a bot user id (`bot:maniac:xyz` → maniac). */
export function personalityIdFromBotUserId(
  userId: string | null | undefined,
): BotPersonalityId | null {
  if (!isBotUserId(userId)) return null;
  return personalityIdFromRest(userId!.slice(BOT_PREFIX.length));
}

/** Default display names when no admin bot group (or empty pool) is configured. */
export const DEFAULT_BOT_NAMES = [
  'AceBot',
  'RiverRat',
  'BluffByte',
  'PotOdds',
  'ChipShark',
  'FoldBot',
  'AllInAnnie',
  'NutsNova',
  'CallCart',
  'RaiseRex',
] as const;

export function pickBotName(
  taken: Set<string>,
  pool: readonly string[] = DEFAULT_BOT_NAMES,
): string {
  const names = pool.length > 0 ? pool : DEFAULT_BOT_NAMES;
  for (const n of names) {
    if (n && !taken.has(n)) return n;
  }
  return `Bot${Math.floor(Math.random() * 900) + 100}`;
}

export interface BotPersonality {
  id: BotPersonalityId;
  /** Subtracted from Chen open / 3-bet / push bars (positive = looser). */
  rangeOffset: number;
  /** Scales bet pot-fractions and open sizes (1 = baseline). */
  aggression: number;
  /** Scales light 3-bet / semi-bluff roll odds (1 = baseline). */
  bluffRate: number;
  /** Added to hand equity when deciding calls (positive = sticky). */
  callBias: number;
  /** Lowers stack-off / push equity bar when positive. */
  jamBias: number;
}

export const BOT_PERSONALITIES: Record<BotPersonalityId, BotPersonality> = {
  balanced: {
    id: 'balanced',
    rangeOffset: 0,
    aggression: 1,
    bluffRate: 1,
    callBias: 0,
    jamBias: 0,
  },
  tight: {
    id: 'tight',
    rangeOffset: -1.8,
    aggression: 0.95,
    bluffRate: 0.45,
    callBias: -0.04,
    jamBias: -0.03,
  },
  loose: {
    id: 'loose',
    rangeOffset: 2.2,
    aggression: 0.95,
    bluffRate: 0.9,
    callBias: 0.05,
    jamBias: 0.02,
  },
  aggro: {
    id: 'aggro',
    rangeOffset: 0.6,
    aggression: 1.35,
    bluffRate: 1.35,
    callBias: -0.02,
    jamBias: 0.04,
  },
  passive: {
    id: 'passive',
    rangeOffset: -0.4,
    aggression: 0.55,
    bluffRate: 0.25,
    callBias: 0.04,
    jamBias: -0.05,
  },
  maniac: {
    id: 'maniac',
    rangeOffset: 3.2,
    aggression: 1.55,
    bluffRate: 1.9,
    callBias: 0.02,
    jamBias: 0.12,
  },
  caller: {
    id: 'caller',
    rangeOffset: 1.4,
    aggression: 0.5,
    bluffRate: 0.2,
    callBias: 0.1,
    jamBias: -0.04,
  },
  nit: {
    id: 'nit',
    rangeOffset: -3.2,
    aggression: 0.75,
    bluffRate: 0.15,
    callBias: -0.08,
    jamBias: -0.06,
  },
  lag: {
    id: 'lag',
    rangeOffset: 1.8,
    aggression: 1.3,
    bluffRate: 1.5,
    callBias: 0.01,
    jamBias: 0.05,
  },
};

/** Default roster → distinct styles (names alone used to be pure fluff). */
export const BOT_NAME_PERSONALITIES: Readonly<Record<string, BotPersonalityId>> = {
  AceBot: 'aggro',
  RiverRat: 'caller',
  BluffByte: 'lag',
  PotOdds: 'balanced',
  ChipShark: 'aggro',
  FoldBot: 'nit',
  AllInAnnie: 'maniac',
  NutsNova: 'tight',
  CallCart: 'caller',
  RaiseRex: 'aggro',
};

/** Admin / seating overrides for how names resolve to styles. */
export interface BotStyleOptions {
  /** Per display-name style (exact key preferred; case-insensitive fallback). */
  namePersonalities?: Readonly<Record<string, BotPersonalityId>>;
  /**
   * When a name has no override, use this style.
   * When null/absent, fall back to the built-in name map then a stable hash.
   */
  defaultPersonality?: BotPersonalityId | null;
}

/**
 * Pick a personality id for a bot about to sit: per-name override → group
 * default → built-in roster → hash of seed.
 */
export function resolveBotPersonalityId(
  name: string | null | undefined,
  seed: string,
  options?: BotStyleOptions | null,
): BotPersonalityId {
  if (name && options?.namePersonalities) {
    const direct = options.namePersonalities[name];
    if (direct && isBotPersonalityId(direct)) return direct;
    const key = Object.keys(options.namePersonalities).find(
      (k) => k.toLowerCase() === name.toLowerCase(),
    );
    if (key) {
      const id = options.namePersonalities[key];
      if (id && isBotPersonalityId(id)) return id;
    }
  }
  if (options?.defaultPersonality && isBotPersonalityId(options.defaultPersonality)) {
    return options.defaultPersonality;
  }
  if (name) {
    const byName = BOT_NAME_PERSONALITIES[name];
    if (byName) return byName;
    const key = Object.keys(BOT_NAME_PERSONALITIES).find(
      (k) => k.toLowerCase() === name.toLowerCase(),
    );
    if (key) return BOT_NAME_PERSONALITIES[key]!;
  }
  const h = seed && seed.length > 0 ? seed : name ?? 'bot';
  return BOT_PERSONALITY_IDS[hashString(h) % BOT_PERSONALITY_IDS.length]!;
}

function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Stable personality for a bot: encoded userId first, then admin options,
 * built-in name map, else hash of userId.
 */
export function personalityForBot(
  userId: string | null | undefined,
  name?: string | null,
  options?: BotStyleOptions | null,
): BotPersonality {
  const fromId = personalityIdFromBotUserId(userId);
  if (fromId) return BOT_PERSONALITIES[fromId];
  const id = resolveBotPersonalityId(name, userId ?? name ?? 'bot', options);
  return BOT_PERSONALITIES[id];
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

function snapToBb(amount: number, bb: number, min: number, max: number): number {
  if (max < min) return min;
  const step = Math.max(1, bb);
  const snapped = Math.round(amount / step) * step;
  return Math.max(min, Math.min(max, snapped));
}

function cardKey(c: Card): string {
  return `${c.rank}${c.suit}`;
}

/** Chen formula — used for preflop hand ranking (open / 3-bet ranges). */
export function chenScore(a: Card, b: Card): number {
  const hi = Math.max(a.rank, b.rank);
  const lo = Math.min(a.rank, b.rank);
  const scoreRank = (r: number): number => {
    if (r === 14) return 10;
    if (r === 13) return 8;
    if (r === 12) return 7;
    if (r === 11) return 6;
    if (r === 10) return 5;
    return r / 2;
  };

  let score = scoreRank(hi);
  if (a.rank === b.rank) {
    score = Math.max(5, scoreRank(hi) * 2);
  } else {
    if (a.suit === b.suit) score += 2;
    const gap = hi - lo - 1;
    if (gap === 1) score -= 1;
    else if (gap === 2) score -= 2;
    else if (gap === 3) score -= 4;
    else if (gap >= 4) score -= 5;
    if (hi < 12 && gap <= 1) score += 1;
  }
  return score;
}

/** Map Chen (~0–20) to a preflop equity proxy vs n random hands. */
function preflopEquity(a: Card, b: Card, opponents: number): number {
  const s = Math.max(0, Math.min(20, chenScore(a, b))) / 20;
  const multi = Math.pow(s, 1 + 0.22 * Math.max(0, opponents - 1));
  return Math.max(0.02, Math.min(0.95, multi));
}

function shuffleInPlace<T>(arr: T[]): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const t = arr[i]!;
    arr[i] = arr[j]!;
    arr[j] = t;
  }
}

/**
 * Monte-Carlo equity vs n random opponents using only known cards.
 * Fast enough for realtime bot decisions (~70 trials).
 */
export function estimateEquity(
  hole: [Card, Card],
  board: Card[],
  opponents: number,
  trials = 72,
): number {
  const nOpp = Math.max(1, Math.min(5, opponents));
  if (board.length === 0) return preflopEquity(hole[0], hole[1], nOpp);

  const known = new Set([cardKey(hole[0]), cardKey(hole[1]), ...board.map(cardKey)]);
  const remaining = createDeck().filter((c) => !known.has(cardKey(c)));
  const needBoard = 5 - board.length;
  const needCards = nOpp * 2 + needBoard;
  if (remaining.length < needCards) return preflopEquity(hole[0], hole[1], nOpp);

  let wins = 0;
  let ties = 0;

  for (let t = 0; t < trials; t++) {
    const deck = remaining.slice();
    shuffleInPlace(deck);
    let ix = 0;
    const fullBoard = board.slice();
    for (let i = 0; i < needBoard; i++) fullBoard.push(deck[ix++]!);

    const myRank = evaluateBest([hole[0], hole[1], ...fullBoard]);
    let bestOpp = -1;
    let tiedOpp = 0;
    for (let o = 0; o < nOpp; o++) {
      const c1 = deck[ix++]!;
      const c2 = deck[ix++]!;
      const rank = evaluateBest([c1, c2, ...fullBoard]);
      if (rank > bestOpp) {
        bestOpp = rank;
        tiedOpp = 1;
      } else if (rank === bestOpp) {
        tiedOpp += 1;
      }
    }
    if (myRank > bestOpp) wins += 1;
    else if (myRank === bestOpp) ties += 1 / (tiedOpp + 1);
  }

  return (wins + ties) / trials;
}

function activeOtherCount(state: HandState, seat: number): number {
  return state.players.filter(
    (p) =>
      p.seat !== seat &&
      !!p.userId &&
      (p.status === 'active' || p.status === 'allin'),
  ).length;
}

/** 0 = early, 1 = button. */
function lateFactor(seat: number, button: number, nSeats: number): number {
  if (nSeats <= 1) return 1;
  const fromBtn = (button - seat + nSeats) % nSeats;
  return 1 - fromBtn / (nSeats - 1);
}

function sizeTo(
  legal: { minRaiseTo: number; maxRaiseTo: number },
  pot: number,
  currentBet: number,
  bb: number,
  potFrac: number,
): number {
  const min = legal.minRaiseTo;
  const max = legal.maxRaiseTo;
  const raw =
    currentBet === 0
      ? Math.max(min, pot * potFrac)
      : currentBet + Math.max(bb, pot * potFrac);
  return snapToBb(raw, bb, min, max);
}

function raiseOrBet(
  types: Set<ActionType>,
  prefer: 'bet' | 'raise',
  legal: { minRaiseTo: number; maxRaiseTo: number; callAmount: number },
  pot: number,
  currentBet: number,
  playerBet: number,
  bb: number,
  potFrac: number,
  stack: number,
  seq: number,
  jam: boolean,
): ActionIntent | null {
  if (jam && types.has('allin')) return { type: 'allin', seq };
  if (legal.maxRaiseTo <= legal.minRaiseTo && types.has('allin')) {
    return { type: 'allin', seq };
  }

  const target = sizeTo(legal, pot, currentBet, bb, potFrac);
  // Chips this player still needs to put in to reach `target`
  const moreToPut = Math.max(0, target - playerBet);
  if (moreToPut >= stack * 0.75 && types.has('allin')) {
    return { type: 'allin', seq };
  }

  if (types.has(prefer)) {
    return { type: prefer, amount: target, seq };
  }
  if (types.has('allin')) return { type: 'allin', seq };
  return null;
}

/**
 * Chen preflop + Monte-Carlo postflop equity, pot-odds calling, and selective
 * bluffs — scaled per seat by {@link BotPersonality} (name map or userId hash).
 */
export function chooseBotAction(
  state: HandState,
  seat: number,
  config: TableConfig,
  personality?: BotPersonality,
): ActionIntent | null {
  const legal = legalActions(state, seat, config);
  if (legal.types.length === 0) return null;

  const types = new Set(legal.types);
  const seq = state.actionSeq;
  const player = state.players[seat]!;
  const style = personality ?? personalityForBot(player.userId, player.name);
  const bb = config.bigBlind;
  const pot = Math.max(1, state.pot);
  const hole = player.holeCards;
  const r = Math.random();
  const opponents = Math.max(1, activeOtherCount(state, seat));
  const late = lateFactor(seat, state.dealerButton, state.players.length);
  const stackBb = (player.stack + player.bet) / Math.max(1, bb);
  const effectiveStackBb = player.stack / Math.max(1, bb);
  const street = state.street;
  const preflop = street === 'preflop';
  const agg = Math.max(0.35, style.aggression);
  const bluff = Math.max(0, style.bluffRate);

  if (!hole) {
    if (types.has('check')) return { type: 'check', seq };
    if (types.has('fold')) return { type: 'fold', seq };
    if (types.has('call')) return { type: 'call', seq };
    const t = legal.types[0] as ActionType;
    return {
      type: t,
      amount: t === 'bet' || t === 'raise' ? legal.minRaiseTo : undefined,
      seq,
    };
  }

  const equity = estimateEquity(hole, state.community, opponents);
  const chen = chenScore(hole[0], hole[1]);
  const callAmt = legal.callAmount;
  const potOdds = callAmt > 0 ? callAmt / (pot + callAmt) : 0;
  const commitFrac = callAmt / Math.max(1, player.stack);
  const callEq = equity + style.callBias;

  // —— Short-stack push/fold ——
  if (preflop && effectiveStackBb <= 12) {
    const pushChen =
      6 + (1 - late) * 3 + (opponents >= 3 ? 1.5 : 0) - style.rangeOffset - style.jamBias * 4;
    if (chen >= pushChen) {
      if (types.has('allin')) return { type: 'allin', seq };
      if (types.has('raise')) return { type: 'raise', amount: legal.maxRaiseTo, seq };
      if (types.has('bet')) return { type: 'bet', amount: legal.maxRaiseTo, seq };
      if (types.has('call')) return { type: 'call', seq };
    }
    if (types.has('check')) return { type: 'check', seq };
    if (
      types.has('call') &&
      potOdds <= 0.28 + style.callBias &&
      chen >= 4.5 - style.rangeOffset * 0.4
    ) {
      return { type: 'call', seq };
    }
    if (types.has('fold')) return { type: 'fold', seq };
  }

  // —— Free action ——
  if (types.has('check')) {
    const valueThr = (preflop ? 0.7 : 0.6) - (agg - 1) * 0.06;
    if (equity >= valueThr) {
      const jam =
        equity >= 0.9 - style.jamBias && effectiveStackBb <= 18 + style.jamBias * 20;
      const potFrac = (equity >= 0.85 ? 0.75 : 0.55) * agg;
      const bet = raiseOrBet(
        types,
        'bet',
        legal,
        pot,
        state.currentBet,
        player.bet,
        bb,
        potFrac,
        player.stack,
        seq,
        jam,
      );
      if (bet) return bet;
    }

    if (preflop && types.has('bet')) {
      const openChen = 10 - late * 4 - style.rangeOffset;
      const stealOdds = clamp01(0.22 * bluff);
      if (chen >= openChen || (chen >= openChen - 1.5 && r < stealOdds)) {
        const openBb = (2.2 + late * 0.35) * Math.min(1.6, 0.85 + agg * 0.15);
        const openTo = snapToBb(bb * openBb, bb, legal.minRaiseTo, legal.maxRaiseTo);
        return { type: 'bet', amount: openTo, seq };
      }
    }

    if (!preflop && opponents <= 2 && equity >= 0.28 - style.rangeOffset * 0.02 && equity < 0.55) {
      if (r < clamp01((0.4 + late * 0.12) * bluff * Math.min(1.4, agg))) {
        const bet = raiseOrBet(
          types,
          'bet',
          legal,
          pot,
          state.currentBet,
          player.bet,
          bb,
          0.4 * agg,
          player.stack,
          seq,
          false,
        );
        if (bet) return bet;
      }
    }

    if (preflop && chen >= 12 - style.rangeOffset * 0.35 && types.has('bet')) {
      return {
        type: 'bet',
        amount: snapToBb(bb * 2.5 * Math.min(1.4, agg), bb, legal.minRaiseTo, legal.maxRaiseTo),
        seq,
      };
    }

    return { type: 'check', seq };
  }

  // —— Facing aggression ——
  const multiwayPenalty = opponents >= 3 ? 0.08 : opponents === 2 ? 0.03 : 0;
  const streetBuffer =
    street === 'river' ? 0.04 : street === 'turn' ? 0.02 : preflop ? 0.03 : 0.01;
  const required = potOdds + multiwayPenalty + streetBuffer - style.callBias * 0.5;

  const preferRaise: 'raise' | 'bet' = types.has('raise') ? 'raise' : 'bet';
  const thrRaise = (preflop ? 0.6 : 0.68) - (agg - 1) * 0.05 - style.jamBias * 0.04;
  const raiseChen = 10 - style.rangeOffset * 0.6;
  if (
    (types.has('raise') || types.has('bet')) &&
    equity >= thrRaise &&
    (preflop ? chen >= raiseChen : true)
  ) {
    const action = raiseOrBet(
      types,
      preferRaise,
      legal,
      pot,
      state.currentBet,
      player.bet,
      bb,
      (equity >= 0.82 ? 0.9 : 0.65) * agg,
      player.stack,
      seq,
      equity >= 0.88 - style.jamBias && commitFrac > 0.2 - style.jamBias,
    );
    if (action) return action;
  }

  // Preflop light 3-bet (bluff) from late vs one raiser
  if (
    preflop &&
    types.has('raise') &&
    chen >= 6 - style.rangeOffset * 0.5 &&
    chen < 10 + style.rangeOffset * 0.3 &&
    late > 0.55 - (bluff > 1 ? 0.12 : 0) &&
    opponents <= 2 &&
    r < clamp01(0.12 * bluff) &&
    commitFrac < 0.18 + style.jamBias * 0.1
  ) {
    const threeBet = raiseOrBet(
      types,
      'raise',
      legal,
      pot,
      state.currentBet,
      player.bet,
      bb,
      0.85 * Math.min(1.5, agg),
      player.stack,
      seq,
      style.jamBias > 0.08 && r < 0.25,
    );
    if (threeBet) return threeBet;
  }

  // Postflop semi-bluff raise
  if (
    !preflop &&
    types.has('raise') &&
    equity >= 0.38 - style.rangeOffset * 0.015 &&
    equity < 0.62 &&
    potOdds < 0.35 + style.callBias * 0.2 &&
    opponents <= 2 &&
    r < clamp01(0.18 * bluff)
  ) {
    const raise = raiseOrBet(
      types,
      'raise',
      legal,
      pot,
      state.currentBet,
      player.bet,
      bb,
      0.7 * agg,
      player.stack,
      seq,
      false,
    );
    if (raise) return raise;
  }

  if (types.has('call')) {
    const deep = stackBb > 40;
    const implied =
      !preflop && deep && callEq > potOdds - 0.04 && callEq < required ? 0.06 : 0;
    const callThr = required - implied;
    const commitCap = 0.55 + style.callBias * 0.8 + (style.id === 'caller' ? 0.12 : 0);

    if (callEq + 0.02 >= callThr && commitFrac < commitCap) return { type: 'call', seq };
    if (preflop && chen >= 14 - style.rangeOffset * 0.4 && commitFrac < 0.45 + style.callBias) {
      return { type: 'call', seq };
    }
    if (
      preflop &&
      potOdds <= 0.3 + style.callBias * 0.5 &&
      chen >= 5 + (1 - late) * 2 - style.rangeOffset
    ) {
      return { type: 'call', seq };
    }
    if (
      street === 'river' &&
      potOdds < 0.28 + style.callBias &&
      callEq >= potOdds &&
      r < clamp01(0.35 + style.callBias * 2)
    ) {
      return { type: 'call', seq };
    }
  }

  if (
    types.has('allin') &&
    (commitFrac > 0.4 - style.jamBias || effectiveStackBb <= 8 + style.jamBias * 10) &&
    callEq >= required - 0.02 - style.jamBias
  ) {
    return { type: 'allin', seq };
  }

  if (types.has('fold')) return { type: 'fold', seq };
  if (types.has('call') && callEq >= potOdds) return { type: 'call', seq };
  if (types.has('check')) return { type: 'check', seq };

  const fallback = (legal.types.find((t) => t !== 'fold') ?? legal.types[0]) as ActionType;
  return {
    type: fallback,
    amount: fallback === 'bet' || fallback === 'raise' ? legal.minRaiseTo : undefined,
    seq,
  };
}
