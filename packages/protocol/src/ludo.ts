import { z } from 'zod';

/** Seat / color: 0 red, 1 green, 2 yellow, 3 blue (clockwise). */
export const LudoSeatSchema = z.number().int().min(0).max(3);
export const LudoColorSchema = z.enum(['red', 'green', 'yellow', 'blue']);
export const LUDO_SEAT_COLORS = ['red', 'green', 'yellow', 'blue'] as const;

export const LudoMatchStatusSchema = z.enum(['waiting', 'playing', 'finished']);

/** Token location: yard, main track 0–51, home stretch 0–4, or home. */
export const LudoTokenPosSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('yard') }),
  z.object({
    kind: z.literal('track'),
    index: z.number().int().min(0).max(51),
  }),
  z.object({
    kind: z.literal('stretch'),
    index: z.number().int().min(0).max(4),
  }),
  z.object({ kind: z.literal('home') }),
]);

export const LudoTokenSchema = z.object({
  index: z.number().int().min(0).max(3),
  pos: LudoTokenPosSchema,
});

export const LudoPlayerViewSchema = z.object({
  seat: LudoSeatSchema,
  userId: z.string().nullable(),
  name: z.string().nullable(),
  isBot: z.boolean().optional(),
  ready: z.boolean(),
  connected: z.boolean().optional(),
  avatarId: z.number().int().optional(),
  avatarUrl: z.string().url().nullable().optional(),
  tokens: z.array(LudoTokenSchema).max(4),
});

/** Legal token to move on the current die (present when it is your turn). */
export const LudoLegalMoveSchema = z.object({
  tokenIndex: z.number().int().min(0).max(3),
});

/** Fully public match/room view — Ludo has no hidden information. */
export const LudoPublicViewSchema = z.object({
  id: z.string(),
  inviteCode: z.string(),
  name: z.string(),
  hostUserId: z.string(),
  maxSeats: z.number().int().min(2).max(4),
  status: LudoMatchStatusSchema,
  seats: z.array(LudoPlayerViewSchema).max(4),
  toAct: LudoSeatSchema.nullable(),
  die: z.number().int().min(1).max(6).nullable(),
  consecutiveSixes: z.number().int().min(0).max(3).optional(),
  seq: z.number().int().nonnegative(),
  turnEndsAt: z.number().nullable().optional(),
  turnTimeMs: z.number().int().positive().optional(),
  winnerSeat: LudoSeatSchema.nullable().optional(),
  createdAt: z.number(),
});

export const LudoYouSchema = z.object({
  seat: LudoSeatSchema.nullable(),
});

export const CreateLudoBodySchema = z.object({
  name: z.string().min(1).max(64).default('Ludo'),
  maxSeats: z.number().int().min(2).max(4).default(4),
  /** Seat bots when the board is created (host still needs to sit). */
  botCount: z.number().int().min(0).max(3).default(0),
  /** Optional custom numerical invite / room code (4–8 digits). */
  inviteCode: z
    .string()
    .regex(/^\d{4,8}$/, 'Room code must be 4–8 digits')
    .optional(),
  /** Friends to receive a Ludo invite when the board is created. */
  inviteFriendIds: z.array(z.string().min(1).max(128)).max(8).default([]),
});

export type LudoSeat = z.infer<typeof LudoSeatSchema>;
export type LudoColor = z.infer<typeof LudoColorSchema>;
export type LudoMatchStatus = z.infer<typeof LudoMatchStatusSchema>;
export type LudoTokenPos = z.infer<typeof LudoTokenPosSchema>;
export type LudoToken = z.infer<typeof LudoTokenSchema>;
export type LudoPlayerView = z.infer<typeof LudoPlayerViewSchema>;
export type LudoLegalMove = z.infer<typeof LudoLegalMoveSchema>;
export type LudoPublicView = z.infer<typeof LudoPublicViewSchema>;
export type LudoYou = z.infer<typeof LudoYouSchema>;
export type CreateLudoBody = z.infer<typeof CreateLudoBodySchema>;
