import type { Card, Suit } from './cards.js';

export const SEAT_COUNT = 4;
export const DEFAULT_TURN_TIME_MS = 20_000;
export const HANDS_TO_WIN = 7;
export const CARDS_PER_HAND = 13;
export const HOKM_PREVIEW = 5;

export type RulesVariant = 'classic' | 'classic_full' | 'hokm';
export type MatchPhase =
  | 'lobby'
  | 'choosing_trump'
  | 'playing'
  | 'between_hands'
  | 'finished';
export type SeatStatus = 'empty' | 'seated';
/** Team 0 = seats 0+2, Team 1 = seats 1+3 */
export type TeamId = 0 | 1;

export interface SeatState {
  seat: number;
  userId: string | null;
  name: string | null;
  isBot: boolean;
  ready: boolean;
  status: SeatStatus;
  hand: Card[];
  tricksThisHand: number;
}

export interface TrickPlay {
  seat: number;
  card: Card;
}

export interface CourtpieceConfig {
  rulesVariant: RulesVariant;
  turnTimeMs: number;
  handsToWin: number;
}

export interface CourtpieceState {
  matchId: string;
  phase: MatchPhase;
  config: CourtpieceConfig;
  seats: SeatState[];
  /** Seat that dealt this hand (classic) / reference for lead. */
  dealer: number;
  /** Hokm only: current hakem seat. */
  hakem: number | null;
  trumpSetter: number | null;
  trump: Suit | null;
  currentTrick: TrickPlay[];
  trickLeader: number | null;
  toAct: number | null;
  /** Hands won by team 0 and team 1. */
  teamHands: [number, number];
  handNumber: number;
  /** Winning team when finished. */
  winnerTeam: TeamId | null;
  /** Remaining undealt cards (hokm after 5-card preview). */
  undealt: Card[];
  actionSeq: number;
  version: number;
}

export type CourtpieceEvent =
  | { type: 'seated'; seat: number; userId: string; name: string; isBot: boolean }
  | { type: 'stood'; seat: number }
  | { type: 'ready'; seat: number; ready: boolean }
  | { type: 'match_started'; handNumber: number }
  | { type: 'hand_started'; handNumber: number; dealer: number; hakem: number | null }
  | { type: 'trump_set'; suit: Suit; bySeat: number }
  | { type: 'turn'; seat: number }
  | { type: 'card_played'; seat: number; card: Card }
  | { type: 'trick_won'; seat: number; team: TeamId }
  | {
      type: 'hand_scored';
      winningTeam: TeamId;
      handsAwarded: number;
      tricks: [number, number];
    }
  | { type: 'won'; team: TeamId };

export interface ApplyResult {
  state: CourtpieceState;
  events: CourtpieceEvent[];
  ok: boolean;
  error?: string;
}

export interface CreateMatchOpts {
  matchId?: string;
  rulesVariant: RulesVariant;
  turnTimeMs?: number;
  handsToWin?: number;
  shuffle?: <T>(arr: T[]) => T[];
}

export interface SitOpts {
  bot?: boolean;
}
