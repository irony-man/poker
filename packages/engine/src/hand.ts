import type { Card } from './cards.js';
import { createDeck, shuffle } from './cards.js';
import { evaluateBest, categoryOf, HAND_CATEGORY_NAMES } from './eval.js';
import { awardPots, buildSidePots, type PotAward, type PotLayer } from './pots.js';

export type Street = 'waiting' | 'preflop' | 'flop' | 'turn' | 'river' | 'showdown' | 'payout';

export type PlayerStatus = 'empty' | 'seated' | 'active' | 'folded' | 'allin' | 'sittingOut';

export interface PlayerState {
  seat: number;
  userId: string | null;
  name: string | null;
  stack: number;
  bet: number;
  /** Total committed this hand. */
  committed: number;
  status: PlayerStatus;
  holeCards: [Card, Card] | null;
  /** Shown at showdown / voluntary show. */
  revealed: boolean;
}

export type ActionType = 'fold' | 'check' | 'call' | 'bet' | 'raise' | 'allin';

export interface ActionIntent {
  type: ActionType;
  /** Absolute raise/bet-to amount for bet/raise; ignored otherwise. */
  amount?: number;
  seq: number;
}

export interface TableConfig {
  maxSeats: number;
  smallBlind: number;
  bigBlind: number;
  minBuyIn: number;
  maxBuyIn: number;
  turnTimeMs: number;
}

export interface HandState {
  handId: string;
  street: Street;
  deck: Card[];
  community: Card[];
  players: PlayerState[];
  dealerButton: number;
  sbSeat: number;
  bbSeat: number;
  toAct: number | null;
  currentBet: number;
  /** Minimum total bet-to for a raise (absolute). */
  minRaiseTo: number;
  /** Last raise size (increment), used for min-raise. */
  lastRaiseSize: number;
  pot: number;
  sidePots: PotLayer[];
  actionSeq: number;
  winners: PotAward[];
  /** Hand category names for revealed seats at showdown. */
  showdownHands: { seat: number; handName: string }[];
  /** Seats that have acted since last aggression this street. */
  actedSinceAggression: Set<number>;
  version: number;
}

export type EngineEvent =
  | { type: 'hand_started'; handId: string }
  | { type: 'blinds_posted'; sb: number; bb: number; sbSeat: number; bbSeat: number }
  | { type: 'dealt_hole' }
  | { type: 'street'; street: Street; cards: Card[] }
  | { type: 'action'; seat: number; action: ActionType; amount: number }
  | { type: 'turn'; seat: number }
  | { type: 'hand_ended'; winners: PotAward[] }
  | { type: 'error'; message: string };

export interface ApplyResult {
  state: HandState;
  events: EngineEvent[];
  ok: boolean;
  error?: string;
}

function cloneState(state: HandState): HandState {
  return {
    ...state,
    deck: state.deck.map((c) => ({ ...c })),
    community: state.community.map((c) => ({ ...c })),
    players: state.players.map((p) => ({
      ...p,
      holeCards: p.holeCards ? [{ ...p.holeCards[0] }, { ...p.holeCards[1] }] : null,
    })),
    sidePots: state.sidePots.map((p) => ({ ...p, eligible: [...p.eligible] })),
    winners: state.winners.map((w) => ({ ...w })),
    showdownHands: state.showdownHands.map((h) => ({ ...h })),
    actedSinceAggression: new Set(state.actedSinceAggression),
  };
}

export function createEmptyTable(config: TableConfig): HandState {
  const players: PlayerState[] = [];
  for (let i = 0; i < config.maxSeats; i++) {
    players.push({
      seat: i,
      userId: null,
      name: null,
      stack: 0,
      bet: 0,
      committed: 0,
      status: 'empty',
      holeCards: null,
      revealed: false,
    });
  }
  return {
    handId: '',
    street: 'waiting',
    deck: [],
    community: [],
    players,
    dealerButton: 0,
    sbSeat: 0,
    bbSeat: 0,
    toAct: null,
    currentBet: 0,
    minRaiseTo: config.bigBlind,
    lastRaiseSize: config.bigBlind,
    pot: 0,
    sidePots: [],
    actionSeq: 0,
    winners: [],
    showdownHands: [],
    actedSinceAggression: new Set(),
    version: 0,
  };
}

function seatedPlayers(state: HandState): PlayerState[] {
  return state.players.filter((p) => p.status !== 'empty' && p.userId && p.stack > 0);
}

function nextOccupiedSeat(state: HandState, from: number, predicate?: (p: PlayerState) => boolean): number {
  const n = state.players.length;
  for (let i = 1; i <= n; i++) {
    const seat = (from + i) % n;
    const p = state.players[seat]!;
    if (p.status === 'empty' || !p.userId) continue;
    if (predicate && !predicate(p)) continue;
    return seat;
  }
  return from;
}

function inHand(p: PlayerState): boolean {
  return p.status === 'active' || p.status === 'allin' || p.status === 'folded';
}

function canAct(p: PlayerState): boolean {
  return p.status === 'active' && p.stack > 0;
}

function livingPlayers(state: HandState): PlayerState[] {
  return state.players.filter((p) => p.status === 'active' || p.status === 'allin');
}

function commitChips(state: HandState, seat: number, amount: number): number {
  const p = state.players[seat]!;
  const pay = Math.min(amount, p.stack);
  p.stack -= pay;
  p.bet += pay;
  p.committed += pay;
  state.pot += pay;
  if (p.stack === 0) p.status = 'allin';
  return pay;
}

export function sitDown(
  state: HandState,
  seat: number,
  userId: string,
  name: string,
  buyIn: number,
): ApplyResult {
  const s = cloneState(state);
  const events: EngineEvent[] = [];
  const p = s.players[seat];
  if (!p) return { state, events, ok: false, error: 'Invalid seat' };
  if (p.status !== 'empty') return { state, events, ok: false, error: 'Seat taken' };
  if (s.players.some((x) => x.userId === userId)) {
    return { state, events, ok: false, error: 'Already seated' };
  }
  p.userId = userId;
  p.name = name;
  p.stack = buyIn;
  p.status = 'seated';
  p.bet = 0;
  p.committed = 0;
  p.holeCards = null;
  p.revealed = false;
  s.version += 1;
  return { state: s, events, ok: true };
}

export function standUp(state: HandState, seat: number): ApplyResult {
  const s = cloneState(state);
  if (s.street !== 'waiting' && s.street !== 'payout') {
    const p = s.players[seat];
    if (p && (p.status === 'active' || p.status === 'allin')) {
      return { state, events: [], ok: false, error: 'Cannot leave mid-hand' };
    }
  }
  const p = s.players[seat];
  if (!p || p.status === 'empty') return { state, events: [], ok: false, error: 'Empty seat' };
  p.userId = null;
  p.name = null;
  p.stack = 0;
  p.status = 'empty';
  p.holeCards = null;
  s.version += 1;
  return { state: s, events: [], ok: true };
}

export function topUp(state: HandState, seat: number, amount: number, maxBuyIn: number): ApplyResult {
  const s = cloneState(state);
  if (s.street !== 'waiting' && s.street !== 'payout') {
    return { state, events: [], ok: false, error: 'Top-up only between hands' };
  }
  const p = s.players[seat];
  if (!p || p.status === 'empty') return { state, events: [], ok: false, error: 'Empty seat' };
  if (p.stack + amount > maxBuyIn) return { state, events: [], ok: false, error: 'Exceeds max buy-in' };
  p.stack += amount;
  if (p.status === 'sittingOut' && p.stack > 0) p.status = 'seated';
  s.version += 1;
  return { state: s, events: [], ok: true };
}

function resetHandFields(state: HandState, handId: string, config: TableConfig): void {
  state.handId = handId;
  state.community = [];
  state.pot = 0;
  state.sidePots = [];
  state.winners = [];
  state.showdownHands = [];
  state.currentBet = 0;
  state.lastRaiseSize = config.bigBlind;
  state.minRaiseTo = config.bigBlind * 2;
  state.actedSinceAggression = new Set();
  state.actionSeq = 0;
  for (const p of state.players) {
    p.bet = 0;
    p.committed = 0;
    p.holeCards = null;
    p.revealed = false;
    if (p.status !== 'empty' && p.userId && p.stack > 0) {
      p.status = 'active';
    } else if (p.status !== 'empty' && p.stack === 0) {
      p.status = 'sittingOut';
    }
  }
}

export function startHand(
  state: HandState,
  config: TableConfig,
  handId: string,
  randomBytes: (n: number) => Uint8Array,
): ApplyResult {
  const s = cloneState(state);
  const events: EngineEvent[] = [];
  const eligible = seatedPlayers(s);
  if (eligible.length < 2) {
    return { state, events, ok: false, error: 'Need at least 2 players' };
  }

  resetHandFields(s, handId, config);
  s.street = 'preflop';
  s.deck = shuffle(createDeck(), randomBytes);

  // Move button among players who will play
  s.dealerButton = nextOccupiedSeat(s, s.dealerButton, (p) => p.status === 'active');

  const activeCount = s.players.filter((p) => p.status === 'active').length;
  if (activeCount === 2) {
    // Heads-up: button is SB, other is BB
    s.sbSeat = s.dealerButton;
    s.bbSeat = nextOccupiedSeat(s, s.dealerButton, (p) => p.status === 'active');
  } else {
    s.sbSeat = nextOccupiedSeat(s, s.dealerButton, (p) => p.status === 'active');
    s.bbSeat = nextOccupiedSeat(s, s.sbSeat, (p) => p.status === 'active');
  }

  commitChips(s, s.sbSeat, config.smallBlind);
  commitChips(s, s.bbSeat, config.bigBlind);
  s.currentBet = Math.max(s.players[s.sbSeat]!.bet, s.players[s.bbSeat]!.bet);
  // If BB was short, currentBet is what BB posted
  s.currentBet = s.players[s.bbSeat]!.bet;
  if (s.players[s.sbSeat]!.bet > s.currentBet) s.currentBet = s.players[s.sbSeat]!.bet;
  s.lastRaiseSize = config.bigBlind;
  s.minRaiseTo = s.currentBet + config.bigBlind;

  events.push({ type: 'hand_started', handId });
  events.push({
    type: 'blinds_posted',
    sb: config.smallBlind,
    bb: config.bigBlind,
    sbSeat: s.sbSeat,
    bbSeat: s.bbSeat,
  });

  // Deal hole cards: two rounds starting left of button
  for (let round = 0; round < 2; round++) {
    for (let i = 0; i < s.players.length; i++) {
      const seat = (s.dealerButton + 1 + i) % s.players.length;
      const p = s.players[seat]!;
      if (p.status !== 'active' && p.status !== 'allin') continue;
      const card = s.deck.pop()!;
      if (!p.holeCards) {
        p.holeCards = [card, card];
      }
      p.holeCards[round as 0 | 1] = card;
    }
  }

  events.push({ type: 'dealt_hole' });

  // First to act preflop: left of BB (UTG), or button in heads-up
  if (activeCount === 2) {
    s.toAct = s.sbSeat; // button/SB acts first preflop HU
  } else {
    s.toAct = nextOccupiedSeat(s, s.bbSeat, canAct);
  }

  // If only one can act (everyone else all-in on blinds), run out
  if (!bettingContinues(s)) {
    return runoutToShowdown(s, events);
  }

  s.actedSinceAggression = new Set();
  // BB has option even if all match — clear acted so BB can check/raise
  events.push({ type: 'turn', seat: s.toAct! });
  s.version += 1;
  return { state: s, events, ok: true };
}

function bettingContinues(state: HandState): boolean {
  const living = livingPlayers(state);
  if (living.length <= 1) return false;
  const actors = living.filter(canAct);
  if (actors.length === 0) return false;
  if (actors.length === 1) {
    const only = actors[0]!;
    return only.bet < state.currentBet;
  }
  return true;
}

function streetComplete(state: HandState): boolean {
  const actors = state.players.filter(canAct);
  if (actors.length === 0) return true;
  for (const p of actors) {
    if (p.bet !== state.currentBet) return false;
    if (!state.actedSinceAggression.has(p.seat)) return false;
  }
  return true;
}

function clearBets(state: HandState): void {
  for (const p of state.players) p.bet = 0;
  state.currentBet = 0;
  state.actedSinceAggression = new Set();
}

function dealCommunity(state: HandState, count: number): Card[] {
  state.deck.pop(); // burn
  const dealt: Card[] = [];
  for (let i = 0; i < count; i++) {
    const c = state.deck.pop()!;
    state.community.push(c);
    dealt.push(c);
  }
  return dealt;
}

function advanceStreet(state: HandState, events: EngineEvent[]): ApplyResult {
  clearBets(state);
  state.lastRaiseSize = 0; // will be set relative to BB on first bet
  state.minRaiseTo = 0;

  if (state.street === 'preflop') {
    state.street = 'flop';
    const cards = dealCommunity(state, 3);
    events.push({ type: 'street', street: 'flop', cards });
  } else if (state.street === 'flop') {
    state.street = 'turn';
    const cards = dealCommunity(state, 1);
    events.push({ type: 'street', street: 'turn', cards });
  } else if (state.street === 'turn') {
    state.street = 'river';
    const cards = dealCommunity(state, 1);
    events.push({ type: 'street', street: 'river', cards });
  } else if (state.street === 'river') {
    return goToShowdown(state, events);
  }

  if (!bettingContinues(state)) {
    return runoutToShowdown(state, events);
  }

  // Postflop first to act: left of button
  state.toAct = nextOccupiedSeat(state, state.dealerButton, canAct);
  state.minRaiseTo = 0;
  events.push({ type: 'turn', seat: state.toAct });
  state.version += 1;
  return { state, events, ok: true };
}

function runoutToShowdown(state: HandState, events: EngineEvent[]): ApplyResult {
  while (state.community.length < 5) {
    if (state.community.length === 0) {
      state.street = 'flop';
      const cards = dealCommunity(state, 3);
      events.push({ type: 'street', street: 'flop', cards });
    } else if (state.community.length === 3) {
      state.street = 'turn';
      const cards = dealCommunity(state, 1);
      events.push({ type: 'street', street: 'turn', cards });
    } else if (state.community.length === 4) {
      state.street = 'river';
      const cards = dealCommunity(state, 1);
      events.push({ type: 'street', street: 'river', cards });
    }
  }
  return goToShowdown(state, events);
}

function goToShowdown(state: HandState, events: EngineEvent[]): ApplyResult {
  state.street = 'showdown';
  state.toAct = null;

  const living = livingPlayers(state);
  const ranks = new Map<number, number>();

  if (living.length === 1) {
    // Award without reveal
    const winner = living[0]!;
    state.winners = [{ seat: winner.seat, amount: state.pot, handName: 'Uncontested' }];
    state.showdownHands = [];
    winner.stack += state.pot;
    state.pot = 0;
    state.street = 'payout';
    events.push({ type: 'hand_ended', winners: state.winners });
    state.version += 1;
    return { state, events, ok: true };
  }

  for (const p of living) {
    if (!p.holeCards) continue;
    p.revealed = true;
    const seven = [...p.holeCards, ...state.community];
    ranks.set(p.seat, evaluateBest(seven));
  }

  state.showdownHands = [...ranks.entries()].map(([seat, rank]) => ({
    seat,
    handName: HAND_CATEGORY_NAMES[categoryOf(rank)],
  }));

  const contributions = state.players
    .filter((p) => p.committed > 0)
    .map((p) => ({
      seat: p.seat,
      amount: p.committed,
      folded: p.status === 'folded',
    }));

  state.sidePots = buildSidePots(contributions);
  const awards = awardPots(state.sidePots, ranks, state.dealerButton, state.players.length);
  state.winners = awards.map((w) => {
    const handName =
      state.showdownHands.find((h) => h.seat === w.seat)?.handName ?? 'High Card';
    return { ...w, handName };
  });

  for (const w of state.winners) {
    state.players[w.seat]!.stack += w.amount;
  }
  state.pot = 0;
  state.street = 'payout';
  events.push({ type: 'hand_ended', winners: state.winners });
  state.version += 1;
  return { state, events, ok: true };
}

function nextActor(state: HandState, from: number): number | null {
  const n = state.players.length;
  for (let i = 1; i <= n; i++) {
    const seat = (from + i) % n;
    if (canAct(state.players[seat]!)) return seat;
  }
  return null;
}

function afterAction(state: HandState, events: EngineEvent[]): ApplyResult {
  // Everyone folded?
  const living = livingPlayers(state);
  if (living.length === 1) {
    return goToShowdown(state, events);
  }

  if (!bettingContinues(state) || streetComplete(state)) {
    if (state.street === 'river' || !bettingContinues(state)) {
      if (state.street === 'river' && streetComplete(state)) {
        return goToShowdown(state, events);
      }
      if (!bettingContinues(state)) {
        return runoutToShowdown(state, events);
      }
    }
    return advanceStreet(state, events);
  }

  const next = nextActor(state, state.toAct!);
  state.toAct = next;
  if (next !== null) events.push({ type: 'turn', seat: next });
  state.version += 1;
  return { state, events, ok: true };
}

export function applyAction(
  state: HandState,
  seat: number,
  action: ActionIntent,
  config: TableConfig,
): ApplyResult {
  const s = cloneState(state);
  const events: EngineEvent[] = [];

  if (s.street === 'waiting' || s.street === 'showdown' || s.street === 'payout') {
    return { state, events, ok: false, error: 'No action expected' };
  }
  if (s.toAct !== seat) return { state, events, ok: false, error: 'Not your turn' };
  if (action.seq !== s.actionSeq) return { state, events, ok: false, error: 'Stale action seq' };

  const p = s.players[seat]!;
  if (!canAct(p)) return { state, events, ok: false, error: 'Cannot act' };

  const toCall = s.currentBet - p.bet;

  switch (action.type) {
    case 'fold': {
      p.status = 'folded';
      p.holeCards = p.holeCards; // keep for server audit; not revealed
      events.push({ type: 'action', seat, action: 'fold', amount: 0 });
      s.actedSinceAggression.add(seat);
      break;
    }
    case 'check': {
      if (toCall > 0) return { state, events, ok: false, error: 'Cannot check' };
      events.push({ type: 'action', seat, action: 'check', amount: 0 });
      s.actedSinceAggression.add(seat);
      break;
    }
    case 'call': {
      if (toCall <= 0) return { state, events, ok: false, error: 'Nothing to call' };
      const paid = commitChips(s, seat, toCall);
      events.push({ type: 'action', seat, action: p.status === 'allin' ? 'allin' : 'call', amount: paid });
      s.actedSinceAggression.add(seat);
      break;
    }
    case 'bet':
    case 'raise': {
      const amountTo = action.amount ?? 0;
      if (amountTo <= s.currentBet && s.currentBet > 0) {
        return { state, events, ok: false, error: 'Raise must exceed current bet' };
      }
      if (s.currentBet === 0 && action.type === 'raise') {
        // treat as bet
      }
      const need = amountTo - p.bet;
      if (need <= 0) return { state, events, ok: false, error: 'Invalid amount' };
      if (need > p.stack) return { state, events, ok: false, error: 'Insufficient chips' };

      const isAllIn = need === p.stack;
      const raiseSize = amountTo - s.currentBet;

      // Min-raise validation (all-in short raises allowed but don't reopen fully)
      if (!isAllIn) {
        if (s.currentBet === 0) {
          // Opening bet must be at least BB
          if (amountTo < config.bigBlind) {
            return { state, events, ok: false, error: 'Bet below minimum' };
          }
        } else if (amountTo < s.minRaiseTo) {
          return { state, events, ok: false, error: 'Raise below minimum' };
        }
      }

      commitChips(s, seat, need);
      const prevBet = s.currentBet;
      s.currentBet = p.bet;
      if (s.currentBet > prevBet) {
        if (raiseSize >= (s.lastRaiseSize || config.bigBlind) || prevBet === 0) {
          s.lastRaiseSize = prevBet === 0 ? s.currentBet : raiseSize;
          s.minRaiseTo = s.currentBet + s.lastRaiseSize;
          s.actedSinceAggression = new Set([seat]);
        } else {
          // Short all-in raise does not reopen; still mark actor as acted
          s.actedSinceAggression.add(seat);
        }
      } else {
        s.actedSinceAggression.add(seat);
      }

      const at: ActionType = p.status === 'allin' ? 'allin' : prevBet === 0 ? 'bet' : 'raise';
      events.push({ type: 'action', seat, action: at, amount: amountTo });
      break;
    }
    case 'allin': {
      const need = p.stack;
      const amountTo = p.bet + need;
      return applyAction(
        state,
        seat,
        {
          type: amountTo > s.currentBet ? (s.currentBet === 0 ? 'bet' : 'raise') : 'call',
          amount: amountTo > s.currentBet ? amountTo : undefined,
          seq: action.seq,
        },
        config,
      );
    }
    default:
      return { state, events, ok: false, error: 'Unknown action' };
  }

  s.actionSeq += 1;
  return afterAction(s, events);
}

/** Auto-action on timeout: check if possible, else fold. */
export function applyTimeout(state: HandState, config: TableConfig): ApplyResult {
  if (state.toAct === null) return { state, events: [], ok: false, error: 'No one to act' };
  const seat = state.toAct;
  const p = state.players[seat]!;
  const toCall = state.currentBet - p.bet;
  if (toCall <= 0) {
    return applyAction(state, seat, { type: 'check', seq: state.actionSeq }, config);
  }
  return applyAction(state, seat, { type: 'fold', seq: state.actionSeq }, config);
}

export function returnToWaiting(state: HandState): HandState {
  const s = cloneState(state);
  s.street = 'waiting';
  s.toAct = null;
  s.handId = '';
  s.community = [];
  s.deck = [];
  s.pot = 0;
  s.sidePots = [];
  s.winners = [];
  s.showdownHands = [];
  s.actionSeq = 0;
  for (const p of s.players) {
    p.bet = 0;
    p.committed = 0;
    p.holeCards = null;
    p.revealed = false;
    if (p.status !== 'empty' && p.userId) {
      p.status = p.stack > 0 ? 'seated' : 'sittingOut';
    }
  }
  s.version += 1;
  return s;
}

export function legalActions(
  state: HandState,
  seat: number,
  config: TableConfig,
): { types: ActionType[]; callAmount: number; minRaiseTo: number; maxRaiseTo: number } {
  const empty = { types: [] as ActionType[], callAmount: 0, minRaiseTo: 0, maxRaiseTo: 0 };
  if (state.toAct !== seat) return empty;
  const p = state.players[seat];
  if (!p || !canAct(p)) return empty;

  const toCall = state.currentBet - p.bet;
  const types: ActionType[] = ['fold'];
  if (toCall <= 0) types.push('check');
  else types.push('call');

  const maxRaiseTo = p.bet + p.stack;
  let minRaiseTo = state.currentBet === 0 ? config.bigBlind : state.minRaiseTo;
  if (minRaiseTo > maxRaiseTo) minRaiseTo = maxRaiseTo;

  if (p.stack > toCall) {
    types.push(state.currentBet === 0 ? 'bet' : 'raise');
    types.push('allin');
  } else if (p.stack > 0 && toCall > 0) {
    types.push('allin');
  }

  return {
    types,
    callAmount: Math.min(toCall, p.stack),
    minRaiseTo,
    maxRaiseTo,
  };
}
