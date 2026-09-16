import { z } from 'zod';
import {
  LudoLegalMoveSchema,
  LudoPublicViewSchema,
  LudoSeatSchema,
  LudoYouSchema,
} from './ludo.js';
import { MemoryPublicViewSchema, MemorySeatSchema, MemoryYouSchema } from './memory.js';
import {
  CourtpiecePublicViewSchema,
  CourtpieceSeatSchema,
  CourtpieceSuitSchema,
  CourtpieceYouSchema,
} from './courtpiece.js';
import { SnakesPublicViewSchema, SnakesSeatSchema, SnakesYouSchema } from './snakes.js';

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
    /** When true, join as spectator only (no auto-sit). Default: sit if a seat is free. */
    spectate: z.boolean().optional(),
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
    type: z.literal('sit_out'),
    tableId: z.string().min(1),
    seat: z.number().int().min(0).max(9),
  }),
  z.object({
    type: z.literal('sit_in'),
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
  /** Cash + contest tables: mark ready / unready between hands. Hand deals when all humans ready. */
  z.object({
    type: z.literal('set_ready'),
    tableId: z.string().min(1),
    ready: z.boolean(),
  }),
  /** Host only: remove a seated player (between hands, cash tables). */
  z.object({
    type: z.literal('kick_player'),
    tableId: z.string().min(1),
    seat: z.number().int().min(0).max(9),
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
    /** Admin bot name group; default group when omitted and table has no pool yet. */
    botGroupId: z.string().min(1).max(64).optional(),
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
  z.object({
    type: z.literal('voice_join'),
    tableId: z.string().min(1),
  }),
  z.object({
    type: z.literal('voice_leave'),
    tableId: z.string().min(1),
  }),
  z.object({
    type: z.literal('voice_signal'),
    tableId: z.string().min(1),
    toUserId: z.string().min(1),
    signal: z.object({
      type: z.enum(['offer', 'answer', 'ice']),
      sdp: z.string().optional(),
      candidate: z
        .object({
          candidate: z.string().optional(),
          sdpMid: z.string().nullable().optional(),
          sdpMLineIndex: z.number().nullable().optional(),
          usernameFragment: z.string().optional(),
        })
        .optional(),
    }),
  }),
  z.object({
    type: z.literal('join_contest'),
    contestId: z.string().min(1),
  }),
  z.object({
    type: z.literal('leave_contest'),
    contestId: z.string().min(1),
  }),
  z.object({
    type: z.literal('join_ludo'),
    ludoId: z.string().min(1),
    /** When true, join as spectator only (no auto-sit). Default: sit if a seat is free. */
    spectate: z.boolean().nullish(),
  }),
  z.object({
    type: z.literal('leave_ludo'),
    ludoId: z.string().min(1),
  }),
  z.object({
    type: z.literal('ludo_sit'),
    ludoId: z.string().min(1),
    seat: LudoSeatSchema,
  }),
  z.object({
    type: z.literal('ludo_stand'),
    ludoId: z.string().min(1),
    seat: LudoSeatSchema,
  }),
  z.object({
    type: z.literal('ludo_set_ready'),
    ludoId: z.string().min(1),
    ready: z.boolean(),
  }),
  z.object({
    type: z.literal('ludo_roll'),
    ludoId: z.string().min(1),
    seq: z.number().int().nonnegative(),
  }),
  z.object({
    type: z.literal('ludo_move'),
    ludoId: z.string().min(1),
    tokenIndex: z.number().int().min(0).max(3),
    seq: z.number().int().nonnegative(),
  }),
  z.object({
    type: z.literal('ludo_add_bot'),
    ludoId: z.string().min(1),
    seat: LudoSeatSchema.nullish(),
  }),
  z.object({
    type: z.literal('ludo_remove_bot'),
    ludoId: z.string().min(1),
    seat: LudoSeatSchema,
  }),
  z.object({
    type: z.literal('ludo_chat'),
    ludoId: z.string().min(1),
    text: z.string().min(1).max(280),
  }),
  z.object({
    type: z.literal('join_snakes'),
    snakesId: z.string().min(1),
    spectate: z.boolean().nullish(),
  }),
  z.object({
    type: z.literal('leave_snakes'),
    snakesId: z.string().min(1),
  }),
  z.object({
    type: z.literal('snakes_sit'),
    snakesId: z.string().min(1),
    seat: SnakesSeatSchema,
  }),
  z.object({
    type: z.literal('snakes_stand'),
    snakesId: z.string().min(1),
    seat: SnakesSeatSchema,
  }),
  z.object({
    type: z.literal('snakes_set_ready'),
    snakesId: z.string().min(1),
    ready: z.boolean(),
  }),
  z.object({
    type: z.literal('snakes_roll'),
    snakesId: z.string().min(1),
    seq: z.number().int().nonnegative(),
  }),
  z.object({
    type: z.literal('snakes_add_bot'),
    snakesId: z.string().min(1),
    seat: SnakesSeatSchema.nullish(),
  }),
  z.object({
    type: z.literal('snakes_remove_bot'),
    snakesId: z.string().min(1),
    seat: SnakesSeatSchema,
  }),
  z.object({
    type: z.literal('snakes_chat'),
    snakesId: z.string().min(1),
    text: z.string().min(1).max(280),
  }),
  z.object({
    type: z.literal('join_memory'),
    memoryId: z.string().min(1),
    spectate: z.boolean().nullish(),
  }),
  z.object({
    type: z.literal('leave_memory'),
    memoryId: z.string().min(1),
  }),
  z.object({
    type: z.literal('memory_sit'),
    memoryId: z.string().min(1),
    seat: MemorySeatSchema,
  }),
  z.object({
    type: z.literal('memory_stand'),
    memoryId: z.string().min(1),
    seat: MemorySeatSchema,
  }),
  z.object({
    type: z.literal('memory_set_ready'),
    memoryId: z.string().min(1),
    ready: z.boolean(),
  }),
  z.object({
    type: z.literal('memory_flip'),
    memoryId: z.string().min(1),
    index: z.number().int().nonnegative(),
    seq: z.number().int().nonnegative(),
  }),
  z.object({
    type: z.literal('memory_add_bot'),
    memoryId: z.string().min(1),
    seat: MemorySeatSchema.nullish(),
  }),
  z.object({
    type: z.literal('memory_remove_bot'),
    memoryId: z.string().min(1),
    seat: MemorySeatSchema,
  }),
  z.object({
    type: z.literal('memory_chat'),
    memoryId: z.string().min(1),
    text: z.string().min(1).max(280),
  }),
  z.object({
    type: z.literal('join_courtpiece'),
    courtpieceId: z.string().min(1),
    spectate: z.boolean().nullish(),
  }),
  z.object({
    type: z.literal('leave_courtpiece'),
    courtpieceId: z.string().min(1),
  }),
  z.object({
    type: z.literal('courtpiece_sit'),
    courtpieceId: z.string().min(1),
    seat: CourtpieceSeatSchema,
  }),
  z.object({
    type: z.literal('courtpiece_stand'),
    courtpieceId: z.string().min(1),
    seat: CourtpieceSeatSchema,
  }),
  z.object({
    type: z.literal('courtpiece_set_ready'),
    courtpieceId: z.string().min(1),
    ready: z.boolean(),
  }),
  z.object({
    type: z.literal('courtpiece_set_trump'),
    courtpieceId: z.string().min(1),
    suit: CourtpieceSuitSchema,
    seq: z.number().int().nonnegative(),
  }),
  z.object({
    type: z.literal('courtpiece_play'),
    courtpieceId: z.string().min(1),
    card: z.string().min(2).max(2),
    seq: z.number().int().nonnegative(),
  }),
  z.object({
    type: z.literal('courtpiece_add_bot'),
    courtpieceId: z.string().min(1),
    seat: CourtpieceSeatSchema.nullish(),
  }),
  z.object({
    type: z.literal('courtpiece_remove_bot'),
    courtpieceId: z.string().min(1),
    seat: CourtpieceSeatSchema,
  }),
  z.object({
    type: z.literal('courtpiece_chat'),
    courtpieceId: z.string().min(1),
    text: z.string().min(1).max(280),
  }),
]);

export type ClientMessage = z.infer<typeof ClientMessageSchema>;

/** Server → Client (loose typing for views; validated on write side) */
export const ServerMessageSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('auth_ok'),
    userId: z.string(),
    name: z.string(),
    avatarId: z.number().int().optional(),
    avatarUrl: z.string().url().nullable().optional(),
    chipBalance: z.number().int().nonnegative().optional(),
    whuffieBalance: z.number().int().nonnegative().optional(),
  }),
  z.object({
    type: z.literal('wallet_update'),
    chipBalance: z.number().int().nonnegative().optional(),
    whuffieBalance: z.number().int().nonnegative().optional(),
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
    type: z.literal('seat_action'),
    tableId: z.string(),
    seat: z.number().int().min(0).max(9),
    action: ActionTypeSchema,
    amount: z.number().int().nonnegative(),
    label: z.string().min(1).max(32),
    at: z.number(),
  }),
  z.object({
    type: z.literal('pong'),
  }),
  z.object({
    type: z.literal('contest_sync'),
    contest: z.unknown(),
  }),
  z.object({
    type: z.literal('contest_event'),
    contestId: z.string(),
    event: z.enum(['match_assigned', 'eliminated', 'contest_completed', 'contest_started']),
    message: z.string().optional(),
    tableId: z.string().optional(),
    matchId: z.string().optional(),
    place: z.number().int().positive().optional(),
  }),
  /** Lobby: open public cash tables (same payload as GET /api/tables). */
  z.object({
    type: z.literal('public_tables_sync'),
    tables: z.array(z.unknown()),
  }),
  /** Lobby: open public contests (same as GET /api/contests). */
  z.object({
    type: z.literal('public_contests_sync'),
    contests: z.array(z.unknown()),
  }),
  /** Auth only: contests the user hosts or is registered for. */
  z.object({
    type: z.literal('my_contests_sync'),
    contests: z.array(z.unknown()),
  }),
  /**
   * Auth only: full social snapshot (same fields as GET /api/friends).
   * Pushed on auth and after friend/presence/request/challenge/group changes.
   */
  z.object({
    type: z.literal('social_sync'),
    friends: z.array(z.unknown()),
    incoming: z.array(z.unknown()),
    pendingChallenges: z.array(z.unknown()),
    groups: z.array(z.unknown()),
  }),
  z.object({
    type: z.literal('ludo_state_sync'),
    ludo: LudoPublicViewSchema,
    you: LudoYouSchema,
    /** Present when it is your turn. */
    legalMoves: z.array(LudoLegalMoveSchema).optional(),
  }),
  z.object({
    type: z.literal('ludo_chat'),
    ludoId: z.string(),
    userId: z.string(),
    name: z.string(),
    text: z.string(),
    at: z.number(),
  }),
  z.object({
    type: z.literal('snakes_state_sync'),
    snakes: SnakesPublicViewSchema,
    you: SnakesYouSchema,
  }),
  z.object({
    type: z.literal('snakes_chat'),
    snakesId: z.string(),
    userId: z.string(),
    name: z.string(),
    text: z.string(),
    at: z.number(),
  }),
  z.object({
    type: z.literal('memory_state_sync'),
    memory: MemoryPublicViewSchema,
    you: MemoryYouSchema,
  }),
  z.object({
    type: z.literal('memory_chat'),
    memoryId: z.string(),
    userId: z.string(),
    name: z.string(),
    text: z.string(),
    at: z.number(),
  }),
  z.object({
    type: z.literal('courtpiece_state_sync'),
    courtpiece: CourtpiecePublicViewSchema,
    you: CourtpieceYouSchema,
  }),
  z.object({
    type: z.literal('courtpiece_chat'),
    courtpieceId: z.string(),
    userId: z.string(),
    name: z.string(),
    text: z.string(),
    at: z.number(),
  }),
]);

export type ServerMessage = z.infer<typeof ServerMessageSchema>;

/** Friend user ids to notify after creating a table or contest (max 8). */
export const InviteFriendIdsSchema = z
  .array(z.string().min(1).max(128))
  .max(8)
  .default([]);

export const CreateTableBodySchema = z.object({
  name: z.string().min(1).max(64).default('Home Game'),
  smallBlind: z.number().int().positive().default(5),
  bigBlind: z.number().int().positive().default(10),
  buyIn: z.number().int().positive().default(1000),
  turnTimeMs: z.number().int().positive().default(20000),
  maxSeats: z.number().int().min(2).max(9).default(6),
  /** Seat bots when the table is created (host still needs to sit). */
  botCount: z.number().int().min(0).max(8).default(0),
  /** Admin-configured bot name group (uses site default when omitted). */
  botGroupId: z.string().min(1).max(64).optional(),
  isPrivate: z.boolean().default(true),
  /** Optional custom numerical invite / room code (4–8 digits). */
  inviteCode: z
    .string()
    .regex(/^\d{4,8}$/, 'Room code must be 4–8 digits')
    .optional(),
  /** Friends to receive a table invite when the private table is created. */
  inviteFriendIds: InviteFriendIdsSchema,
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

export const CreateFriendGroupBodySchema = z.object({
  name: z.string().min(1).max(40),
  /** Friend user ids to include (owner is added separately). Max 8 members besides owner. */
  memberUserIds: z.array(z.string().min(1).max(128)).max(8).default([]),
});

export const UpdateFriendGroupBodySchema = z.object({
  name: z.string().min(1).max(40).optional(),
  memberUserIds: z.array(z.string().min(1).max(128)).max(8).optional(),
});

/** Quick-invite a whole group to a private cash table. */
export const InviteFriendGroupBodySchema = z.object({
  /** If omitted, invites every group member. */
  memberUserIds: z.array(z.string().min(1).max(128)).max(8).optional(),
  maxSeats: z.number().int().min(2).max(9).optional(),
  smallBlind: z.number().int().positive().optional(),
  bigBlind: z.number().int().positive().optional(),
  buyIn: z.number().int().positive().optional(),
});

/** Invite selected friends to an existing table or contest. */
export const InviteFriendsBodySchema = z.object({
  friendUserIds: InviteFriendIdsSchema,
});

export type CreateFriendGroupBody = z.infer<typeof CreateFriendGroupBodySchema>;
export type UpdateFriendGroupBody = z.infer<typeof UpdateFriendGroupBodySchema>;
export type InviteFriendGroupBody = z.infer<typeof InviteFriendGroupBodySchema>;
export type InviteFriendsBody = z.infer<typeof InviteFriendsBodySchema>;

/** Unique login + display name: 3–24 alphanumerics/underscore; not bot:… */
export const UsernameSchema = z
  .string()
  .min(3)
  .max(24)
  .regex(/^[a-zA-Z0-9_]+$/, 'Username must be letters, numbers, or underscore')
  .refine((u) => !u.toLowerCase().startsWith('bot'), 'Reserved username prefix');

export const PasswordSchema = z.string().min(6).max(128);

export const SignupBodySchema = z.object({
  username: UsernameSchema,
  password: PasswordSchema,
  /** Preset profile picture index (0–7). */
  avatarId: z.number().int().min(0).max(7).optional(),
});

export const LoginBodySchema = z.object({
  username: UsernameSchema,
  password: PasswordSchema,
});

export const AuthSessionSchema = z.object({
  userId: z.string(),
  username: z.string(),
  name: z.string(),
  ticket: z.string(),
  sessionToken: z.string(),
  avatarId: z.number().int().min(0).max(7),
  avatarUrl: z.string().url().max(512).nullable().optional(),
  chipBalance: z.number().int().nonnegative().optional(),
  whuffieBalance: z.number().int().nonnegative().optional(),
});

export const AvatarUploadUrlBodySchema = z.object({
  contentType: z.enum(['image/jpeg', 'image/png', 'image/webp']),
  contentLength: z.number().int().positive().max(2 * 1024 * 1024),
});

export const TableSoundKindSchema = z.enum([
  'fold',
  'check',
  'call',
  'bet',
  'raise',
  'allin',
  'deal',
  'flop',
  'turn',
  'river',
  'win',
]);

export const SoundUploadUrlBodySchema = z.object({
  kind: TableSoundKindSchema,
  contentType: z.enum(['audio/mpeg', 'audio/mp3']),
  contentLength: z.number().int().positive().max(5 * 1024 * 1024),
});

/** Admin-uploaded Home / lobby page illustrations. */
export const SiteImagePurposeSchema = z.enum([
  'home',
  'host',
  'join',
  'public',
  'contests',
  'friends',
  'solo',
  'signIn',
  'signUp',
]);

export const SiteImageUploadUrlBodySchema = z.object({
  purpose: SiteImagePurposeSchema,
  contentType: z.enum(['image/jpeg', 'image/png', 'image/webp']),
  contentLength: z.number().int().positive().max(4 * 1024 * 1024),
});

/** App chrome look: Classic (v1), Arcade (v2), or Glass (v3). Independent of table felt color. */
export const UiThemeSchema = z.enum(['v1', 'v2', 'v3']);
export type UiTheme = z.infer<typeof UiThemeSchema>;

/** In-game table layout: Classic oval (v1) or stacked HUD (v2). Independent of felt color. */
export const TableLayoutSchema = z.enum(['v1', 'v2']);
export type TableLayout = z.infer<typeof TableLayoutSchema>;

/** Remappable table keyboard shortcut action ids. */
export const KEYBOARD_SHORTCUT_ACTION_IDS = [
  'fold',
  'call',
  'check',
  'betRaise',
  'allIn',
  'voiceToggle',
  'micMute',
  'chat',
  'sfxMute',
  'help',
  'ready',
  'sitOut',
  'sitIn',
] as const;
export type KeyboardShortcutActionId = (typeof KEYBOARD_SHORTCUT_ACTION_IDS)[number];

export type KeyboardShortcuts = Record<KeyboardShortcutActionId, string>;

export const DEFAULT_KEYBOARD_SHORTCUTS: KeyboardShortcuts = {
  fold: 'F',
  call: 'C',
  check: 'K',
  betRaise: 'R',
  allIn: 'A',
  voiceToggle: 'V',
  micMute: 'M',
  chat: '/',
  sfxMute: 'S',
  help: 'H',
  ready: 'Y',
  sitOut: 'O',
  sitIn: 'I',
};

const RESERVED_SHORTCUT_KEYS = new Set(['ENTER', 'ESCAPE', 'TAB', ' ', 'SPACE']);

/** Canonical form for comparing / storing a shortcut key (`F`, `/`, …). */
export function normalizeShortcutKey(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed || trimmed.length > 24) return null;
  if (trimmed.length === 1) {
    const ch = trimmed.toUpperCase();
    if (RESERVED_SHORTCUT_KEYS.has(ch === ' ' ? ' ' : ch)) return null;
    return ch;
  }
  const upper = trimmed.toUpperCase();
  if (upper === 'SPACE' || upper === 'ENTER' || upper === 'ESCAPE' || upper === 'TAB') {
    return null;
  }
  // Multi-char keys (ArrowUp, etc.) are not used for remappable bindings.
  if (trimmed.length > 1) return null;
  return trimmed;
}

export function isRemappableShortcutKey(key: string): boolean {
  return normalizeShortcutKey(key) != null;
}

/**
 * Merge partial overrides with defaults. Unknown ids dropped; invalid keys ignored;
 * first action id in {@link KEYBOARD_SHORTCUT_ACTION_IDS} wins on duplicate keys.
 */
export function clampKeyboardShortcuts(raw: unknown): KeyboardShortcuts {
  const out: KeyboardShortcuts = { ...DEFAULT_KEYBOARD_SHORTCUTS };
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;

  const record = raw as Record<string, unknown>;
  const claimed = new Set<string>();
  const overrides = new Map<KeyboardShortcutActionId, string>();

  for (const id of KEYBOARD_SHORTCUT_ACTION_IDS) {
    const key = normalizeShortcutKey(record[id]);
    if (!key || claimed.has(key)) continue;
    overrides.set(id, key);
    claimed.add(key);
  }

  for (const id of KEYBOARD_SHORTCUT_ACTION_IDS) {
    const custom = overrides.get(id);
    if (custom) {
      out[id] = custom;
      continue;
    }
    const fallback = DEFAULT_KEYBOARD_SHORTCUTS[id];
    if (!claimed.has(fallback)) {
      out[id] = fallback;
      claimed.add(fallback);
      continue;
    }
    // Default key stolen — pick the first free single letter / slash.
    const pool = 'BDEFGJLN PQTUWXYZ/'.replace(/\s/g, '');
    let assigned = fallback;
    for (const ch of pool) {
      if (!claimed.has(ch)) {
        assigned = ch;
        break;
      }
    }
    out[id] = assigned;
    claimed.add(assigned);
  }

  return out;
}

export const KeyboardShortcutsSchema = z.record(z.string(), z.string()).transform((value) =>
  clampKeyboardShortcuts(value),
);

export const UpdateMeBodySchema = z
  .object({
    /** Preset profile picture index (0–7). */
    avatarId: z.number().int().min(0).max(7).optional(),
    /** Custom profile image URL (from S3 upload). Pass null to clear. */
    avatarUrl: z.string().url().max(512).nullable().optional(),
    /** Preset table felt theme index (0–8). */
    tableColorId: z.number().int().min(0).max(8).optional(),
    /** App chrome look: Classic (v1), Arcade (v2), or Glass (v3). */
    uiTheme: UiThemeSchema.optional(),
    /** Table layout: Classic oval (v1) or stacked HUD (v2). */
    tableLayout: TableLayoutSchema.optional(),
    /** Mute table SFX (deal / action / win). */
    sfxMuted: z.boolean().optional(),
    /** Remappable table keyboard shortcuts (merged with defaults). */
    keyboardShortcuts: z.record(z.string(), z.string()).optional(),
  })
  .refine(
    (body) =>
      body.avatarId !== undefined ||
      body.avatarUrl !== undefined ||
      body.tableColorId !== undefined ||
      body.uiTheme !== undefined ||
      body.tableLayout !== undefined ||
      body.sfxMuted !== undefined ||
      body.keyboardShortcuts !== undefined,
    {
      message:
        'At least one of avatarId, avatarUrl, tableColorId, uiTheme, tableLayout, sfxMuted, or keyboardShortcuts is required',
    },
  );

/** Viewer↔subject friendship for public profile pages (omit when anonymous). */
export const PublicProfileRelationshipSchema = z.enum([
  'self',
  'friends',
  'outgoing',
  'incoming',
  'none',
]);
export type PublicProfileRelationship = z.infer<typeof PublicProfileRelationshipSchema>;

export const PublicProfileSchema = z.object({
  id: z.string(),
  username: z.string(),
  name: z.string(),
  avatarId: z.number().int().min(0).max(7),
  avatarUrl: z.string().url().max(512).nullable(),
  createdAt: z.number(),
  handsPlayed: z.number().int().nonnegative(),
  friendCount: z.number().int().nonnegative(),
  chipBalance: z.number().int().nonnegative(),
  whuffieBalance: z.number().int().nonnegative(),
  relationship: PublicProfileRelationshipSchema.optional(),
  /** Present when relationship is `incoming` (viewer can Accept). */
  incomingRequestId: z.string().optional(),
});
export type PublicProfile = z.infer<typeof PublicProfileSchema>;

export type SignupBody = z.infer<typeof SignupBodySchema>;
export type LoginBody = z.infer<typeof LoginBodySchema>;
export type AuthSession = z.infer<typeof AuthSessionSchema>;
export type AvatarUploadUrlBody = z.infer<typeof AvatarUploadUrlBodySchema>;
export type TableSoundKind = z.infer<typeof TableSoundKindSchema>;
export type SoundUploadUrlBody = z.infer<typeof SoundUploadUrlBodySchema>;
export type SiteImagePurpose = z.infer<typeof SiteImagePurposeSchema>;
export type SiteImageUploadUrlBody = z.infer<typeof SiteImageUploadUrlBodySchema>;
export type UpdateMeBody = z.infer<typeof UpdateMeBodySchema>;

/** @deprecated Use SignupBodySchema / LoginBodySchema */
export const RegisterBodySchema = z.object({
  name: z.string().min(1).max(32),
  avatarId: z.number().int().min(0).max(7).optional(),
  userId: z.string().min(1).max(128).optional(),
});
