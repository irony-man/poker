import { createDeck, type Card } from './cards.js';
import { evaluateBest } from './eval.js';
import { legalActions } from './hand.js';
import type { ActionIntent, ActionType, HandState, TableConfig } from './hand.js';

const BOT_PREFIX = 'bot:';

export function isBotUserId(userId: string | null | undefined): boolean {
  return !!userId && userId.startsWith(BOT_PREFIX);
}

export function makeBotUserId(id: string): string {
  return `${BOT_PREFIX}${id}`;
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
 * Pro-style bot: Chen preflop ranges, Monte-Carlo postflop equity,
 * pot-odds calling, value-heavy aggression, selective semi-bluffs.
 */
export function chooseBotAction(
  state: HandState,
  seat: number,
  config: TableConfig,
): ActionIntent | null {
  const legal = legalActions(state, seat, config);
  if (legal.types.length === 0) return null;

  const types = new Set(legal.types);
  const seq = state.actionSeq;
  const player = state.players[seat]!;
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

  // —— Short-stack push/fold ——
  if (preflop && effectiveStackBb <= 12) {
    const pushChen = 6 + (1 - late) * 3 + (opponents >= 3 ? 1.5 : 0);
    if (chen >= pushChen) {
      if (types.has('allin')) return { type: 'allin', seq };
      if (types.has('raise')) return { type: 'raise', amount: legal.maxRaiseTo, seq };
      if (types.has('bet')) return { type: 'bet', amount: legal.maxRaiseTo, seq };
      if (types.has('call')) return { type: 'call', seq };
    }
    if (types.has('check')) return { type: 'check', seq };
    if (types.has('call') && potOdds <= 0.28 && chen >= 4.5) return { type: 'call', seq };
    if (types.has('fold')) return { type: 'fold', seq };
  }

  // —— Free action ——
  if (types.has('check')) {
    if (equity >= 0.7 || (!preflop && equity >= 0.6)) {
      const jam = equity >= 0.9 && effectiveStackBb <= 18;
      const bet = raiseOrBet(
        types,
        'bet',
        legal,
        pot,
        state.currentBet,
        player.bet,
        bb,
        equity >= 0.85 ? 0.75 : 0.55,
        player.stack,
        seq,
        jam,
      );
      if (bet) return bet;
    }

    if (preflop && types.has('bet')) {
      const openChen = 10 - late * 4;
      if (chen >= openChen || (chen >= openChen - 1.5 && r < 0.22)) {
        const openTo = snapToBb(bb * (2.2 + late * 0.35), bb, legal.minRaiseTo, legal.maxRaiseTo);
        return { type: 'bet', amount: openTo, seq };
      }
    }

    if (!preflop && opponents <= 2 && equity >= 0.28 && equity < 0.55) {
      if (r < 0.4 + late * 0.12) {
        const bet = raiseOrBet(
          types,
          'bet',
          legal,
          pot,
          state.currentBet,
          player.bet,
          bb,
          0.4,
          player.stack,
          seq,
          false,
        );
        if (bet) return bet;
      }
    }

    if (preflop && chen >= 12 && types.has('bet')) {
      return {
        type: 'bet',
        amount: snapToBb(bb * 2.5, bb, legal.minRaiseTo, legal.maxRaiseTo),
        seq,
      };
    }

    return { type: 'check', seq };
  }

  // —— Facing aggression ——
  const multiwayPenalty = opponents >= 3 ? 0.08 : opponents === 2 ? 0.03 : 0;
  const streetBuffer =
    street === 'river' ? 0.04 : street === 'turn' ? 0.02 : preflop ? 0.03 : 0.01;
  const required = potOdds + multiwayPenalty + streetBuffer;

  const preferRaise: 'raise' | 'bet' = types.has('raise') ? 'raise' : 'bet';
  const thrRaise = preflop ? 0.6 : 0.68;
  if (
    (types.has('raise') || types.has('bet')) &&
    equity >= thrRaise &&
    (preflop ? chen >= 10 : true)
  ) {
    const action = raiseOrBet(
      types,
      preferRaise,
      legal,
      pot,
      state.currentBet,
      player.bet,
      bb,
      equity >= 0.82 ? 0.9 : 0.65,
      player.stack,
      seq,
      equity >= 0.88 && commitFrac > 0.2,
    );
    if (action) return action;
  }

  // Preflop light 3-bet (bluff) from late vs one raiser
  if (
    preflop &&
    types.has('raise') &&
    chen >= 6 &&
    chen < 10 &&
    late > 0.55 &&
    opponents <= 2 &&
    r < 0.12 &&
    commitFrac < 0.18
  ) {
    const threeBet = raiseOrBet(
      types,
      'raise',
      legal,
      pot,
      state.currentBet,
      player.bet,
      bb,
      0.85,
      player.stack,
      seq,
      false,
    );
    if (threeBet) return threeBet;
  }

  // Postflop semi-bluff raise
  if (
    !preflop &&
    types.has('raise') &&
    equity >= 0.38 &&
    equity < 0.62 &&
    potOdds < 0.35 &&
    opponents <= 2 &&
    r < 0.18
  ) {
    const raise = raiseOrBet(
      types,
      'raise',
      legal,
      pot,
      state.currentBet,
      player.bet,
      bb,
      0.7,
      player.stack,
      seq,
      false,
    );
    if (raise) return raise;
  }

  if (types.has('call')) {
    const deep = stackBb > 40;
    const implied =
      !preflop && deep && equity > potOdds - 0.04 && equity < required ? 0.06 : 0;
    const callThr = required - implied;

    if (equity + 0.02 >= callThr && commitFrac < 0.55) return { type: 'call', seq };
    if (preflop && chen >= 14 && commitFrac < 0.45) return { type: 'call', seq };
    if (preflop && potOdds <= 0.3 && chen >= 5 + (1 - late) * 2) return { type: 'call', seq };
    if (street === 'river' && potOdds < 0.28 && equity >= potOdds && r < 0.35) {
      return { type: 'call', seq };
    }
  }

  if (
    types.has('allin') &&
    (commitFrac > 0.4 || effectiveStackBb <= 8) &&
    equity >= required - 0.02
  ) {
    return { type: 'allin', seq };
  }

  if (types.has('fold')) return { type: 'fold', seq };
  if (types.has('call') && equity >= potOdds) return { type: 'call', seq };
  if (types.has('check')) return { type: 'check', seq };

  const fallback = (legal.types.find((t) => t !== 'fold') ?? legal.types[0]) as ActionType;
  return {
    type: fallback,
    amount: fallback === 'bet' || fallback === 'raise' ? legal.minRaiseTo : undefined,
    seq,
  };
}
