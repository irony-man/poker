import type { LudoState, SeatState, TokenPos } from './types.js';

export interface PublicSeatView {
  seat: number;
  color: SeatState['color'];
  userId: string | null;
  name: string | null;
  isBot: boolean;
  ready: boolean;
  status: SeatState['status'];
  tokens: TokenPos[];
}

export interface PublicLudoView {
  matchId: string;
  phase: LudoState['phase'];
  seats: PublicSeatView[];
  toAct: number | null;
  lastDie: number | null;
  consecutiveSixes: number;
  legalMoves: number[];
  winnerSeat: number | null;
  actionSeq: number;
  version: number;
  turnTimeMs: number;
  maxSeats: LudoState['config']['maxSeats'];
}

/** Ludo has no hidden information — the public view is the full board. */
export function toPublicView(state: LudoState): PublicLudoView {
  return {
    matchId: state.matchId,
    phase: state.phase,
    seats: state.seats.map((s) => ({
      seat: s.seat,
      color: s.color,
      userId: s.userId,
      name: s.name,
      isBot: s.isBot,
      ready: s.ready,
      status: s.status,
      tokens: s.tokens.map((t) => ({ ...t.pos })),
    })),
    toAct: state.toAct,
    lastDie: state.lastDie,
    consecutiveSixes: state.consecutiveSixes,
    legalMoves: [...state.legalMoves],
    winnerSeat: state.winnerSeat,
    actionSeq: state.actionSeq,
    version: state.version,
    turnTimeMs: state.config.turnTimeMs,
    maxSeats: state.config.maxSeats,
  };
}
