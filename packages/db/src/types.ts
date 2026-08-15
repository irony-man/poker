/** Row shapes used by history/list APIs (camelCase). */

export interface UserRow {
  id: string;
  name: string;
  username: string | null;
  usernameLower: string | null;
  passwordHash: string | null;
  avatarId: number;
  chipBalance: number;
  whuffieBalance: number;
  handsPlayed: number;
  createdAt: Date;
}

export interface TableRowRow {
  id: string;
  inviteCode: string;
  name: string;
  smallBlind: number;
  bigBlind: number;
  buyIn: number;
  turnTimeMs: number;
  maxSeats: number;
  isPrivate: boolean;
  hostUserId: string;
  createdAt: Date;
}

export type { HandHistorySource, ChatMessageKind } from './entities.js';

export interface HandHistoryRow {
  id: string;
  tableId: string;
  handId: string;
  contestId: string | null;
  source: import('./entities.js').HandHistorySource;
  startedAt: Date;
  endedAt: Date | null;
  resultJson: string;
}

export interface ChatMessageRow {
  id: string;
  tableId: string;
  contestId: string | null;
  handId: string | null;
  userId: string;
  name: string;
  text: string;
  at: Date;
  kind: import('./entities.js').ChatMessageKind;
  source: import('./entities.js').HandHistorySource;
}

export type { ChipLedgerReason } from './entities.js';

export interface ChipLedgerRow {
  id: string;
  userId: string;
  tableId: string;
  delta: number;
  reason: import('./entities.js').ChipLedgerReason;
  createdAt: Date;
}

export interface TableChipBalanceRow {
  userId: string;
  tableId: string;
  stack: number;
  updatedAt: Date;
}
