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
  config: {
    maxSeats: number;
    smallBlind: number;
    bigBlind: number;
    minBuyIn: number;
    maxBuyIn: number;
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
  name: string | null;
  ticket: string | null;
  connection: 'idle' | 'connecting' | 'open' | 'closed';
  table: PublicTable | null;
  private: PrivateView | null;
  chat: ChatMessage[];
  lastError: string | null;
  emojiBurst: { emoji: string; name: string; at: number } | null;
  setSession: (s: { userId: string; name: string; ticket: string }) => void;
  setConnection: (c: SessionState['connection']) => void;
  applyStateSync: (table: PublicTable, priv: PrivateView | null) => void;
  clearTable: () => void;
  pushChat: (m: ChatMessage) => void;
  setError: (e: string | null) => void;
  setEmoji: (e: { emoji: string; name: string; at: number } | null) => void;
}

export const useSession = create<SessionState>((set) => ({
  userId: null,
  name: null,
  ticket: null,
  connection: 'idle',
  table: null,
  private: null,
  chat: [],
  lastError: null,
  emojiBurst: null,
  setSession: (s) => set(s),
  setConnection: (connection) => set({ connection }),
  applyStateSync: (table, priv) =>
    set((prev) => {
      if (prev.table && prev.table.tableId !== table.tableId) {
        return { table, private: priv, chat: [] };
      }
      if (prev.table && table.version < prev.table.version) return prev;
      return { table, private: priv };
    }),
  clearTable: () => set({ table: null, private: null, chat: [], lastError: null }),
  pushChat: (m) => set((s) => ({ chat: [...s.chat.slice(-80), m] })),
  setError: (lastError) => set({ lastError }),
  setEmoji: (emojiBurst) => set({ emojiBurst }),
}));
