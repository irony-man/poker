'use client';

import type {
  PrivateView as EnginePrivateView,
  PublicPlayerView,
  PublicTableView,
} from '@poker/engine';
import { create } from 'zustand';
import type {
  ContestView,
  FriendGroup,
  FriendProfile,
  PendingChallenge,
  PendingRequest,
  PublicTableSummary,
} from '@/lib/api';

export type PublicPlayer = PublicPlayerView & {
  /** Preset profile picture index (0–7). */
  avatarId?: number | null;
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
  pendingChallenges: PendingChallenge[];
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
  table: PublicTable | null;
  private: PrivateView | null;
  chat: ChatMessage[];
  lastError: string | null;
  lastErrorCode: string | null;
  emojiBurst: { emoji: string; name: string; at: number } | null;
  /** Last poker action shown as a seat popup. */
  actionBurst: { seat: number; label: string; at: number } | null;
  /** Global chip bankroll (updated via wallet_update / auth_ok / /api/me). */
  chipBalance: number | null;
  /** Contest ranking rating (Whuffies). */
  whuffieBalance: number | null;

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
  applyStateSync: (table: PublicTable, priv: PrivateView | null) => void;
  clearTable: () => void;
  pushChat: (m: ChatMessage) => void;
  setError: (e: string | null, code?: string | null) => void;
  setEmoji: (e: { emoji: string; name: string; at: number } | null) => void;
  setActionBurst: (e: { seat: number; label: string; at: number } | null) => void;
  setChipBalance: (balance: number | null) => void;
  setWhuffieBalance: (balance: number | null) => void;
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

export const useSession = create<SessionState>((set) => ({
  userId: null,
  username: null,
  name: null,
  ticket: null,
  sessionToken: null,
  connection: 'idle',
  boundTableId: null,
  table: null,
  private: null,
  chat: [],
  lastError: null,
  lastErrorCode: null,
  emojiBurst: null,
  actionBurst: null,
  chipBalance: null,
  whuffieBalance: null,
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
      connection: 'idle',
      boundTableId: null,
      table: null,
      private: null,
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
  bindTable: (boundTableId) => set({ boundTableId }),
  applyStateSync: (table, priv) =>
    set((prev) => {
      // Never apply state for a table the socket isn't currently bound to.
      if (prev.boundTableId && table.tableId !== prev.boundTableId) {
        return prev;
      }
      // If we already show a different table, ignore cross-table packets (stale reconnect).
      if (prev.table && prev.table.tableId !== table.tableId) {
        return prev;
      }
      // Ignore out-of-order / older versions for the same table.
      if (prev.table && table.version < prev.table.version) {
        return prev;
      }
      return { table, private: priv };
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
  pushChat: (m) => set((s) => ({ chat: [...s.chat.slice(-80), m] })),
  setError: (lastError, code = null) => set({ lastError, lastErrorCode: lastError ? code : null }),
  setEmoji: (emojiBurst) => set({ emojiBurst }),
  setActionBurst: (actionBurst) => set({ actionBurst }),
  setChipBalance: (chipBalance) => set({ chipBalance }),
  setWhuffieBalance: (whuffieBalance) => set({ whuffieBalance }),
  applyPublicTables: (publicTables) => set({ publicTables }),
  applyPublicContests: (publicContests) => set({ publicContests }),
  applyMyContests: (myContests) => set({ myContests }),
  applySocial: (social) => set({ social, socialLoaded: true }),
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
