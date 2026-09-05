import type { CreateLudoBody } from '@poker/protocol';
import { API_URL, parseError, sessionHeaders, type AuthOptions, authedFetch } from './client';

export interface CreateLudoResult {
  ludoId: string;
  inviteCode: string;
  name: string;
  maxSeats: number;
  inviteCount?: number;
}

export interface LudoInviteResult {
  ludoId: string;
  inviteCode: string;
  name: string;
  maxSeats: number;
}

export interface LudoChatLine {
  userId: string;
  name: string;
  text: string;
  at: number;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null;
}

function pickLudoId(raw: Record<string, unknown>): string {
  const nested = asRecord(raw.ludo);
  const id = nested?.ludoId ?? nested?.id ?? raw.ludoId ?? raw.id;
  return typeof id === 'string' ? id : '';
}

function pickString(raw: Record<string, unknown>, key: string, fallback = ''): string {
  const nested = asRecord(raw.ludo);
  const value = nested?.[key] ?? raw[key];
  return typeof value === 'string' ? value : fallback;
}

function pickMaxSeats(raw: Record<string, unknown>): number {
  const nested = asRecord(raw.ludo);
  const value = nested?.maxSeats ?? raw.maxSeats;
  return typeof value === 'number' && value >= 2 && value <= 4 ? value : 4;
}

export async function createLudo(input: CreateLudoBody, sessionToken: string) {
  const res = await fetch(`${API_URL}/api/ludo`, {
    method: 'POST',
    headers: sessionHeaders(sessionToken),
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    throw new Error(await parseError(res, 'Failed to create Ludo board'));
  }
  const raw = asRecord(await res.json()) ?? {};
  const ludoId = pickLudoId(raw);
  if (!ludoId) throw new Error('Failed to create Ludo board');
  return {
    ludoId,
    inviteCode: pickString(raw, 'inviteCode'),
    name: pickString(raw, 'name', 'Ludo'),
    maxSeats: pickMaxSeats(raw),
    inviteCount: typeof raw.inviteCount === 'number' ? raw.inviteCount : undefined,
  } satisfies CreateLudoResult;
}

export async function resolveLudoInvite(code: string) {
  const res = await fetch(`${API_URL}/api/ludo/invite/${encodeURIComponent(code)}`);
  if (!res.ok) throw new Error('Invite not found');
  const raw = asRecord(await res.json()) ?? {};
  const ludoId = pickLudoId(raw);
  if (!ludoId) throw new Error('Invite not found');
  return {
    ludoId,
    inviteCode: pickString(raw, 'inviteCode', code),
    name: pickString(raw, 'name', 'Ludo'),
    maxSeats: pickMaxSeats(raw),
  } satisfies LudoInviteResult;
}

export async function fetchLudoChat(ludoId: string, options?: AuthOptions) {
  if (options?.sessionToken) {
    return authedFetch(`/api/ludo/${ludoId}/chat`, options) as Promise<{ messages: LudoChatLine[] }>;
  }
  const res = await fetch(`${API_URL}/api/ludo/${encodeURIComponent(ludoId)}/chat`);
  if (!res.ok) throw new Error(await parseError(res, 'Failed to load chat'));
  return res.json() as Promise<{ messages: LudoChatLine[] }>;
}
