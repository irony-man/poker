import {
  HOME_PROGRESS,
  HOME_STRETCH_LEN,
  LUDO_COLORS,
  MAIN_MAX_PROGRESS,
  SAFE_SQUARE_SET,
  SEAT_COUNT,
  START_SQUARES,
  TOKENS_PER_SEAT,
  TRACK_LEN,
  type LudoColor,
  type LudoState,
  type SeatState,
  type TokenPos,
  type TokenState,
} from './types.js';

export function colorForSeat(seat: number): LudoColor {
  return LUDO_COLORS[seat]!;
}

export function isSafeSquare(index: number): boolean {
  return SAFE_SQUARE_SET.has(index);
}

export function emptyTokens(): TokenState[] {
  const tokens: TokenState[] = [];
  for (let i = 0; i < TOKENS_PER_SEAT; i++) {
    tokens.push({ index: i, pos: { kind: 'yard' } });
  }
  return tokens;
}

export function emptySeat(seat: number): SeatState {
  return {
    seat,
    color: colorForSeat(seat),
    userId: null,
    name: null,
    isBot: false,
    ready: false,
    status: 'empty',
    tokens: emptyTokens(),
  };
}

export function clonePos(pos: TokenPos): TokenPos {
  if (pos.kind === 'main') return { kind: 'main', index: pos.index };
  if (pos.kind === 'stretch') return { kind: 'stretch', index: pos.index };
  return { kind: pos.kind };
}

export function cloneState(state: LudoState): LudoState {
  return {
    ...state,
    config: { ...state.config },
    legalMoves: [...state.legalMoves],
    seats: state.seats.map((seat) => ({
      ...seat,
      tokens: seat.tokens.map((t) => ({ index: t.index, pos: clonePos(t.pos) })),
    })),
  };
}

export function seatedSeats(state: LudoState): SeatState[] {
  return state.seats.filter((s) => s.status === 'seated' && s.userId);
}

export function nextSeatedSeat(state: LudoState, from: number): number {
  for (let i = 1; i <= SEAT_COUNT; i++) {
    const seat = (from + i) % SEAT_COUNT;
    const s = state.seats[seat];
    if (s && s.status === 'seated' && s.userId) return seat;
  }
  return from;
}

export function firstSeatedSeat(state: LudoState): number | null {
  for (const s of state.seats) {
    if (s.status === 'seated' && s.userId) return s.seat;
  }
  return null;
}

/** Steps from this color's start toward home. Yard is -1; home is HOME_PROGRESS. */
export function tokenProgress(seat: number, pos: TokenPos): number {
  switch (pos.kind) {
    case 'yard':
      return -1;
    case 'main':
      return (pos.index - START_SQUARES[seat]! + TRACK_LEN) % TRACK_LEN;
    case 'stretch':
      return MAIN_MAX_PROGRESS + 1 + pos.index;
    case 'home':
      return HOME_PROGRESS;
  }
}

export function posFromProgress(seat: number, progress: number): TokenPos {
  if (progress < 0) return { kind: 'yard' };
  if (progress <= MAIN_MAX_PROGRESS) {
    return { kind: 'main', index: (START_SQUARES[seat]! + progress) % TRACK_LEN };
  }
  const stretch = progress - (MAIN_MAX_PROGRESS + 1);
  if (stretch < HOME_STRETCH_LEN) return { kind: 'stretch', index: stretch };
  return { kind: 'home' };
}

export function allTokensHome(seat: SeatState): boolean {
  return seat.tokens.length === TOKENS_PER_SEAT && seat.tokens.every((t) => t.pos.kind === 'home');
}

function tokensOnMainSquare(
  state: LudoState,
  square: number,
): { seat: number; tokenIndex: number }[] {
  const out: { seat: number; tokenIndex: number }[] = [];
  for (const seat of state.seats) {
    if (seat.status === 'empty') continue;
    for (const t of seat.tokens) {
      if (t.pos.kind === 'main' && t.pos.index === square) {
        out.push({ seat: seat.seat, tokenIndex: t.index });
      }
    }
  }
  return out;
}

/** Opponent 2+ stack on a non-safe square blocks landing. */
export function isLandingBlocked(state: LudoState, moverSeat: number, square: number): boolean {
  if (isSafeSquare(square)) return false;
  const counts = new Map<number, number>();
  for (const occ of tokensOnMainSquare(state, square)) {
    if (occ.seat === moverSeat) continue;
    counts.set(occ.seat, (counts.get(occ.seat) ?? 0) + 1);
  }
  for (const n of counts.values()) {
    if (n >= 2) return true;
  }
  return false;
}

export interface MovePreview {
  dest: TokenPos;
  captures: { seat: number; tokenIndex: number }[];
  entersHome: boolean;
  leavesYard: boolean;
  progress: number;
}

export function previewMove(
  state: LudoState,
  seat: number,
  tokenIndex: number,
  die: number,
): MovePreview | null {
  const player = state.seats[seat];
  const token = player?.tokens[tokenIndex];
  if (!player || !token) return null;

  let dest: TokenPos;
  let leavesYard = false;
  if (token.pos.kind === 'home') return null;
  if (token.pos.kind === 'yard') {
    if (die !== 6) return null;
    dest = { kind: 'main', index: START_SQUARES[seat]! };
    leavesYard = true;
  } else {
    const next = tokenProgress(seat, token.pos) + die;
    if (next > HOME_PROGRESS) return null;
    dest = posFromProgress(seat, next);
  }

  if (dest.kind === 'main' && isLandingBlocked(state, seat, dest.index)) return null;

  const captures: { seat: number; tokenIndex: number }[] = [];
  if (dest.kind === 'main' && !isSafeSquare(dest.index)) {
    const occupants = tokensOnMainSquare(state, dest.index);
    const bySeat = new Map<number, number[]>();
    for (const occ of occupants) {
      if (occ.seat === seat) continue;
      const list = bySeat.get(occ.seat) ?? [];
      list.push(occ.tokenIndex);
      bySeat.set(occ.seat, list);
    }
    for (const [otherSeat, idxs] of bySeat) {
      if (idxs.length === 1) {
        captures.push({ seat: otherSeat, tokenIndex: idxs[0]! });
      }
    }
  }

  return {
    dest,
    captures,
    entersHome: dest.kind === 'home',
    leavesYard,
    progress: tokenProgress(seat, token.pos),
  };
}

export function computeLegalMoves(state: LudoState, seat: number, die: number): number[] {
  const player = state.seats[seat];
  if (!player || player.status !== 'seated') return [];
  const moves: number[] = [];
  for (const t of player.tokens) {
    if (previewMove(state, seat, t.index, die)) moves.push(t.index);
  }
  return moves;
}

export function applyTokenMove(
  state: LudoState,
  seat: number,
  tokenIndex: number,
  die: number,
): { dest: TokenPos; captured: { seat: number; tokenIndex: number }[] } | null {
  const preview = previewMove(state, seat, tokenIndex, die);
  if (!preview) return null;
  const token = state.seats[seat]!.tokens[tokenIndex]!;
  token.pos = clonePos(preview.dest);
  for (const cap of preview.captures) {
    const other = state.seats[cap.seat]?.tokens[cap.tokenIndex];
    if (other) other.pos = { kind: 'yard' };
  }
  return { dest: clonePos(preview.dest), captured: preview.captures };
}
