'use client';

import { create } from 'zustand';

export interface PublicPlayer {
  seat: number;
  userId: string | null;
  name: string | null;
  stack: number;
  bet: number;
  status: string;
  hasCards: boolean;
  holeCards: [string, string] | null;
  /** Preset profile picture index (0–7). */
  avatarId?: number | null;
  /** Between hands on cash tables: opted in for next deal (bots always true). */
  ready?: boolean;
}

export interface PublicTable {
  tableId: string;
  handId: string;
  street: string;
  community: string[];
  players: PublicPlayer[];
  dealerButton: number;
  sbSeat: number;
  bbSeat: number;
  toAct: number | null;
  currentBet: number;
  pot: number;
  sidePots: { amount: number; eligible: number[] }[];
  actionSeq: number;
  version: number;
  winners: { seat: number; amount: number; handName?: string }[];
  showdownHands?: { seat: number; handName: string; cards?: string[] }[];
  /** Epoch ms when current turn expires (server clock). */
  turnEndsAt?: number | null;
  /** Table creator (cash host). */
  hostUserId?: string | null;
  /** Present on tournament tables. */
  tournament?: {
    contestId: string;
    mode: 'knockout' | 'table_match';
    matchId: string | null;
    frozen: boolean;
    noTopUp: boolean;
  } | null;
  config: {
    maxSeats: number;
    smallBlind: number;
    bigBlind: number;
    buyIn: number;
    turnTimeMs: number;
  };
}

export interface PrivateView {
  seat: number;
  holeCards: [string, string] | null;
  legal: {
    types: string[];
    callAmount: number;
    minRaiseTo: number;
    maxRaiseTo: number;
  };
}

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
  setSession: (s: {
    userId: string;
    name: string;
    ticket: string;
    username?: string;
    sessionToken?: string;
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
  setSession: (s) =>
    set({
      userId: s.userId,
      name: s.name,
      ticket: s.ticket,
      username: s.username ?? s.name,
      sessionToken: s.sessionToken ?? null,
    }),
  clearSession: () =>
    set({
      userId: null,
      username: null,
      name: null,
      ticket: null,
      sessionToken: null,
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
}));
