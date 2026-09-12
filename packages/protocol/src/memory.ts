import { z } from 'zod';

export const MemorySeatSchema = z.number().int().min(0).max(3);
export const MemoryMatchStatusSchema = z.enum(['waiting', 'playing', 'finished']);
export const MemoryGridSizeSchema = z.union([z.literal(16), z.literal(36)]);

export const MemoryCardViewSchema = z.object({
  index: z.number().int().nonnegative(),
  pairId: z.number().int().nonnegative().nullable(),
  matched: z.boolean(),
  faceUp: z.boolean(),
});

export const MemoryPlayerViewSchema = z.object({
  seat: MemorySeatSchema,
  userId: z.string().nullable(),
  name: z.string().nullable(),
  isBot: z.boolean().optional(),
  ready: z.boolean(),
  connected: z.boolean().optional(),
  avatarId: z.number().int().optional(),
  avatarUrl: z.string().url().nullable().optional(),
  pairs: z.number().int().nonnegative(),
});

export const MemoryPublicViewSchema = z.object({
  id: z.string(),
  inviteCode: z.string(),
  name: z.string(),
  hostUserId: z.string(),
  maxSeats: z.number().int().min(2).max(4),
  gridSize: MemoryGridSizeSchema,
  status: MemoryMatchStatusSchema,
  seats: z.array(MemoryPlayerViewSchema).max(4),
  cards: z.array(MemoryCardViewSchema),
  faceUp: z.array(z.number().int().nonnegative()),
  toAct: MemorySeatSchema.nullable(),
  seq: z.number().int().nonnegative(),
  turnEndsAt: z.number().nullable().optional(),
  turnTimeMs: z.number().int().positive().optional(),
  winnerSeats: z.array(MemorySeatSchema).optional(),
  createdAt: z.number(),
});

export const MemoryYouSchema = z.object({
  seat: MemorySeatSchema.nullable(),
});

export const CreateMemoryBodySchema = z.object({
  name: z.string().min(1).max(64).default('Memory Match'),
  maxSeats: z.number().int().min(2).max(4).default(2),
  gridSize: MemoryGridSizeSchema.default(16),
  botCount: z.number().int().min(0).max(3).default(0),
  inviteCode: z
    .string()
    .regex(/^\d{4,8}$/, 'Room code must be 4–8 digits')
    .optional(),
  inviteFriendIds: z.array(z.string().min(1).max(128)).max(8).default([]),
});

export type MemorySeat = z.infer<typeof MemorySeatSchema>;
export type MemoryMatchStatus = z.infer<typeof MemoryMatchStatusSchema>;
export type MemoryGridSize = z.infer<typeof MemoryGridSizeSchema>;
export type MemoryCardView = z.infer<typeof MemoryCardViewSchema>;
export type MemoryPlayerView = z.infer<typeof MemoryPlayerViewSchema>;
export type MemoryPublicView = z.infer<typeof MemoryPublicViewSchema>;
export type MemoryYou = z.infer<typeof MemoryYouSchema>;
export type CreateMemoryBody = z.infer<typeof CreateMemoryBodySchema>;
