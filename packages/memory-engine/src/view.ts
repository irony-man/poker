import type { MemoryState } from './types.js';

export interface PublicCardView {
  index: number;
  /** Visible pair id when face-up or matched; null when face-down. */
  pairId: number | null;
  matched: boolean;
  faceUp: boolean;
}

export interface PublicSeatView {
  seat: number;
  userId: string | null;
  name: string | null;
  isBot: boolean;
  ready: boolean;
  status: MemoryState['seats'][number]['status'];
  pairs: number;
}

export interface PublicMemoryView {
  matchId: string;
  phase: MemoryState['phase'];
  seats: PublicSeatView[];
  cards: PublicCardView[];
  faceUp: number[];
  toAct: number | null;
  winnerSeats: number[];
  actionSeq: number;
  version: number;
  turnTimeMs: number;
  maxSeats: MemoryState['config']['maxSeats'];
  gridSize: MemoryState['config']['gridSize'];
}

export function toPublicView(state: MemoryState): PublicMemoryView {
  const faceUpSet = new Set(state.faceUp);
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
      pairs: s.pairs,
    })),
    cards: state.cards.map((c, index) => {
      const faceUp = faceUpSet.has(index);
      const show = c.matched || faceUp;
      return {
        index,
        pairId: show ? c.pairId : null,
        matched: c.matched,
        faceUp,
      };
    }),
    faceUp: [...state.faceUp],
    toAct: state.toAct,
    winnerSeats: [...state.winnerSeats],
    actionSeq: state.actionSeq,
    version: state.version,
    turnTimeMs: state.config.turnTimeMs,
    maxSeats: state.config.maxSeats,
    gridSize: state.config.gridSize,
  };
}
