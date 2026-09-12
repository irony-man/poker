export const SEAT_COUNT = 4;
export const DEFAULT_TURN_TIME_MS = 20_000;

export type GridSize = 16 | 36; // 4x4 or 6x6
export type MaxSeats = 2 | 3 | 4;
export type MatchPhase = 'lobby' | 'playing' | 'resolving' | 'finished';
export type SeatStatus = 'empty' | 'seated';

export interface SeatState {
  seat: number;
  userId: string | null;
  name: string | null;
  isBot: boolean;
  ready: boolean;
  status: SeatStatus;
  pairs: number;
}

export interface CardState {
  /** Pair id 0..n-1; two cards share the same id. */
  pairId: number;
  matched: boolean;
}

export interface MemoryConfig {
  maxSeats: MaxSeats;
  turnTimeMs: number;
  gridSize: GridSize;
}

export interface MemoryState {
  matchId: string;
  phase: MatchPhase;
  config: MemoryConfig;
  seats: SeatState[];
  cards: CardState[];
  /** Face-up indices this turn (0 or 1 before resolve; cleared after). */
  faceUp: number[];
  toAct: number | null;
  /** Winner seats (ties allowed). */
  winnerSeats: number[];
  actionSeq: number;
  version: number;
}

export type MemoryEvent =
  | { type: 'seated'; seat: number; userId: string; name: string; isBot: boolean }
  | { type: 'stood'; seat: number }
  | { type: 'ready'; seat: number; ready: boolean }
  | { type: 'match_started'; toAct: number }
  | { type: 'turn'; seat: number }
  | { type: 'flipped'; seat: number; index: number; pairId: number }
  | { type: 'matched'; seat: number; a: number; b: number; pairId: number }
  | { type: 'missed'; seat: number; a: number; b: number }
  | { type: 'won'; seats: number[] };

export interface ApplyResult {
  state: MemoryState;
  events: MemoryEvent[];
  ok: boolean;
  error?: string;
}

export interface CreateMatchOpts {
  matchId?: string;
  maxSeats: MaxSeats;
  turnTimeMs?: number;
  gridSize?: GridSize;
  /** Injected shuffle for tests. */
  shuffle?: <T>(arr: T[]) => T[];
}

export interface SitOpts {
  bot?: boolean;
}
