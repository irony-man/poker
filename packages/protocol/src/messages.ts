import { z } from 'zod';

export const ActionTypeSchema = z.enum(['fold', 'check', 'call', 'bet', 'raise', 'allin']);

/** Client → Server */
export const ClientMessageSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('auth'),
    ticket: z.string().min(1),
  }),
  z.object({
    type: z.literal('join_table'),
    tableId: z.string().min(1),
  }),
  z.object({
    type: z.literal('leave_table'),
    tableId: z.string().min(1),
  }),
  z.object({
    type: z.literal('sit'),
    tableId: z.string().min(1),
    seat: z.number().int().min(0).max(9),
    buyIn: z.number().int().positive(),
  }),
  z.object({
    type: z.literal('stand'),
    tableId: z.string().min(1),
    seat: z.number().int().min(0).max(9),
  }),
  z.object({
    type: z.literal('top_up'),
    tableId: z.string().min(1),
    seat: z.number().int().min(0).max(9),
    amount: z.number().int().positive(),
  }),
  z.object({
    type: z.literal('start_hand'),
    tableId: z.string().min(1),
  }),
  z.object({
    type: z.literal('action'),
    tableId: z.string().min(1),
    handId: z.string().min(1),
    seq: z.number().int().nonnegative(),
    action: ActionTypeSchema,
    amount: z.number().int().positive().optional(),
  }),
  z.object({
    type: z.literal('chat'),
    tableId: z.string().min(1),
    text: z.string().min(1).max(280),
  }),
  z.object({
    type: z.literal('emoji'),
    tableId: z.string().min(1),
    emoji: z.string().min(1).max(32),
  }),
  z.object({
    type: z.literal('add_bot'),
    tableId: z.string().min(1),
    seat: z.number().int().min(0).max(9).optional(),
    buyIn: z.number().int().positive().optional(),
    /** How many bots to seat (ignored when `seat` is set). Default 1. */
    count: z.number().int().min(1).max(9).optional(),
  }),
  z.object({
    type: z.literal('remove_bot'),
    tableId: z.string().min(1),
    seat: z.number().int().min(0).max(9),
  }),
  z.object({
    type: z.literal('remove_all_bots'),
    tableId: z.string().min(1),
  }),
  z.object({
    type: z.literal('ping'),
  }),
]);

export type ClientMessage = z.infer<typeof ClientMessageSchema>;

/** Server → Client (loose typing for views; validated on write side) */
export const ServerMessageSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('auth_ok'),
    userId: z.string(),
    name: z.string(),
  }),
  z.object({
    type: z.literal('error'),
    message: z.string(),
    code: z.string().optional(),
  }),
  z.object({
    type: z.literal('state_sync'),
    table: z.unknown(),
    private: z.unknown().nullable(),
  }),
  z.object({
    type: z.literal('chat'),
    tableId: z.string(),
    userId: z.string(),
    name: z.string(),
    text: z.string(),
    at: z.number(),
  }),
  z.object({
    type: z.literal('emoji'),
    tableId: z.string(),
    userId: z.string(),
    name: z.string(),
    emoji: z.string(),
    at: z.number(),
  }),
  z.object({
    type: z.literal('pong'),
  }),
  z.object({
    type: z.literal('table_created'),
    tableId: z.string(),
    inviteCode: z.string(),
  }),
]);

export type ServerMessage = z.infer<typeof ServerMessageSchema>;

export const CreateTableBodySchema = z.object({
  name: z.string().min(1).max(64).default('Home Game'),
  smallBlind: z.number().int().positive().default(5),
  bigBlind: z.number().int().positive().default(10),
  minBuyIn: z.number().int().positive().default(200),
  maxBuyIn: z.number().int().positive().default(1000),
  turnTimeMs: z.number().int().positive().default(20000),
  maxSeats: z.number().int().min(2).max(9).default(6),
  /** Seat bots when the table is created (host still needs to sit). */
  botCount: z.number().int().min(0).max(8).default(0),
  isPrivate: z.boolean().default(true),
});

export type CreateTableBody = z.infer<typeof CreateTableBodySchema>;

export const FriendRequestBodySchema = z.object({
  targetUserId: z.string().min(1).max(128),
});

export const FriendRespondBodySchema = z.object({
  accept: z.boolean(),
});

export const ChallengeFriendBodySchema = z.object({
  friendUserId: z.string().min(1).max(128),
});

export const RegisterBodySchema = z.object({
  name: z.string().min(1).max(32),
  /** Preset profile picture index (0–7). */
  avatarId: z.number().int().min(0).max(7).optional(),
  /**
   * Optional client hint only — ignored when Clerk JWT is present.
   * Clerk user ids are accepted up to 128 chars.
   */
  userId: z.string().min(1).max(128).optional(),
});
