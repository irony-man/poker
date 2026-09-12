export const SEAT_COUNT = 4;
export const BOARD_END = 100;
export const DEFAULT_TURN_TIME_MS = 20_000;

/** Classic snakes & ladders teleports: from → to. */
export const TELEPORTS: Readonly<Record<number, number>> = {
  // ladders
  4: 14,
  9: 31,
  20: 38,
  28: 84,
  40: 59,
  51: 67,
  63: 81,
  71: 91,
  // snakes
  17: 7,
  54: 34,
  62: 19,
  64: 60,
  87: 24,
  93: 73,
  95: 75,
  99: 78,
};

export type MaxSeats = 2 | 3 | 4;
export type MatchPhase = 'lobby' | 'rolling' | 'finished';
export type SeatStatus = 'empty' | 'seated';

export interface SeatState {
  seat: number;
  userId: string | null;
  name: string | null;
  isBot: boolean;
  ready: boolean;
  status: SeatStatus;
  /** Position 0 = start (off board); 1–100 on track. */
  position: number;
}

export interface SnakesConfig {
  maxSeats: MaxSeats;
  turnTimeMs: number;
}

export interface SnakesState {
  matchId: string;
  phase: MatchPhase;
  config: SnakesConfig;
  seats: SeatState[];
  toAct: number | null;
  lastDie: number | null;
  lastFrom: number | null;
  lastTo: number | null;
  lastTeleport: number | null;
  winnerSeat: number | null;
  actionSeq: number;
  version: number;
}

export type SnakesEvent =
  | { type: 'seated'; seat: number; userId: string; name: string; isBot: boolean }
  | { type: 'stood'; seat: number }
  | { type: 'ready'; seat: number; ready: boolean }
  | { type: 'match_started'; toAct: number }
  | { type: 'turn'; seat: number }
  | {
      type: 'rolled';
      seat: number;
      die: number;
      from: number;
      to: number;
      teleport: number | null;
    }
  | { type: 'won'; seat: number };

export interface ApplyResult {
  state: SnakesState;
  events: SnakesEvent[];
  ok: boolean;
  error?: string;
}

export interface RollResult extends ApplyResult {
  die?: number;
}

export interface CreateMatchOpts {
  matchId?: string;
  maxSeats: MaxSeats;
  turnTimeMs?: number;
}

export interface SitOpts {
  bot?: boolean;
}

export type RollDie = () => number;
