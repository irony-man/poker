import { z } from 'zod';

/**
 * Contest play mode (table chips only — no wallet buy-in or payout):
 * - `rounds`: fixed hand count, equal start stacks, top-ups allowed; chip leader wins.
 * - `chips`: knockout freezeout — equal start stacks, no top-ups; last player with chips wins.
 */
export const ContestModeSchema = z.enum(['rounds', 'chips']);
export type ContestMode = z.infer<typeof ContestModeSchema>;

export const ContestStatusSchema = z.enum([
  'registering',
  'running',
  'completed',
  'cancelled',
]);
export type ContestStatus = z.infer<typeof ContestStatusSchema>;

/** Blind level schedule entry (advanced between hands only). */
export interface BlindLevel {
  smallBlind: number;
  bigBlind: number;
  /** Hands at this level before advancing (minimum 1). */
  durationHands: number;
}

/**
 * Contest blind schedule: a single level, so the configured blinds stay fixed for the whole contest.
 */
export function buildBlindSchedule(smallBlind: number, bigBlind: number): BlindLevel[] {
  return [{ smallBlind, bigBlind, durationHands: 1 }];
}

export const ContestEntrantSchema = z.object({
  userId: z.string(),
  name: z.string(),
  isBot: z.boolean().optional(),
  registeredAt: z.number(),
});
export type ContestEntrant = z.infer<typeof ContestEntrantSchema>;

/** Friend who was invited but has not registered yet. */
export const ContestPendingInviteSchema = z.object({
  userId: z.string(),
  name: z.string(),
  invitedAt: z.number(),
});
export type ContestPendingInvite = z.infer<typeof ContestPendingInviteSchema>;

export const ContestPlacementSchema = z.object({
  userId: z.string(),
  name: z.string(),
  place: z.number().int().positive(),
  /** Whuffies (rating) awarded for finishing this contest (0 if none). */
  prizeWhuffies: z.number().int().nonnegative().optional(),
});
export type ContestPlacement = z.infer<typeof ContestPlacementSchema>;

/**
 * Whuffies every player earns when a contest completes, regardless of place.
 * Contests never pay chips: stacks are table-only and cancelled contests award nothing.
 */
export const CONTEST_COMPLETION_WHUFFIES = 1;

/** One finished hand in a contest, for the contest page's hand list. */
export interface ContestHandSummary {
  id: string;
  /** 1-based, in play order across the contest. */
  handNumber: number;
  startedAt: number | null;
  endedAt: number | null;
  winners: { name: string; amount: number; handName: string | null }[];
  /** Public- or owner-redacted hand payload (hole cards only when revealed / viewer). */
  resultJson?: string | Record<string, unknown>;
}

export const ContestBlindInfoSchema = z.object({
  levelIndex: z.number().int().nonnegative(),
  smallBlind: z.number().int().positive(),
  bigBlind: z.number().int().positive(),
  handsAtLevel: z.number().int().nonnegative(),
  handsUntilNext: z.number().int().nonnegative(),
});
export type ContestBlindInfo = z.infer<typeof ContestBlindInfoSchema>;

export const ContestPlayerAssignmentSchema = z.object({
  userId: z.string(),
  tableId: z.string().nullable(),
  matchId: z.string().nullable(),
  eliminated: z.boolean(),
  place: z.number().int().positive().nullable(),
});
export type ContestPlayerAssignment = z.infer<typeof ContestPlayerAssignmentSchema>;

export const ContestViewSchema = z.object({
  id: z.string(),
  inviteCode: z.string(),
  name: z.string(),
  mode: ContestModeSchema,
  status: ContestStatusSchema,
  hostUserId: z.string(),
  fieldSize: z.number().int().positive(),
  startingStack: z.number().int().positive(),
  smallBlind: z.number().int().positive(),
  bigBlind: z.number().int().positive(),
  turnTimeMs: z.number().int().positive(),
  isPrivate: z.boolean(),
  entrants: z.array(ContestEntrantSchema),
  /** Invited friends who have not registered yet (cleared when they join). */
  pendingInvites: z.array(ContestPendingInviteSchema).default([]),
  placements: z.array(ContestPlacementSchema),
  /** Active contest table, or null before start. */
  tableId: z.string().nullable(),
  blinds: ContestBlindInfoSchema.nullable(),
  /** Hands completed so far (both modes). */
  handsPlayed: z.number().int().nonnegative(),
  /** Fixed hand budget for rounds mode; null for chips. */
  handLimit: z.number().int().positive().nullable(),
  assignments: z.array(ContestPlayerAssignmentSchema),
  createdAt: z.number(),
  startedAt: z.number().nullable(),
  completedAt: z.number().nullable(),
});
export type ContestView = z.infer<typeof ContestViewSchema>;

export const CreateContestBodySchema = z.object({
  name: z.string().min(1).max(64).default('Contest'),
  mode: ContestModeSchema,
  /** Table max seats: 2–9. */
  fieldSize: z.number().int().min(2).max(9),
  startingStack: z.number().int().positive().default(1000),
  smallBlind: z.number().int().positive().default(5),
  bigBlind: z.number().int().positive().default(10),
  turnTimeMs: z.number().int().positive().default(20000),
  /**
   * Deprecated — contests are humans-only. Accepted for API compatibility; server ignores it.
   */
  botCount: z.number().int().min(0).max(8).default(0),
  isPrivate: z.boolean().default(true),
  inviteCode: z
    .string()
    .regex(/^\d{4,8}$/, 'Room code must be 4–8 digits')
    .optional(),
  /** Auto-start when field is full. Default false — host starts manually. */
  autoStart: z.boolean().default(false),
  /**
   * Hands to play in rounds mode (ignored for chips).
   * Defaults to 20 when mode is rounds.
   */
  handLimit: z.number().int().min(5).max(100).optional(),
  /** Friends to receive a contest invite when created. */
  inviteFriendIds: z.array(z.string().min(1).max(128)).max(8).default([]),
});
export type CreateContestBody = z.infer<typeof CreateContestBodySchema>;

export const DEFAULT_ROUNDS_HAND_LIMIT = 20;

export function validateContestFieldSize(_mode: ContestMode, fieldSize: number): string | null {
  if (fieldSize < 2 || fieldSize > 9) {
    return 'Contest field size must be 2–9';
  }
  return null;
}

export function resolveHandLimit(mode: ContestMode, handLimit?: number): number | null {
  if (mode !== 'rounds') return null;
  return handLimit ?? DEFAULT_ROUNDS_HAND_LIMIT;
}
