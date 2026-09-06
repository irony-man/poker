import type { CreateTableBody } from '@poker/protocol';
import { apiBase, authedFetch, parseError, sessionHeaders, type AuthOptions } from './client';

export async function createTable(input: CreateTableBody, sessionToken: string) {
  const res = await fetch(`${apiBase()}/api/tables`, {
    method: 'POST',
    headers: sessionHeaders(sessionToken),
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    throw new Error(await parseError(res, 'Failed to create table'));
  }
  return res.json() as Promise<{
    tableId: string;
    inviteCode: string;
    name: string;
    config: {
      maxSeats: number;
      smallBlind: number;
      bigBlind: number;
      buyIn: number;
      turnTimeMs: number;
    };
    inviteCount?: number;
  }>;
}

export async function inviteTableFriends(
  tableId: string,
  friendUserIds: string[],
  options: AuthOptions,
) {
  return authedFetch(`/api/tables/${tableId}/invite-friends`, {
    ...options,
    method: 'POST',
    body: { friendUserIds },
  }) as Promise<{ inviteCount: number; challengeIds: string[] }>;
}

export interface PublicTableSummary {
  tableId: string;
  inviteCode: string;
  name: string;
  stakeId: string;
  seatedCount: number;
  maxSeats: number;
  config: {
    maxSeats: number;
    smallBlind: number;
    bigBlind: number;
    buyIn: number;
    turnTimeMs: number;
  };
}

export async function listPublicTables() {
  const res = await fetch(`${apiBase()}/api/tables`);
  if (!res.ok) throw new Error('Failed to load tables');
  return res.json() as Promise<{ tables: PublicTableSummary[] }>;
}

export async function resolveInvite(code: string) {
  const res = await fetch(`${apiBase()}/api/tables/invite/${code}`);
  if (!res.ok) throw new Error('Invite not found');
  return res.json() as Promise<{
    tableId: string;
    inviteCode: string;
    name: string;
    config: {
      maxSeats: number;
      smallBlind: number;
      bigBlind: number;
      buyIn: number;
      turnTimeMs: number;
    };
  }>;
}
