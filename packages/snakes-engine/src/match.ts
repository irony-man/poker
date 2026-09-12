import { defaultRollDie } from './rng.js';
import {
  cloneState,
  emptySeat,
  firstSeatedSeat,
  nextSeatedSeat,
  resolveMove,
  seatedSeats,
} from './rules.js';
import {
  DEFAULT_TURN_TIME_MS,
  SEAT_COUNT,
  type ApplyResult,
  type CreateMatchOpts,
  type RollDie,
  type RollResult,
  type SitOpts,
  type SnakesEvent,
  type SnakesState,
} from './types.js';

const BOT_PREFIX = 'bot:';

function fail(state: SnakesState, error: string): ApplyResult {
  return { state, events: [], ok: false, error };
}

function bump(state: SnakesState): void {
  state.version += 1;
  state.actionSeq += 1;
}

function checkSeq(state: SnakesState, seq?: number): string | null {
  if (seq !== undefined && seq !== state.actionSeq) return 'Stale action';
  return null;
}

function inLobbyOrFinished(state: SnakesState): boolean {
  return state.phase === 'lobby' || state.phase === 'finished';
}

function isBotUserId(userId: string, opts?: SitOpts): boolean {
  return !!opts?.bot || userId.startsWith(BOT_PREFIX);
}

function humansAllReady(state: SnakesState): boolean {
  const seated = seatedSeats(state);
  if (seated.length < 2) return false;
  return seated.every((s) => s.isBot || s.ready);
}

export function createMatch(opts: CreateMatchOpts): SnakesState {
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
    lastFrom: null,
    lastTo: null,
    lastTeleport: null,
    winnerSeat: null,
    actionSeq: 0,
    version: 0,
  };
}

export function sit(
  state: SnakesState,
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
  p.position = 0;
  bump(s);
  return {
    state: s,
    events: [{ type: 'seated', seat, userId, name, isBot: bot }],
    ok: true,
  };
}

export function stand(state: SnakesState, seat: number): ApplyResult {
  if (!inLobbyOrFinished(state)) return fail(state, 'Cannot stand during a match');
  const s = cloneState(state);
  const p = s.seats[seat];
  if (!p || p.status === 'empty') return fail(state, 'Empty seat');
  s.seats[seat] = emptySeat(seat);
  bump(s);
  return { state: s, events: [{ type: 'stood', seat }], ok: true };
}

export function setReady(state: SnakesState, seat: number, ready: boolean): ApplyResult {
  if (!inLobbyOrFinished(state)) return fail(state, 'Ready only in lobby');
  const s = cloneState(state);
  const p = s.seats[seat];
  if (!p || p.status !== 'seated') return fail(state, 'Empty seat');
  if (p.isBot) return fail(state, 'Bots are always ready');
  p.ready = ready;
  bump(s);
  return { state: s, events: [{ type: 'ready', seat, ready }], ok: true };
}

export function startMatch(state: SnakesState): ApplyResult {
  if (state.phase !== 'lobby' && state.phase !== 'finished') {
    return fail(state, 'Match already in progress');
  }
  if (seatedSeats(state).length < 2) return fail(state, 'Need at least 2 players');
  if (!humansAllReady(state)) return fail(state, 'All humans must be ready');

  const s = cloneState(state);
  const events: SnakesEvent[] = [];
  for (const seat of s.seats) {
    if (seat.status === 'seated') {
      seat.position = 0;
      if (!seat.isBot) seat.ready = false;
    }
  }
  s.winnerSeat = null;
  s.lastDie = null;
  s.lastFrom = null;
  s.lastTo = null;
  s.lastTeleport = null;
  const toAct = firstSeatedSeat(s);
  if (toAct == null) return fail(state, 'Need at least 2 players');
  s.toAct = toAct;
  s.phase = 'rolling';
  bump(s);
  events.push({ type: 'match_started', toAct });
  events.push({ type: 'turn', seat: toAct });
  return { state: s, events, ok: true };
}

export function roll(
  state: SnakesState,
  seat: number,
  dieFn: RollDie = defaultRollDie,
  seq?: number,
): RollResult {
  const stale = checkSeq(state, seq);
  if (stale) return { ...fail(state, stale), die: undefined };
  if (state.phase !== 'rolling') return { ...fail(state, 'Not waiting for a roll'), die: undefined };
  if (state.toAct !== seat) return { ...fail(state, 'Not your turn'), die: undefined };

  const die = dieFn();
  if (!Number.isInteger(die) || die < 1 || die > 6) {
    return { ...fail(state, 'Invalid die'), die: undefined };
  }

  const s = cloneState(state);
  const events: SnakesEvent[] = [];
  const p = s.seats[seat]!;
  const from = p.position;
  const { to, teleport } = resolveMove(from, die);
  p.position = to;
  s.lastDie = die;
  s.lastFrom = from;
  s.lastTo = to;
  s.lastTeleport = teleport;

  events.push({ type: 'rolled', seat, die, from, to, teleport });

  if (to === 100) {
    s.phase = 'finished';
    s.winnerSeat = seat;
    s.toAct = null;
    bump(s);
    events.push({ type: 'won', seat });
    return { state: s, events, ok: true, die };
  }

  const next = nextSeatedSeat(s, seat);
  s.toAct = next;
  s.phase = 'rolling';
  bump(s);
  events.push({ type: 'turn', seat: next });
  return { state: s, events, ok: true, die };
}
