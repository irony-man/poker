import { z } from 'zod';

export const CourtpieceSeatSchema = z.number().int().min(0).max(3);
export const CourtpieceMatchStatusSchema = z.enum(['waiting', 'playing', 'finished']);
export const CourtpieceRulesVariantSchema = z.enum(['classic', 'classic_full', 'hokm']);
export const CourtpieceSuitSchema = z.enum(['c', 'd', 'h', 's']);
export const CourtpiecePhaseSchema = z.enum([
  'lobby',
  'choosing_trump',
  'playing',
  'between_hands',
  'finished',
]);
export const CourtpieceCardSchema = z
  .string()
  .regex(/^[2-9TJQKA][cdhs]$/i, 'Invalid card');

export const CourtpiecePlayerViewSchema = z.object({
  seat: CourtpieceSeatSchema,
  userId: z.string().nullable(),
  name: z.string().nullable(),
  isBot: z.boolean().optional(),
  ready: z.boolean(),
  connected: z.boolean().optional(),
  avatarId: z.number().int().optional(),
  avatarUrl: z.string().url().nullable().optional(),
  cardCount: z.number().int().nonnegative(),
  tricksThisHand: z.number().int().nonnegative(),
  team: z.union([z.literal(0), z.literal(1)]),
});

export const CourtpieceTrickPlaySchema = z.object({
  seat: CourtpieceSeatSchema,
  card: CourtpieceCardSchema,
});

export const CourtpiecePublicViewSchema = z.object({
  id: z.string(),
  inviteCode: z.string(),
  name: z.string(),
  hostUserId: z.string(),
  maxSeats: z.literal(4),
  rulesVariant: CourtpieceRulesVariantSchema,
  status: CourtpieceMatchStatusSchema,
  phase: CourtpiecePhaseSchema,
  seats: z.array(CourtpiecePlayerViewSchema).max(4),
  dealer: CourtpieceSeatSchema,
  hakem: CourtpieceSeatSchema.nullable(),
  trumpSetter: CourtpieceSeatSchema.nullable(),
  trump: CourtpieceSuitSchema.nullable(),
  currentTrick: z.array(CourtpieceTrickPlaySchema).max(4),
  trickLeader: CourtpieceSeatSchema.nullable(),
  toAct: CourtpieceSeatSchema.nullable(),
  teamHands: z.tuple([z.number().int().nonnegative(), z.number().int().nonnegative()]),
  handsToWin: z.number().int().positive(),
  handNumber: z.number().int().nonnegative(),
  winnerTeam: z.union([z.literal(0), z.literal(1)]).nullable().optional(),
  seq: z.number().int().nonnegative(),
  turnEndsAt: z.number().nullable().optional(),
  turnTimeMs: z.number().int().positive().optional(),
  createdAt: z.number(),
});

export const CourtpieceYouSchema = z.object({
  seat: CourtpieceSeatSchema.nullable(),
  hand: z.array(CourtpieceCardSchema).optional(),
  legal: z.array(CourtpieceCardSchema).optional(),
  partnerSeat: CourtpieceSeatSchema.optional(),
  team: z.union([z.literal(0), z.literal(1)]).optional(),
});

export const CreateCourtpieceBodySchema = z.object({
  name: z.string().min(1).max(64).default('Court Piece'),
  rulesVariant: CourtpieceRulesVariantSchema.default('classic'),
  botCount: z.number().int().min(0).max(3).default(0),
  inviteCode: z
    .string()
    .regex(/^\d{4,8}$/, 'Room code must be 4–8 digits')
    .optional(),
  inviteFriendIds: z.array(z.string().min(1).max(128)).max(8).default([]),
});

export type CourtpieceSeat = z.infer<typeof CourtpieceSeatSchema>;
export type CourtpieceMatchStatus = z.infer<typeof CourtpieceMatchStatusSchema>;
export type CourtpieceRulesVariant = z.infer<typeof CourtpieceRulesVariantSchema>;
export type CourtpieceSuit = z.infer<typeof CourtpieceSuitSchema>;
export type CourtpiecePhase = z.infer<typeof CourtpiecePhaseSchema>;
export type CourtpiecePlayerView = z.infer<typeof CourtpiecePlayerViewSchema>;
export type CourtpieceTrickPlay = z.infer<typeof CourtpieceTrickPlaySchema>;
export type CourtpiecePublicView = z.infer<typeof CourtpiecePublicViewSchema>;
export type CourtpieceYou = z.infer<typeof CourtpieceYouSchema>;
export type CreateCourtpieceBody = z.infer<typeof CreateCourtpieceBodySchema>;
