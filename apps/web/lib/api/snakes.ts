import type { CreateSnakesBody } from '@poker/protocol';
import { apiBase, parseError, sessionHeaders, type AuthOptions, authedFetch } from './client';

export interface CreateSnakesResult {
  snakesId: string;
  inviteCode: string;
  name: string;
  maxSeats: number;
  inviteCount?: number;
}

export interface SnakesInviteResult {
  snakesId: string;
  inviteCode: string;
  name: string;
  maxSeats: number;
}

export interface SnakesChatLine {
  userId: string;
  name: string;
  text: string;
  at: number;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null;
}

function pickSnakesId(raw: Record<string, unknown>): string {
  const nested = asRecord(raw.snakes);
  const id = nested?.snakesId ?? nested?.id ?? raw.snakesId ?? raw.id;
  return typeof id === 'string' ? id : '';
}

function pickString(raw: Record<string, unknown>, key: string, fallback = ''): string {
  const nested = asRecord(raw.snakes);
  const value = nested?.[key] ?? raw[key];
  return typeof value === 'string' ? value : fallback;
}

function pickMaxSeats(raw: Record<string, unknown>): number {
  const nested = asRecord(raw.snakes);
  const value = nested?.maxSeats ?? raw.maxSeats;
  return typeof value === 'number' && value >= 2 && value <= 4 ? value : 4;
}

export async function createSnakes(input: CreateSnakesBody, sessionToken: string) {
  const res = await fetch(`${apiBase()}/api/snakes`, {
    method: 'POST',
    headers: sessionHeaders(sessionToken),
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    throw new Error(await parseError(res, 'Failed to create Snakes board'));
  }
  const raw = asRecord(await res.json()) ?? {};
  const snakesId = pickSnakesId(raw);
  if (!snakesId) throw new Error('Failed to create Snakes board');
  return {
    snakesId,
    inviteCode: pickString(raw, 'inviteCode'),
    name: pickString(raw, 'name', 'Snakes & Ladders'),
    maxSeats: pickMaxSeats(raw),
    inviteCount: typeof raw.inviteCount === 'number' ? raw.inviteCount : undefined,
  } satisfies CreateSnakesResult;
}

export async function resolveSnakesInvite(code: string) {
  const res = await fetch(`${apiBase()}/api/snakes/invite/${encodeURIComponent(code)}`);
  if (!res.ok) throw new Error('Invite not found');
  const raw = asRecord(await res.json()) ?? {};
  const snakesId = pickSnakesId(raw);
  if (!snakesId) throw new Error('Invite not found');
  return {
    snakesId,
    inviteCode: pickString(raw, 'inviteCode', code),
    name: pickString(raw, 'name', 'Snakes & Ladders'),
    maxSeats: pickMaxSeats(raw),
  } satisfies SnakesInviteResult;
}

export async function fetchSnakesChat(snakesId: string, options?: AuthOptions) {
  if (options?.sessionToken) {
    return authedFetch(`/api/snakes/${snakesId}/chat`, options) as Promise<{
      messages: SnakesChatLine[];
    }>;
  }
  const res = await fetch(`${apiBase()}/api/snakes/${encodeURIComponent(snakesId)}/chat`);
  if (!res.ok) throw new Error(await parseError(res, 'Failed to load chat'));
  return res.json() as Promise<{ messages: SnakesChatLine[] }>;
}
