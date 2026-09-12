import type { CreateMemoryBody } from '@poker/protocol';
import { apiBase, parseError, sessionHeaders, type AuthOptions, authedFetch } from './client';

export interface CreateMemoryResult {
  memoryId: string;
  inviteCode: string;
  name: string;
  maxSeats: number;
  gridSize: 16 | 36;
  inviteCount?: number;
}

export interface MemoryInviteResult {
  memoryId: string;
  inviteCode: string;
  name: string;
  maxSeats: number;
  gridSize: 16 | 36;
}

export interface MemoryChatLine {
  userId: string;
  name: string;
  text: string;
  at: number;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null;
}

function pickMemoryId(raw: Record<string, unknown>): string {
  const nested = asRecord(raw.memory);
  const id = nested?.memoryId ?? nested?.id ?? raw.memoryId ?? raw.id;
  return typeof id === 'string' ? id : '';
}

function pickString(raw: Record<string, unknown>, key: string, fallback = ''): string {
  const nested = asRecord(raw.memory);
  const value = nested?.[key] ?? raw[key];
  return typeof value === 'string' ? value : fallback;
}

function pickMaxSeats(raw: Record<string, unknown>): number {
  const nested = asRecord(raw.memory);
  const value = nested?.maxSeats ?? raw.maxSeats;
  return typeof value === 'number' && value >= 2 && value <= 4 ? value : 2;
}

function pickGridSize(raw: Record<string, unknown>): 16 | 36 {
  const nested = asRecord(raw.memory);
  const value = nested?.gridSize ?? raw.gridSize;
  return value === 36 ? 36 : 16;
}

export async function createMemory(input: CreateMemoryBody, sessionToken: string) {
  const res = await fetch(`${apiBase()}/api/memory`, {
    method: 'POST',
    headers: sessionHeaders(sessionToken),
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    throw new Error(await parseError(res, 'Failed to create Memory board'));
  }
  const raw = asRecord(await res.json()) ?? {};
  const memoryId = pickMemoryId(raw);
  if (!memoryId) throw new Error('Failed to create Memory board');
  return {
    memoryId,
    inviteCode: pickString(raw, 'inviteCode'),
    name: pickString(raw, 'name', 'Memory Match'),
    maxSeats: pickMaxSeats(raw),
    gridSize: pickGridSize(raw),
    inviteCount: typeof raw.inviteCount === 'number' ? raw.inviteCount : undefined,
  } satisfies CreateMemoryResult;
}

export async function resolveMemoryInvite(code: string) {
  const res = await fetch(`${apiBase()}/api/memory/invite/${encodeURIComponent(code)}`);
  if (!res.ok) throw new Error('Invite not found');
  const raw = asRecord(await res.json()) ?? {};
  const memoryId = pickMemoryId(raw);
  if (!memoryId) throw new Error('Invite not found');
  return {
    memoryId,
    inviteCode: pickString(raw, 'inviteCode', code),
    name: pickString(raw, 'name', 'Memory Match'),
    maxSeats: pickMaxSeats(raw),
    gridSize: pickGridSize(raw),
  } satisfies MemoryInviteResult;
}

export async function fetchMemoryChat(memoryId: string, options?: AuthOptions) {
  if (options?.sessionToken) {
    return authedFetch(`/api/memory/${memoryId}/chat`, options) as Promise<{
      messages: MemoryChatLine[];
    }>;
  }
  const res = await fetch(`${apiBase()}/api/memory/${encodeURIComponent(memoryId)}/chat`);
  if (!res.ok) throw new Error(await parseError(res, 'Failed to load chat'));
  return res.json() as Promise<{ messages: MemoryChatLine[] }>;
}
