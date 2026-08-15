import { z } from 'zod';

export const HandHistorySourceSchema = z.enum(['online', 'offline']);
export const ChatMessageKindSchema = z.enum(['user', 'system', 'emoji']);

export const HandChatLineSchema = z.object({
  at: z.number().int(),
  userId: z.string().min(1).max(128),
  name: z.string().min(1).max(64),
  text: z.string().min(1).max(280),
  kind: ChatMessageKindSchema.nullish().optional(),
});

export const UploadHandBodySchema = z.object({
  tableId: z.string().min(1).max(80),
  handId: z.string().min(1).max(80),
  startedAt: z.number().int().nonnegative(),
  endedAt: z.number().int().nonnegative(),
  contestId: z.string().min(1).max(80).nullable().optional(),
  source: z.literal('offline').default('offline'),
  result: z.unknown(),
  chat: z.array(HandChatLineSchema).max(500).optional(),
});

export type UploadHandBody = z.infer<typeof UploadHandBodySchema>;
export type HandChatLine = z.infer<typeof HandChatLineSchema>;
