import { z } from 'zod';

/** Contest play mode. */
export const ContestModeSchema = z.enum(['knockout', 'table_match']);
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
});
export type ContestPlacement = z.infer<typeof ContestPlacementSchema>;

export const KnockoutMatchSchema = z.object({
  id: z.string(),
  round: z.number().int().nonnegative(),
  index: z.number().int().nonnegative(),
  playerA: z.string().nullable(),
  playerB: z.string().nullable(),
  winnerId: z.string().nullable(),
  tableId: z.string().nullable(),
  status: z.enum(['pending', 'active', 'completed']),
});
export type KnockoutMatch = z.infer<typeof KnockoutMatchSchema>;

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
  /** Knockout bracket matches (empty for table_match). */
  matches: z.array(KnockoutMatchSchema),
  /** Active table for table_match, or null. */
  tableId: z.string().nullable(),
  blinds: ContestBlindInfoSchema.nullable(),
  assignments: z.array(ContestPlayerAssignmentSchema),
  createdAt: z.number(),
  startedAt: z.number().nullable(),
  completedAt: z.number().nullable(),
});
export type ContestView = z.infer<typeof ContestViewSchema>;

export const CreateContestBodySchema = z.object({
  name: z.string().min(1).max(64).default('Contest'),
  mode: ContestModeSchema,
  /** Knockout: 4 | 8 | 16. Table match: 2–9. */
  fieldSize: z.number().int().min(2).max(16),
  startingStack: z.number().int().positive().default(1000),
  smallBlind: z.number().int().positive().default(5),
  bigBlind: z.number().int().positive().default(10),
  turnTimeMs: z.number().int().positive().default(20000),
  /** Pre-seat bot entrants when created (register fill at start too). */
  botCount: z.number().int().min(0).max(15).default(0),
  isPrivate: z.boolean().default(true),
  inviteCode: z
    .string()
    .regex(/^\d{4,8}$/, 'Room code must be 4–8 digits')
    .optional(),
  /** Auto-start when field is full. Default true. */
  autoStart: z.boolean().default(true),
});
export type CreateContestBody = z.infer<typeof CreateContestBodySchema>;

export function validateContestFieldSize(mode: ContestMode, fieldSize: number): string | null {
  if (mode === 'knockout') {
    if (![4, 8, 16].includes(fieldSize)) {
      return 'Knockout field size must be 4, 8, or 16';
    }
  } else if (fieldSize < 2 || fieldSize > 9) {
    return 'Table match field size must be 2–9';
  }
  return null;
}
