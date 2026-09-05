import { defaultRollDie } from './rng.js';
import {
  allTokensHome,
  applyTokenMove,
  cloneState,
  computeLegalMoves,
  emptySeat,
  firstSeatedSeat,
  nextSeatedSeat,
  seatedSeats,
} from './rules.js';
import {
  DEFAULT_TURN_TIME_MS,
  SEAT_COUNT,
  type ApplyResult,
  type CreateMatchOpts,
  type LudoEvent,
  type LudoState,
  type MoveResult,
  type RollDie,
  type RollResult,
  type SitOpts,
} from './types.js';

const BOT_PREFIX = 'bot:';

function fail(state: LudoState, error: string): ApplyResult {
  return { state, events: [], ok: false, error };
}

function bump(state: LudoState): void {
  state.version += 1;
  state.actionSeq += 1;
}

function checkSeq(state: LudoState, seq?: number): string | null {
  if (seq !== undefined && seq !== state.actionSeq) return 'Stale action';
  return null;
}

function inLobbyOrFinished(state: LudoState): boolean {
  return state.phase === 'lobby' || state.phase === 'finished';
}

function isBotUserId(userId: string, opts?: SitOpts): boolean {
  return !!opts?.bot || userId.startsWith(BOT_PREFIX);
}

function humansAllReady(state: LudoState): boolean {
  const seated = seatedSeats(state);
  if (seated.length < 2) return false;
  return seated.every((s) => s.isBot || s.ready);
}

function passTurn(state: LudoState, fromSeat: number, events: LudoEvent[]): void {
  state.consecutiveSixes = 0;
  state.lastDie = null;
  state.legalMoves = [];
  const next = nextSeatedSeat(state, fromSeat);
  state.toAct = next;
  state.phase = 'rolling';
  events.push({ type: 'turn', seat: next });
}

function extraTurn(state: LudoState, seat: number, events: LudoEvent[]): void {
  state.lastDie = null;
  state.legalMoves = [];
  state.toAct = seat;
  state.phase = 'rolling';
  events.push({ type: 'extra_turn', seat });
}

function resetTokens(state: LudoState): void {
  for (const seat of state.seats) {
    for (const t of seat.tokens) t.pos = { kind: 'yard' };
  }
}

export function createMatch(opts: CreateMatchOpts): LudoState {
  const { maxSeats } = opts;
  if (maxSeats !== 2 && maxSeats !== 3 && maxSeats !== 4) {
    throw new Error('maxSeats must be 2, 3, or 4');
  }
  const turnTimeMs = opts.turnTimeMs ?? DEFAULT_TURN_TIME_MS;
  if (!Number.isFinite(turnTimeMs) || turnTimeMs <= 0) {
    throw new Error('turnTimeMs must be a positive number');
  }
  const seats = [];
  for (let i = 0; i < SEAT_COUNT; i++) seats.push(emptySeat(i));
  return {
    matchId: opts.matchId ?? '',
    phase: 'lobby',
    config: { maxSeats, turnTimeMs },
    seats,
    toAct: null,
    lastDie: null,
    consecutiveSixes: 0,
    legalMoves: [],
    winnerSeat: null,
    actionSeq: 0,
    version: 0,
  };
}

export function sit(
  state: LudoState,
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
  if (seatedSeats(s).length >= s.config.maxSeats) return fail(state, 'Table full');
  const bot = isBotUserId(userId, opts);
  p.userId = userId;
  p.name = name;
  p.isBot = bot;
  p.ready = bot;
  p.status = 'seated';
  p.tokens = emptySeat(seat).tokens;
  bump(s);
  return {
    state: s,
    events: [{ type: 'seated', seat, userId, name, isBot: bot }],
    ok: true,
  };
}

export function stand(state: LudoState, seat: number): ApplyResult {
  if (!inLobbyOrFinished(state)) return fail(state, 'Cannot stand during a match');
  const s = cloneState(state);
  const p = s.seats[seat];
  if (!p || p.status === 'empty') return fail(state, 'Empty seat');
  s.seats[seat] = emptySeat(seat);
  bump(s);
  return { state: s, events: [{ type: 'stood', seat }], ok: true };
}

export function setReady(state: LudoState, seat: number, ready: boolean): ApplyResult {
  if (!inLobbyOrFinished(state)) return fail(state, 'Ready only in lobby');
  const s = cloneState(state);
  const p = s.seats[seat];
  if (!p || p.status !== 'seated') return fail(state, 'Empty seat');
  if (p.isBot) return fail(state, 'Bots are always ready');
  p.ready = ready;
  bump(s);
  return { state: s, events: [{ type: 'ready', seat, ready }], ok: true };
}

export function startMatch(state: LudoState): ApplyResult {
  if (state.phase !== 'lobby' && state.phase !== 'finished') {
    return fail(state, 'Match already in progress');
  }
  if (seatedSeats(state).length < 2) return fail(state, 'Need at least 2 players');
  if (!humansAllReady(state)) return fail(state, 'All humans must be ready');

  const s = cloneState(state);
  const events: LudoEvent[] = [];
  resetTokens(s);
  s.winnerSeat = null;
  s.consecutiveSixes = 0;
  s.lastDie = null;
  s.legalMoves = [];
  const toAct = firstSeatedSeat(s);
  if (toAct == null) return fail(state, 'Need at least 2 players');
  s.toAct = toAct;
  s.phase = 'rolling';
  for (const seat of s.seats) {
    if (seat.status === 'seated' && !seat.isBot) seat.ready = false;
  }
  bump(s);
  events.push({ type: 'match_started', toAct });
  events.push({ type: 'turn', seat: toAct });
  return { state: s, events, ok: true };
}

export function legalMoves(state: LudoState): number[] {
  if (state.phase !== 'moving' || state.toAct == null || state.lastDie == null) return [];
  return computeLegalMoves(state, state.toAct, state.lastDie);
}

export function roll(state: LudoState, seat: number, dieFn: RollDie = defaultRollDie, seq?: number): RollResult {
  const stale = checkSeq(state, seq);
  if (stale) return { ...fail(state, stale), die: undefined, legalMoves: [], extraTurn: false };
  if (state.phase !== 'rolling') {
    return { ...fail(state, 'Not waiting for a roll'), die: undefined, legalMoves: [], extraTurn: false };
  }
  if (state.toAct !== seat) {
    return { ...fail(state, 'Not your turn'), die: undefined, legalMoves: [], extraTurn: false };
  }

  const die = dieFn();
  if (!Number.isInteger(die) || die < 1 || die > 6) {
    return { ...fail(state, 'Invalid die'), die: undefined, legalMoves: [], extraTurn: false };
  }

  const s = cloneState(state);
  const events: LudoEvent[] = [];
  bump(s);
  s.lastDie = die;

  if (die === 6) s.consecutiveSixes += 1;
  else s.consecutiveSixes = 0;

  if (die === 6 && s.consecutiveSixes >= 3) {
    s.legalMoves = [];
    events.push({ type: 'rolled', seat, die, legalMoves: [], extraTurn: false });
    events.push({ type: 'turn_forfeit', seat, reason: 'three_sixes' });
    passTurn(s, seat, events);
    return { state: s, events, ok: true, die, legalMoves: [], extraTurn: false };
  }

  const moves = computeLegalMoves(s, seat, die);
  s.legalMoves = moves;
  const extraTurnHint = die === 6;
  events.push({ type: 'rolled', seat, die, legalMoves: moves, extraTurn: extraTurnHint && moves.length > 0 });

  if (moves.length === 0) {
    events.push({ type: 'turn_forfeit', seat, reason: 'no_moves' });
    passTurn(s, seat, events);
    return { state: s, events, ok: true, die, legalMoves: [], extraTurn: false };
  }

  s.phase = 'moving';
  return { state: s, events, ok: true, die, legalMoves: moves, extraTurn: extraTurnHint };
}

export function move(state: LudoState, seat: number, tokenIndex: number, seq?: number): MoveResult {
  const stale = checkSeq(state, seq);
  if (stale) return fail(state, stale);
  if (state.phase !== 'moving') return fail(state, 'Not waiting for a move');
  if (state.toAct !== seat) return fail(state, 'Not your turn');
  if (state.lastDie == null) return fail(state, 'No roll to apply');
  if (!state.legalMoves.includes(tokenIndex)) return fail(state, 'Illegal move');

  const die = state.lastDie;
  const s = cloneState(state);
  const events: LudoEvent[] = [];
  const applied = applyTokenMove(s, seat, tokenIndex, die);
  if (!applied) return fail(state, 'Illegal move');

  bump(s);
  events.push({
    type: 'moved',
    seat,
    tokenIndex,
    dest: applied.dest,
    captured: applied.captured,
  });

  const player = s.seats[seat]!;
  if (allTokensHome(player)) {
    s.phase = 'finished';
    s.winnerSeat = seat;
    s.toAct = null;
    s.lastDie = null;
    s.legalMoves = [];
    s.consecutiveSixes = 0;
    events.push({ type: 'match_ended', winnerSeat: seat });
    return {
      state: s,
      events,
      ok: true,
      extraTurn: false,
      captured: applied.captured,
      winnerSeat: seat,
    };
  }

  const rolledSix = s.lastDie === 6;
  if (rolledSix) {
    extraTurn(s, seat, events);
    return {
      state: s,
      events,
      ok: true,
      extraTurn: true,
      captured: applied.captured,
      winnerSeat: null,
    };
  }

  passTurn(s, seat, events);
  return {
    state: s,
    events,
    ok: true,
    extraTurn: false,
    captured: applied.captured,
    winnerSeat: null,
  };
}
