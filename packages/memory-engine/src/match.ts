import {
  allMatched,
  buildDeck,
  cloneState,
  emptySeat,
  firstSeatedSeat,
  nextSeatedSeat,
  seatedSeats,
  winnersByPairs,
} from './rules.js';
import {
  DEFAULT_TURN_TIME_MS,
  SEAT_COUNT,
  type ApplyResult,
  type CreateMatchOpts,
  type MemoryEvent,
  type MemoryState,
  type SitOpts,
} from './types.js';

const BOT_PREFIX = 'bot:';

function fail(state: MemoryState, error: string): ApplyResult {
  return { state, events: [], ok: false, error };
}

function bump(state: MemoryState): void {
  state.version += 1;
  state.actionSeq += 1;
}

function checkSeq(state: MemoryState, seq?: number): string | null {
  if (seq !== undefined && seq !== state.actionSeq) return 'Stale action';
  return null;
}

function inLobbyOrFinished(state: MemoryState): boolean {
  return state.phase === 'lobby' || state.phase === 'finished';
}

function isBotUserId(userId: string, opts?: SitOpts): boolean {
  return !!opts?.bot || userId.startsWith(BOT_PREFIX);
}

function humansAllReady(state: MemoryState): boolean {
  const seated = seatedSeats(state);
  if (seated.length < 2) return false;
  return seated.every((s) => s.isBot || s.ready);
}

export function createMatch(opts: CreateMatchOpts): MemoryState {
  const { maxSeats } = opts;
  if (maxSeats !== 2 && maxSeats !== 3 && maxSeats !== 4) {
    throw new Error('maxSeats must be 2, 3, or 4');
  }
  const gridSize = opts.gridSize ?? 16;
  if (gridSize !== 16 && gridSize !== 36) {
    throw new Error('gridSize must be 16 or 36');
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
    config: { maxSeats, turnTimeMs, gridSize },
    seats,
    cards: [],
    faceUp: [],
    toAct: null,
    winnerSeats: [],
    actionSeq: 0,
    version: 0,
  };
}

export function sit(
  state: MemoryState,
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
  p.pairs = 0;
  bump(s);
  return {
    state: s,
    events: [{ type: 'seated', seat, userId, name, isBot: bot }],
    ok: true,
  };
}

export function stand(state: MemoryState, seat: number): ApplyResult {
  if (!inLobbyOrFinished(state)) return fail(state, 'Cannot stand during a match');
  const s = cloneState(state);
  const p = s.seats[seat];
  if (!p || p.status === 'empty') return fail(state, 'Empty seat');
  s.seats[seat] = emptySeat(seat);
  bump(s);
  return { state: s, events: [{ type: 'stood', seat }], ok: true };
}

export function setReady(state: MemoryState, seat: number, ready: boolean): ApplyResult {
  if (!inLobbyOrFinished(state)) return fail(state, 'Ready only in lobby');
  const s = cloneState(state);
  const p = s.seats[seat];
  if (!p || p.status !== 'seated') return fail(state, 'Empty seat');
  if (p.isBot) return fail(state, 'Bots are always ready');
  p.ready = ready;
  bump(s);
  return { state: s, events: [{ type: 'ready', seat, ready }], ok: true };
}

export function startMatch(state: MemoryState, opts?: { shuffle?: CreateMatchOpts['shuffle'] }): ApplyResult {
  if (state.phase !== 'lobby' && state.phase !== 'finished') {
    return fail(state, 'Match already in progress');
  }
  if (seatedSeats(state).length < 2) return fail(state, 'Need at least 2 players');
  if (!humansAllReady(state)) return fail(state, 'All humans must be ready');

  const s = cloneState(state);
  const events: MemoryEvent[] = [];
  for (const seat of s.seats) {
    if (seat.status === 'seated') {
      seat.pairs = 0;
      if (!seat.isBot) seat.ready = false;
    }
  }
  s.cards = buildDeck(s.config.gridSize, opts?.shuffle);
  s.faceUp = [];
  s.winnerSeats = [];
  const toAct = firstSeatedSeat(s);
  if (toAct == null) return fail(state, 'Need at least 2 players');
  s.toAct = toAct;
  s.phase = 'playing';
  bump(s);
  events.push({ type: 'match_started', toAct });
  events.push({ type: 'turn', seat: toAct });
  return { state: s, events, ok: true };
}

/**
 * Flip a face-down unmatched card. After two flips, either match (keep turn)
 * or enter resolving (caller should call resolveMiss after a short delay).
 */
export function flip(state: MemoryState, seat: number, index: number, seq?: number): ApplyResult {
  const stale = checkSeq(state, seq);
  if (stale) return fail(state, stale);
  if (state.phase !== 'playing') return fail(state, 'Not accepting flips');
  if (state.toAct !== seat) return fail(state, 'Not your turn');
  if (state.faceUp.length >= 2) return fail(state, 'Resolve the current pair first');

  const card = state.cards[index];
  if (!card) return fail(state, 'Invalid card');
  if (card.matched) return fail(state, 'Already matched');
  if (state.faceUp.includes(index)) return fail(state, 'Already face up');

  const s = cloneState(state);
  const events: MemoryEvent[] = [];
  s.faceUp.push(index);
  events.push({ type: 'flipped', seat, index, pairId: card.pairId });

  if (s.faceUp.length < 2) {
    bump(s);
    return { state: s, events, ok: true };
  }

  const [a, b] = s.faceUp as [number, number];
  const ca = s.cards[a]!;
  const cb = s.cards[b]!;
  if (ca.pairId === cb.pairId) {
    ca.matched = true;
    cb.matched = true;
    s.faceUp = [];
    s.seats[seat]!.pairs += 1;
    events.push({ type: 'matched', seat, a, b, pairId: ca.pairId });
    if (allMatched(s)) {
      s.phase = 'finished';
      s.winnerSeats = winnersByPairs(s);
      s.toAct = null;
      bump(s);
      events.push({ type: 'won', seats: s.winnerSeats });
      return { state: s, events, ok: true };
    }
    // Same player continues
    bump(s);
    return { state: s, events, ok: true };
  }

  s.phase = 'resolving';
  bump(s);
  events.push({ type: 'missed', seat, a, b });
  return { state: s, events, ok: true };
}

/** Clear a miss and pass the turn. */
export function resolveMiss(state: MemoryState): ApplyResult {
  if (state.phase !== 'resolving') return fail(state, 'Nothing to resolve');
  if (state.faceUp.length !== 2) return fail(state, 'Nothing to resolve');
  const s = cloneState(state);
  const events: MemoryEvent[] = [];
  const from = s.toAct!;
  s.faceUp = [];
  const next = nextSeatedSeat(s, from);
  s.toAct = next;
  s.phase = 'playing';
  bump(s);
  events.push({ type: 'turn', seat: next });
  return { state: s, events, ok: true };
}
