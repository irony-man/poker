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

export interface HandHistoryRow {
  id: string;
  tableId: string;
  handId: string;
  startedAt: Date;
  endedAt: Date | null;
  resultJson: string;
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
