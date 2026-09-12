import { z } from 'zod';

export const SnakesSeatSchema = z.number().int().min(0).max(3);
export const SnakesMatchStatusSchema = z.enum(['waiting', 'playing', 'finished']);

export const SnakesPlayerViewSchema = z.object({
  seat: SnakesSeatSchema,
  userId: z.string().nullable(),
  name: z.string().nullable(),
  isBot: z.boolean().optional(),
  ready: z.boolean(),
  connected: z.boolean().optional(),
  avatarId: z.number().int().optional(),
  avatarUrl: z.string().url().nullable().optional(),
  position: z.number().int().min(0).max(100),
});

export const SnakesPublicViewSchema = z.object({
  id: z.string(),
  inviteCode: z.string(),
  name: z.string(),
  hostUserId: z.string(),
  maxSeats: z.number().int().min(2).max(4),
  status: SnakesMatchStatusSchema,
  seats: z.array(SnakesPlayerViewSchema).max(4),
  toAct: SnakesSeatSchema.nullable(),
  die: z.number().int().min(1).max(6).nullable(),
  lastFrom: z.number().int().min(0).max(100).nullable().optional(),
  lastTo: z.number().int().min(0).max(100).nullable().optional(),
  lastTeleport: z.number().int().min(1).max(100).nullable().optional(),
  seq: z.number().int().nonnegative(),
  turnEndsAt: z.number().nullable().optional(),
  turnTimeMs: z.number().int().positive().optional(),
  winnerSeat: SnakesSeatSchema.nullable().optional(),
  createdAt: z.number(),
});

export const SnakesYouSchema = z.object({
  seat: SnakesSeatSchema.nullable(),
});

export const CreateSnakesBodySchema = z.object({
  name: z.string().min(1).max(64).default('Snakes & Ladders'),
  maxSeats: z.number().int().min(2).max(4).default(4),
  botCount: z.number().int().min(0).max(3).default(0),
  inviteCode: z
    .string()
    .regex(/^\d{4,8}$/, 'Room code must be 4–8 digits')
    .optional(),
  inviteFriendIds: z.array(z.string().min(1).max(128)).max(8).default([]),
});

export type SnakesSeat = z.infer<typeof SnakesSeatSchema>;
export type SnakesMatchStatus = z.infer<typeof SnakesMatchStatusSchema>;
export type SnakesPlayerView = z.infer<typeof SnakesPlayerViewSchema>;
export type SnakesPublicView = z.infer<typeof SnakesPublicViewSchema>;
export type SnakesYou = z.infer<typeof SnakesYouSchema>;
export type CreateSnakesBody = z.infer<typeof CreateSnakesBodySchema>;
