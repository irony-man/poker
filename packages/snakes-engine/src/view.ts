import type { SnakesState } from './types.js';

export interface PublicSeatView {
  seat: number;
  userId: string | null;
  name: string | null;
  isBot: boolean;
  ready: boolean;
  status: SnakesState['seats'][number]['status'];
  position: number;
}

export interface PublicSnakesView {
  matchId: string;
  phase: SnakesState['phase'];
  seats: PublicSeatView[];
  toAct: number | null;
  lastDie: number | null;
  lastFrom: number | null;
  lastTo: number | null;
  lastTeleport: number | null;
  winnerSeat: number | null;
  actionSeq: number;
  version: number;
  turnTimeMs: number;
  maxSeats: SnakesState['config']['maxSeats'];
}

export function toPublicView(state: SnakesState): PublicSnakesView {
  return {
    matchId: state.matchId,
    phase: state.phase,
    seats: state.seats.map((s) => ({
      seat: s.seat,
      userId: s.userId,
      name: s.name,
      isBot: s.isBot,
      ready: s.ready,
      status: s.status,
      position: s.position,
    })),
    toAct: state.toAct,
    lastDie: state.lastDie,
    lastFrom: state.lastFrom,
    lastTo: state.lastTo,
    lastTeleport: state.lastTeleport,
    winnerSeat: state.winnerSeat,
    actionSeq: state.actionSeq,
    version: state.version,
    turnTimeMs: state.config.turnTimeMs,
    maxSeats: state.config.maxSeats,
  };
}
