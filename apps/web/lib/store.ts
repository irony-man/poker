'use client';

import type {
  PrivateView as EnginePrivateView,
  PublicPlayerView,
  PublicTableView,
  ActionType,
} from '@poker/engine';
import { create } from 'zustand';
import type {
  CourtpiecePublicView,
  CourtpieceYou,
  LudoLegalMove,
  LudoPublicView,
  LudoYou,
  MemoryPublicView,
  MemoryYou,
  SnakesPublicView,
  SnakesYou,
} from '@poker/protocol';
import type {
  ContestView,
  FriendGroup,
  FriendProfile,
  OutgoingChallenge,
  OutgoingRequest,
  PendingChallenge,
  PendingRequest,
  PublicTableSummary,
} from '@/lib/api';

export type ActionBurst = {
  seat: number;
  label: string;
  at: number;
  action?: ActionType;
};

export type PublicPlayer = PublicPlayerView & {
  /** Preset profile picture index (0–7). */
  avatarId?: number | null;
  avatarUrl?: string | null;
  /** Between hands on cash tables: opted in for next deal (bots always true). */
  ready?: boolean;
  /** Requested sit-out after the current hand ends. */
  pendingSitOut?: boolean;
};

export type PublicTable = Omit<PublicTableView, 'players' | 'showdownHands'> & {
  players: PublicPlayer[];
  showdownHands?: { seat: number; handName: string; cards?: string[] }[];
  /** Epoch ms when current turn expires (server clock). */
  turnEndsAt?: number | null;
  /** Table creator (cash host). */
  hostUserId?: string | null;
  /** Private host tables allow bots; public stake tables do not. */
  isPrivate?: boolean;
  /** Present on tournament tables. */
  tournament?: {
    contestId: string;
    mode: 'rounds' | 'chips';
    matchId: string | null;
    frozen: boolean;
    noTopUp: boolean;
    /** Hands finished so far (rounds contests). */
    handsPlayed?: number;
    /** Session length in hands for rounds; null for freezeouts. */
    handLimit?: number | null;
  } | null;
};

export type PrivateView = EnginePrivateView;

export interface ChatMessage {
  userId: string;
  name: string;
  text: string;
  at: number;
}

export interface SocialSnapshot {
  friends: FriendProfile[];
  incoming: PendingRequest[];
  outgoing: OutgoingRequest[];
  pendingChallenges: PendingChallenge[];
  outgoingChallenges: OutgoingChallenge[];
  groups: FriendGroup[];
}

interface SessionState {
  userId: string | null;
  username: string | null;
  name: string | null;
  ticket: string | null;
  sessionToken: string | null;
  connection: 'idle' | 'connecting' | 'open' | 'closed';
  /** Table the active socket is bound to (guards against stale state_sync). */
  boundTableId: string | null;
  /** Ludo board the active socket is bound to (guards against stale ludo_state_sync). */
  boundLudoId: string | null;
  /** Snakes board the active socket is bound to. */
  boundSnakesId: string | null;
  /** Memory board the active socket is bound to. */
  boundMemoryId: string | null;
  /** Court Piece board the active socket is bound to. */
  boundCourtpieceId: string | null;
  table: PublicTable | null;
  ludo: LudoPublicView | null;
  ludoYou: LudoYou | null;
  ludoLegalMoves: LudoLegalMove[];
  snakes: SnakesPublicView | null;
  snakesYou: SnakesYou | null;
  memory: MemoryPublicView | null;
  memoryYou: MemoryYou | null;
  courtpiece: CourtpiecePublicView | null;
  courtpieceYou: CourtpieceYou | null;
  private: PrivateView | null;
  chat: ChatMessage[];
  lastError: string | null;
  lastErrorCode: string | null;
  emojiBurst: { emoji: string; name: string; at: number } | null;
  /** Last poker action shown as a seat popup. */
  actionBurst: ActionBurst | null;
  /** Global chip bankroll (updated via wallet_update / auth_ok / /api/me). */
  chipBalance: number | null;
  /** Contest ranking rating (Whuffies). */
  whuffieBalance: number | null;
  /** Playing card face theme id from site config. */
  cardThemeId: string | null;

  /** Lobby / social push state (session WebSocket). */
  publicTables: PublicTableSummary[];
  publicContests: ContestView[];
  myContests: ContestView[];
  social: SocialSnapshot | null;
  socialLoaded: boolean;
  /** Latest contest_sync by id (watched contests). */
  contestById: Record<string, ContestView>;
  /** Latest contest event for watchers (match_assigned etc.). */
  contestEvent: {
    contestId: string;
    event: string;
    tableId?: string;
    message?: string;
    place?: number;
    at: number;
  } | null;

  setSession: (s: {
    userId: string;
    name: string;
    ticket: string;
    username?: string;
    sessionToken?: string;
    chipBalance?: number;
    whuffieBalance?: number;
  }) => void;
  clearSession: () => void;
  setConnection: (c: SessionState['connection']) => void;
  bindTable: (tableId: string | null) => void;
  bindLudo: (ludoId: string | null) => void;
  bindSnakes: (snakesId: string | null) => void;
  bindMemory: (memoryId: string | null) => void;
  bindCourtpiece: (courtpieceId: string | null) => void;
  applyStateSync: (table: PublicTable, priv: PrivateView | null) => void;
  applyLudoStateSync: (
    ludo: LudoPublicView,
    you: LudoYou,
    legalMoves?: LudoLegalMove[],
  ) => void;
  applySnakesStateSync: (snakes: SnakesPublicView, you: SnakesYou) => void;
  applyMemoryStateSync: (memory: MemoryPublicView, you: MemoryYou) => void;
  applyCourtpieceStateSync: (courtpiece: CourtpiecePublicView, you: CourtpieceYou) => void;
  clearTable: () => void;
  clearLudo: () => void;
  clearSnakes: () => void;
  clearMemory: () => void;
  clearCourtpiece: () => void;
  pushChat: (m: ChatMessage) => void;
  setError: (e: string | null, code?: string | null) => void;
  setEmoji: (e: { emoji: string; name: string; at: number } | null) => void;
  setActionBurst: (e: ActionBurst | null) => void;
  setChipBalance: (balance: number | null) => void;
  setWhuffieBalance: (balance: number | null) => void;
  setCardThemeId: (id: string | null) => void;
  applyPublicTables: (tables: PublicTableSummary[]) => void;
  applyPublicContests: (contests: ContestView[]) => void;
  applyMyContests: (contests: ContestView[]) => void;
  applySocial: (social: SocialSnapshot) => void;
  applyContestSync: (contest: ContestView) => void;
  applyContestEvent: (ev: {
    contestId: string;
    event: string;
    tableId?: string;
    message?: string;
    place?: number;
  }) => void;
  clearContestWatch: (contestId: string) => void;
}

const clearedArcade = {
  boundLudoId: null as string | null,
  boundSnakesId: null as string | null,
  boundMemoryId: null as string | null,
  boundCourtpieceId: null as string | null,
  ludo: null as LudoPublicView | null,
  ludoYou: null as LudoYou | null,
  ludoLegalMoves: [] as LudoLegalMove[],
  snakes: null as SnakesPublicView | null,
  snakesYou: null as SnakesYou | null,
  memory: null as MemoryPublicView | null,
  memoryYou: null as MemoryYou | null,
  courtpiece: null as CourtpiecePublicView | null,
  courtpieceYou: null as CourtpieceYou | null,
};

const clearedTable = {
  boundTableId: null as string | null,
  table: null as PublicTable | null,
  private: null as PrivateView | null,
};

export const useSession = create<SessionState>((set) => ({
  userId: null,
  username: null,
  name: null,
  ticket: null,
  sessionToken: null,
  connection: 'idle',
  boundTableId: null,
  boundLudoId: null,
  boundSnakesId: null,
  boundMemoryId: null,
  boundCourtpieceId: null,
  table: null,
  ludo: null,
  ludoYou: null,
  ludoLegalMoves: [],
  snakes: null,
  snakesYou: null,
  memory: null,
  memoryYou: null,
  courtpiece: null,
  courtpieceYou: null,
  private: null,
  chat: [],
  lastError: null,
  lastErrorCode: null,
  emojiBurst: null,
  actionBurst: null,
  chipBalance: null,
  whuffieBalance: null,
  cardThemeId: null,
  publicTables: [],
  publicContests: [],
  myContests: [],
  social: null,
  socialLoaded: false,
  contestById: {},
  contestEvent: null,
  setSession: (s) =>
    set({
      userId: s.userId,
      name: s.name,
      ticket: s.ticket,
      username: s.username ?? s.name,
      sessionToken: s.sessionToken ?? null,
      ...(s.chipBalance !== undefined ? { chipBalance: s.chipBalance } : {}),
      ...(s.whuffieBalance !== undefined ? { whuffieBalance: s.whuffieBalance } : {}),
    }),
  clearSession: () =>
    set({
      userId: null,
      username: null,
      name: null,
      ticket: null,
      sessionToken: null,
      chipBalance: null,
      whuffieBalance: null,
      cardThemeId: null,
      connection: 'idle',
      ...clearedTable,
      ...clearedArcade,
      chat: [],
      lastError: null,
      lastErrorCode: null,
      emojiBurst: null,
      actionBurst: null,
      social: null,
      socialLoaded: false,
      myContests: [],
      contestById: {},
      contestEvent: null,
    }),
  setConnection: (connection) => set({ connection }),
  bindTable: (boundTableId) =>
    set(
      boundTableId
        ? {
            boundTableId,
            ...clearedArcade,
          }
        : { boundTableId },
    ),
  bindLudo: (boundLudoId) =>
    set(
      boundLudoId
        ? {
            boundLudoId,
            boundSnakesId: null,
            boundMemoryId: null,
            boundCourtpieceId: null,
            ...clearedTable,
            snakes: null,
            snakesYou: null,
            memory: null,
            memoryYou: null,
            courtpiece: null,
            courtpieceYou: null,
            ludo: null,
            ludoYou: null,
            ludoLegalMoves: [],
            chat: [],
            lastError: null,
            lastErrorCode: null,
          }
        : { boundLudoId },
    ),
  bindSnakes: (boundSnakesId) =>
    set(
      boundSnakesId
        ? {
            boundSnakesId,
            boundLudoId: null,
            boundMemoryId: null,
            boundCourtpieceId: null,
            ...clearedTable,
            ludo: null,
            ludoYou: null,
            ludoLegalMoves: [],
            memory: null,
            memoryYou: null,
            courtpiece: null,
            courtpieceYou: null,
            snakes: null,
            snakesYou: null,
            chat: [],
            lastError: null,
            lastErrorCode: null,
          }
        : { boundSnakesId },
    ),
  bindMemory: (boundMemoryId) =>
    set(
      boundMemoryId
        ? {
            boundMemoryId,
            boundLudoId: null,
            boundSnakesId: null,
            boundCourtpieceId: null,
            ...clearedTable,
            ludo: null,
            ludoYou: null,
            ludoLegalMoves: [],
            snakes: null,
            snakesYou: null,
            courtpiece: null,
            courtpieceYou: null,
            memory: null,
            memoryYou: null,
            chat: [],
            lastError: null,
            lastErrorCode: null,
          }
        : { boundMemoryId },
    ),
  bindCourtpiece: (boundCourtpieceId) =>
    set(
      boundCourtpieceId
        ? {
            boundCourtpieceId,
            boundLudoId: null,
            boundSnakesId: null,
            boundMemoryId: null,
            ...clearedTable,
            ludo: null,
            ludoYou: null,
            ludoLegalMoves: [],
            snakes: null,
            snakesYou: null,
            memory: null,
            memoryYou: null,
            courtpiece: null,
            courtpieceYou: null,
            chat: [],
            lastError: null,
            lastErrorCode: null,
          }
        : { boundCourtpieceId },
    ),
  applyStateSync: (table, priv) =>
    set((prev) => {
      if (
        prev.boundLudoId ||
        prev.boundSnakesId ||
        prev.boundMemoryId ||
        prev.boundCourtpieceId
      ) {
        return prev;
      }
      if (prev.boundTableId && table.tableId !== prev.boundTableId) {
        return prev;
      }
      if (prev.table && prev.table.tableId !== table.tableId) {
        return prev;
      }
      if (prev.table && table.version < prev.table.version) {
        return prev;
      }
      return { table, private: priv };
    }),
  applyLudoStateSync: (ludo, you, legalMoves) =>
    set((prev) => {
      if (
        prev.boundTableId ||
        prev.boundSnakesId ||
        prev.boundMemoryId ||
        prev.boundCourtpieceId
      ) {
        return prev;
      }
      if (prev.boundLudoId && ludo.id !== prev.boundLudoId) return prev;
      if (prev.ludo && prev.ludo.id !== ludo.id) return prev;
      if (prev.ludo && ludo.seq < prev.ludo.seq) return prev;
      return {
        ludo,
        ludoYou: you,
        ludoLegalMoves: legalMoves ?? [],
      };
    }),
  applySnakesStateSync: (snakes, you) =>
    set((prev) => {
      if (
        prev.boundTableId ||
        prev.boundLudoId ||
        prev.boundMemoryId ||
        prev.boundCourtpieceId
      ) {
        return prev;
      }
      if (prev.boundSnakesId && snakes.id !== prev.boundSnakesId) return prev;
      if (prev.snakes && prev.snakes.id !== snakes.id) return prev;
      if (prev.snakes && snakes.seq < prev.snakes.seq) return prev;
      return { snakes, snakesYou: you };
    }),
  applyMemoryStateSync: (memory, you) =>
    set((prev) => {
      if (
        prev.boundTableId ||
        prev.boundLudoId ||
        prev.boundSnakesId ||
        prev.boundCourtpieceId
      ) {
        return prev;
      }
      if (prev.boundMemoryId && memory.id !== prev.boundMemoryId) return prev;
      if (prev.memory && prev.memory.id !== memory.id) return prev;
      if (prev.memory && memory.seq < prev.memory.seq) return prev;
      return { memory, memoryYou: you };
    }),
  applyCourtpieceStateSync: (courtpiece, you) =>
    set((prev) => {
      if (
        prev.boundTableId ||
        prev.boundLudoId ||
        prev.boundSnakesId ||
        prev.boundMemoryId
      ) {
        return prev;
      }
      if (prev.boundCourtpieceId && courtpiece.id !== prev.boundCourtpieceId) return prev;
      if (prev.courtpiece && prev.courtpiece.id !== courtpiece.id) return prev;
      if (prev.courtpiece && courtpiece.seq < prev.courtpiece.seq) return prev;
      return { courtpiece, courtpieceYou: you };
    }),
  clearTable: () =>
    set({
      table: null,
      private: null,
      chat: [],
      lastError: null,
      lastErrorCode: null,
      actionBurst: null,
      boundTableId: null,
    }),
  clearLudo: () =>
    set({
      ludo: null,
      ludoYou: null,
      ludoLegalMoves: [],
      chat: [],
      lastError: null,
      lastErrorCode: null,
      boundLudoId: null,
    }),
  clearSnakes: () =>
    set({
      snakes: null,
      snakesYou: null,
      chat: [],
      lastError: null,
      lastErrorCode: null,
      boundSnakesId: null,
    }),
  clearMemory: () =>
    set({
      memory: null,
      memoryYou: null,
      chat: [],
      lastError: null,
      lastErrorCode: null,
      boundMemoryId: null,
    }),
  clearCourtpiece: () =>
    set({
      courtpiece: null,
      courtpieceYou: null,
      chat: [],
      lastError: null,
      lastErrorCode: null,
      boundCourtpieceId: null,
    }),
  pushChat: (m) => set((s) => ({ chat: [...s.chat.slice(-80), m] })),
  setError: (lastError, code = null) => set({ lastError, lastErrorCode: lastError ? code : null }),
  setEmoji: (emojiBurst) => set({ emojiBurst }),
  setActionBurst: (actionBurst) => set({ actionBurst }),
  setChipBalance: (chipBalance) => set({ chipBalance }),
  setWhuffieBalance: (whuffieBalance) => set({ whuffieBalance }),
  setCardThemeId: (cardThemeId) => set({ cardThemeId }),
  applyPublicTables: (publicTables) => set({ publicTables }),
  applyPublicContests: (publicContests) => set({ publicContests }),
  applyMyContests: (myContests) => set({ myContests }),
  applySocial: (social) =>
    set({
      social: {
        friends: social.friends ?? [],
        incoming: social.incoming ?? [],
        outgoing: social.outgoing ?? [],
        pendingChallenges: social.pendingChallenges ?? [],
        outgoingChallenges: social.outgoingChallenges ?? [],
        groups: social.groups ?? [],
      },
      socialLoaded: true,
    }),
  applyContestSync: (contest) =>
    set((s) => ({
      contestById: { ...s.contestById, [contest.id]: contest },
    })),
  applyContestEvent: (ev) =>
    set({
      contestEvent: { ...ev, at: Date.now() },
    }),
  clearContestWatch: (contestId) =>
    set((s) => {
      const next = { ...s.contestById };
      delete next[contestId];
      return { contestById: next };
    }),
}));
