'use client';

import type {
  PrivateView as EnginePrivateView,
  PublicPlayerView,
  PublicTableView,
} from '@poker/engine';
import { create } from 'zustand';

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
  /** Present on tournament tables. */
  tournament?: {
    contestId: string;
    mode: 'rounds' | 'chips';
    matchId: string | null;
    frozen: boolean;
    noTopUp: boolean;
  } | null;
};

export type PrivateView = EnginePrivateView;

export interface ChatMessage {
  userId: string;
  name: string;
  text: string;
  at: number;
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
  /** Global bankroll (Wuffies) (updated via wallet_update / auth_ok / /api/me). */
  chipBalance: number | null;
  setSession: (s: {
    userId: string;
    name: string;
    ticket: string;
    username?: string;
    sessionToken?: string;
    chipBalance?: number;
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
  setSession: (s) =>
    set({
      userId: s.userId,
      name: s.name,
      ticket: s.ticket,
      username: s.username ?? s.name,
      sessionToken: s.sessionToken ?? null,
      ...(s.chipBalance !== undefined ? { chipBalance: s.chipBalance } : {}),
    }),
  clearSession: () =>
    set({
      userId: null,
      username: null,
      name: null,
      ticket: null,
      sessionToken: null,
      chipBalance: null,
      connection: 'idle',
      boundTableId: null,
      table: null,
      private: null,
      chat: [],
      lastError: null,
      lastErrorCode: null,
      emojiBurst: null,
      actionBurst: null,
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
}));
