import { z } from 'zod';

/**
 * Contest play mode:
 * - `rounds`: fixed hand count, equal start stacks, top-ups allowed; chip leader wins.
 * - `chips`: equal start stacks, no top-ups; last player with Wuffies wins.
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
 * Default blind ladder scaled from the contest's starting small/big blinds.
 * Level 0 uses the configured blinds; later levels scale up.
 */
export function buildBlindSchedule(smallBlind: number, bigBlind: number): BlindLevel[] {
  const multipliers = [1, 1.5, 2, 3, 4, 6, 8, 12, 16, 24];
  return multipliers.map((m) => ({
    smallBlind: Math.max(1, Math.round(smallBlind * m)),
    bigBlind: Math.max(2, Math.round(bigBlind * m)),
    durationHands: m <= 2 ? 6 : m <= 6 ? 4 : 3,
  }));
}

export const ContestEntrantSchema = z.object({
  userId: z.string(),
  name: z.string(),
  isBot: z.boolean().optional(),
  registeredAt: z.number(),
});
export type ContestEntrant = z.infer<typeof ContestEntrantSchema>;

export const ContestPlacementSchema = z.object({
  userId: z.string(),
  name: z.string(),
  place: z.number().int().positive(),
  /** House-funded Wuffies awarded for this place (0 if none). */
  prizeWuffies: z.number().int().nonnegative().optional(),
});
export type ContestPlacement = z.infer<typeof ContestPlacementSchema>;

/**
 * Placement bonus in Wuffies (house-funded), independent of residual stack cash-out.
 * Top 3 (or both heads-up players) share a pool of ~10% of buy-in × field size.
 */
export function contestPlacementPrize(
  place: number,
  entrantCount: number,
  startingStack: number,
): number {
  if (place < 1 || entrantCount < 2 || startingStack < 1) return 0;
  const unit = Math.max(50, Math.round(startingStack * 0.1));
  const pool = Math.min(startingStack * entrantCount, unit * entrantCount);
  if (entrantCount === 2) {
    if (place === 1) return Math.round(pool * 0.7);
    if (place === 2) return Math.round(pool * 0.3);
    return 0;
  }
  if (place === 1) return Math.round(pool * 0.5);
  if (place === 2) return Math.round(pool * 0.3);
  if (place === 3) return Math.round(pool * 0.2);
  return 0;
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
   * Max bot seats to fill when starting if human friends leave empty spots.
   * Bots are not seated until the host starts (or the field fills with humans).
   */
  botCount: z.number().int().min(0).max(8).default(0),
  isPrivate: z.boolean().default(true),
  inviteCode: z
    .string()
    .regex(/^\d{4,8}$/, 'Room code must be 4–8 digits')
    .optional(),
  /** Auto-start when field is full. Default true. */
  autoStart: z.boolean().default(true),
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
