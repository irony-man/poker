export const LUDO_COLORS = ['red', 'green', 'yellow', 'blue'] as const;
export type LudoColor = (typeof LUDO_COLORS)[number];

export const SEAT_COUNT = 4;
export const TOKENS_PER_SEAT = 4;
export const TRACK_LEN = 52;
export const HOME_STRETCH_LEN = 5;
export const DEFAULT_TURN_TIME_MS = 20_000;

/** Last progress value still on the main track (start + 51 steps). */
export const MAIN_MAX_PROGRESS = 51;

/** Progress value that means the token is home. */
export const HOME_PROGRESS = MAIN_MAX_PROGRESS + 1 + HOME_STRETCH_LEN;

/** Main-track start square for each seat, clockwise. */
export const START_SQUARES: readonly number[] = [0, 13, 26, 39];

/** Globally safe main-track squares (color starts + stars). */
export const SAFE_SQUARES: readonly number[] = [0, 8, 13, 21, 26, 34, 39, 47];

export const SAFE_SQUARE_SET: ReadonlySet<number> = new Set(SAFE_SQUARES);

export type MaxSeats = 2 | 3 | 4;

export type MatchPhase = 'lobby' | 'rolling' | 'moving' | 'finished';

export type SeatStatus = 'empty' | 'seated';

export type TokenPos =
  | { kind: 'yard' }
  | { kind: 'main'; index: number }
  | { kind: 'stretch'; index: number }
  | { kind: 'home' };

export interface TokenState {
  index: number;
  pos: TokenPos;
}

export interface SeatState {
  seat: number;
  color: LudoColor;
  userId: string | null;
  name: string | null;
  isBot: boolean;
  ready: boolean;
  status: SeatStatus;
  tokens: TokenState[];
}

export interface LudoConfig {
  maxSeats: MaxSeats;
  turnTimeMs: number;
}

export interface LudoState {
  matchId: string;
  phase: MatchPhase;
  config: LudoConfig;
  seats: SeatState[];
  toAct: number | null;
  lastDie: number | null;
  consecutiveSixes: number;
  legalMoves: number[];
  winnerSeat: number | null;
  actionSeq: number;
  version: number;
}

export type LudoEvent =
  | { type: 'seated'; seat: number; userId: string; name: string; isBot: boolean }
  | { type: 'stood'; seat: number }
  | { type: 'ready'; seat: number; ready: boolean }
  | { type: 'match_started'; toAct: number }
  | {
      type: 'rolled';
      seat: number;
      die: number;
      legalMoves: number[];
      extraTurn: boolean;
    }
  | {
      type: 'moved';
      seat: number;
      tokenIndex: number;
      dest: TokenPos;
      captured: { seat: number; tokenIndex: number }[];
    }
  | { type: 'turn'; seat: number }
  | { type: 'extra_turn'; seat: number }
  | { type: 'turn_forfeit'; seat: number; reason: 'three_sixes' | 'no_moves' }
  | { type: 'match_ended'; winnerSeat: number };

export interface ApplyResult {
  state: LudoState;
  events: LudoEvent[];
  ok: boolean;
  error?: string;
}

export interface RollResult extends ApplyResult {
  die?: number;
  legalMoves?: number[];
  extraTurn?: boolean;
}

export interface MoveResult extends ApplyResult {
  extraTurn?: boolean;
  captured?: { seat: number; tokenIndex: number }[];
  winnerSeat?: number | null;
}

export interface CreateMatchOpts {
  maxSeats: MaxSeats;
  turnTimeMs?: number;
  matchId?: string;
}

export interface SitOpts {
  bot?: boolean;
}

export type RollDie = () => number;
