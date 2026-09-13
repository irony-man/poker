import type { Card, Suit } from './cards.js';
import { cardEquals } from './cards.js';
import {
  clearHands,
  cloneState,
  completeDealAfterTrump,
  dealFull,
  dealHokmPreview,
  defaultShuffle,
  emptySeat,
  isLegalPlay,
  legalCards,
  nextSeat,
  scoreHand,
  seatedSeats,
  teamOf,
  trickWinner,
} from './rules.js';
import {
  DEFAULT_TURN_TIME_MS,
  HANDS_TO_WIN,
  SEAT_COUNT,
  type ApplyResult,
  type CourtpieceEvent,
  type CourtpieceState,
  type CreateMatchOpts,
  type SitOpts,
} from './types.js';

const BOT_PREFIX = 'bot:';

function fail(state: CourtpieceState, error: string): ApplyResult {
  return { state, events: [], ok: false, error };
}

function bump(state: CourtpieceState): void {
  state.version += 1;
  state.actionSeq += 1;
}

function checkSeq(state: CourtpieceState, seq?: number): string | null {
  if (seq !== undefined && seq !== state.actionSeq) return 'Stale action';
  return null;
}

function inLobbyOrFinished(state: CourtpieceState): boolean {
  return state.phase === 'lobby' || state.phase === 'finished';
}

function isBotUserId(userId: string, opts?: SitOpts): boolean {
  return !!opts?.bot || userId.startsWith(BOT_PREFIX);
}

function humansAllReady(state: CourtpieceState): boolean {
  const seated = seatedSeats(state);
  if (seated.length < SEAT_COUNT) return false;
  return seated.every((s) => s.isBot || s.ready);
}

export function createMatch(opts: CreateMatchOpts): CourtpieceState {
  const { rulesVariant } = opts;
  if (rulesVariant !== 'classic' && rulesVariant !== 'classic_full' && rulesVariant !== 'hokm') {
    throw new Error('Invalid rulesVariant');
  }
  const turnTimeMs = opts.turnTimeMs ?? DEFAULT_TURN_TIME_MS;
  if (!Number.isFinite(turnTimeMs) || turnTimeMs <= 0) {
    throw new Error('turnTimeMs must be a positive number');
  }
  const handsToWin = opts.handsToWin ?? HANDS_TO_WIN;
  const seats = [];
  for (let i = 0; i < SEAT_COUNT; i++) seats.push(emptySeat(i));
  return {
    matchId: opts.matchId ?? '',
    phase: 'lobby',
    config: { rulesVariant, turnTimeMs, handsToWin },
    seats,
    dealer: 0,
    hakem: null,
    trumpSetter: null,
    trump: null,
    currentTrick: [],
    trickLeader: null,
    toAct: null,
    teamHands: [0, 0],
    handNumber: 0,
    winnerTeam: null,
    undealt: [],
    actionSeq: 0,
    version: 0,
  };
}

export function sit(
  state: CourtpieceState,
  seat: number,
  userId: string,
  name: string,
  opts?: SitOpts,
): ApplyResult {
  if (!inLobbyOrFinished(state)) return fail(state, 'Cannot sit during a match');
  const s = cloneState(state);
  const p = s.seats[seat];
  if (!p) return fail(state, 'Invalid seat');
  if (p.status !== 'empty') return fail(state, 'Seat taken');
  if (s.seats.some((x) => x.userId === userId)) return fail(state, 'Already seated');
  if (seatedSeats(s).length >= SEAT_COUNT) return fail(state, 'Table full');
  const bot = isBotUserId(userId, opts);
  p.userId = userId;
  p.name = name;
  p.isBot = bot;
  p.ready = bot;
  p.status = 'seated';
  p.hand = [];
  p.tricksThisHand = 0;
  bump(s);
  return {
    state: s,
    events: [{ type: 'seated', seat, userId, name, isBot: bot }],
    ok: true,
  };
}

export function stand(state: CourtpieceState, seat: number): ApplyResult {
  if (!inLobbyOrFinished(state)) return fail(state, 'Cannot stand during a match');
  const s = cloneState(state);
  const p = s.seats[seat];
  if (!p || p.status === 'empty') return fail(state, 'Empty seat');
  s.seats[seat] = emptySeat(seat);
  bump(s);
  return { state: s, events: [{ type: 'stood', seat }], ok: true };
}

export function setReady(state: CourtpieceState, seat: number, ready: boolean): ApplyResult {
  if (!inLobbyOrFinished(state)) return fail(state, 'Ready only in lobby');
  const s = cloneState(state);
  const p = s.seats[seat];
  if (!p || p.status !== 'seated') return fail(state, 'Empty seat');
  if (p.isBot) return fail(state, 'Bots are always ready');
  p.ready = ready;
  bump(s);
  return { state: s, events: [{ type: 'ready', seat, ready }], ok: true };
}

function beginHand(
  s: CourtpieceState,
  events: CourtpieceEvent[],
  shuffle: <T>(arr: T[]) => T[] = defaultShuffle,
): void {
  s.handNumber += 1;
  clearHands(s);
  s.trump = null;
  s.currentTrick = [];
  s.trickLeader = null;

  const variant = s.config.rulesVariant;
  if (variant === 'hokm') {
    if (s.hakem == null) s.hakem = s.dealer;
    s.trumpSetter = s.hakem;
    dealHokmPreview(s, s.hakem, shuffle);
  } else {
    s.hakem = null;
    s.trumpSetter = nextSeat(s.dealer);
    dealFull(s, shuffle);
  }

  s.phase = 'choosing_trump';
  s.toAct = s.trumpSetter;
  events.push({
    type: 'hand_started',
    handNumber: s.handNumber,
    dealer: s.dealer,
    hakem: s.hakem,
  });
  events.push({ type: 'turn', seat: s.toAct! });
}

export function startMatch(
  state: CourtpieceState,
  opts?: { shuffle?: CreateMatchOpts['shuffle'] },
): ApplyResult {
  if (state.phase !== 'lobby' && state.phase !== 'finished') {
    return fail(state, 'Match already in progress');
  }
  if (seatedSeats(state).length < SEAT_COUNT) return fail(state, 'Need 4 players');
  if (!humansAllReady(state)) return fail(state, 'All humans must be ready');

  const s = cloneState(state);
  const events: CourtpieceEvent[] = [];
  for (const seat of s.seats) {
    if (seat.status === 'seated' && !seat.isBot) seat.ready = false;
  }
  s.teamHands = [0, 0];
  s.handNumber = 0;
  s.winnerTeam = null;
  s.dealer = 0;
  s.hakem = s.config.rulesVariant === 'hokm' ? 0 : null;
  bump(s);
  events.push({ type: 'match_started', handNumber: 1 });
  beginHand(s, events, opts?.shuffle ?? defaultShuffle);
  return { state: s, events, ok: true };
}

export function setTrump(
  state: CourtpieceState,
  seat: number,
  suit: Suit,
  seq?: number,
): ApplyResult {
  const stale = checkSeq(state, seq);
  if (stale) return fail(state, stale);
  if (state.phase !== 'choosing_trump') return fail(state, 'Not choosing trump');
  if (state.toAct !== seat || state.trumpSetter !== seat) return fail(state, 'Not your turn');
  if (suit !== 'c' && suit !== 'd' && suit !== 'h' && suit !== 's') {
    return fail(state, 'Invalid suit');
  }

  const s = cloneState(state);
  const events: CourtpieceEvent[] = [];
  s.trump = suit;
  events.push({ type: 'trump_set', suit, bySeat: seat });

  if (s.config.rulesVariant === 'hokm') {
    completeDealAfterTrump(s);
  }

  const leader = s.config.rulesVariant === 'hokm' ? s.hakem! : nextSeat(s.dealer);
  s.trickLeader = leader;
  s.toAct = leader;
  s.currentTrick = [];
  s.phase = 'playing';
  bump(s);
  events.push({ type: 'turn', seat: leader });
  return { state: s, events, ok: true };
}

function removeFromHand(hand: Card[], card: Card): boolean {
  const idx = hand.findIndex((c) => cardEquals(c, card));
  if (idx < 0) return false;
  hand.splice(idx, 1);
  return true;
}

function finishHand(
  s: CourtpieceState,
  events: CourtpieceEvent[],
  shuffle: <T>(arr: T[]) => T[],
): void {
  const { winningTeam, handsAwarded, tricks } = scoreHand(s);
  s.teamHands[winningTeam] += handsAwarded;
  events.push({ type: 'hand_scored', winningTeam, handsAwarded, tricks });

  if (s.teamHands[winningTeam] >= s.config.handsToWin) {
    s.phase = 'finished';
    s.winnerTeam = winningTeam;
    s.toAct = null;
    events.push({ type: 'won', team: winningTeam });
    return;
  }

  if (s.config.rulesVariant === 'hokm') {
    const hakemTeam = teamOf(s.hakem!);
    if (winningTeam !== hakemTeam) {
      s.hakem = nextSeat(s.hakem!);
    }
    s.dealer = s.hakem!;
  } else {
    s.dealer = nextSeat(s.dealer);
  }

  beginHand(s, events, shuffle);
}

export function playCard(
  state: CourtpieceState,
  seat: number,
  card: Card,
  seq?: number,
  opts?: { shuffle?: CreateMatchOpts['shuffle'] },
): ApplyResult {
  const stale = checkSeq(state, seq);
  if (stale) return fail(state, stale);
  if (state.phase !== 'playing') return fail(state, 'Not accepting plays');
  if (state.toAct !== seat) return fail(state, 'Not your turn');
  if (!state.trump) return fail(state, 'Trump not set');
  if (!isLegalPlay(state, seat, card)) return fail(state, 'Illegal play');

  const s = cloneState(state);
  const events: CourtpieceEvent[] = [];
  const hand = s.seats[seat]!.hand;
  if (!removeFromHand(hand, card)) return fail(state, 'Card not in hand');

  s.currentTrick.push({ seat, card: { ...card } });
  events.push({ type: 'card_played', seat, card: { ...card } });

  if (s.currentTrick.length < SEAT_COUNT) {
    s.toAct = nextSeat(seat);
    bump(s);
    events.push({ type: 'turn', seat: s.toAct });
    return { state: s, events, ok: true };
  }

  const winner = trickWinner(s.currentTrick, s.trump!);
  s.seats[winner]!.tricksThisHand += 1;
  events.push({ type: 'trick_won', seat: winner, team: teamOf(winner) });
  s.currentTrick = [];
  s.trickLeader = winner;

  const cardsLeft = s.seats.reduce((n, p) => n + p.hand.length, 0);
  if (cardsLeft === 0) {
    bump(s);
    finishHand(s, events, opts?.shuffle ?? defaultShuffle);
    return { state: s, events, ok: true };
  }

  s.toAct = winner;
  bump(s);
  events.push({ type: 'turn', seat: winner });
  return { state: s, events, ok: true };
}

/** Auto-play for turn timeout. */
export function autoPlayLegal(
  state: CourtpieceState,
  seat: number,
  seq?: number,
  opts?: {
    shuffle?: CreateMatchOpts['shuffle'];
    pick?: (cards: Card[]) => Card;
  },
): ApplyResult {
  const cards = legalCards(state, seat);
  if (cards.length === 0) return fail(state, 'No legal cards');
  const card = opts?.pick?.(cards) ?? cards[0]!;
  return playCard(state, seat, card, seq, opts);
}
