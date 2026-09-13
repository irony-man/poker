import type { CreateCourtpieceBody, CourtpieceRulesVariant } from '@poker/protocol';
import { apiBase, parseError, sessionHeaders, type AuthOptions, authedFetch } from './client';

export interface CreateCourtpieceResult {
  courtpieceId: string;
  inviteCode: string;
  name: string;
  maxSeats: number;
  rulesVariant: CourtpieceRulesVariant;
  inviteCount?: number;
}

export interface CourtpieceInviteResult {
  courtpieceId: string;
  inviteCode: string;
  name: string;
  maxSeats: number;
  rulesVariant: CourtpieceRulesVariant;
}

export interface CourtpieceChatLine {
  userId: string;
  name: string;
  text: string;
  at: number;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null;
}

function pickId(raw: Record<string, unknown>): string {
  const nested = asRecord(raw.courtpiece);
  const id = nested?.courtpieceId ?? nested?.id ?? raw.courtpieceId ?? raw.id;
  return typeof id === 'string' ? id : '';
}

function pickString(raw: Record<string, unknown>, key: string, fallback = ''): string {
  const nested = asRecord(raw.courtpiece);
  const value = nested?.[key] ?? raw[key];
  return typeof value === 'string' ? value : fallback;
}

function pickVariant(raw: Record<string, unknown>): CourtpieceRulesVariant {
  const nested = asRecord(raw.courtpiece);
  const value = nested?.rulesVariant ?? raw.rulesVariant;
  if (value === 'classic_full' || value === 'hokm') return value;
  return 'classic';
}

export async function createCourtpiece(input: CreateCourtpieceBody, sessionToken: string) {
  const res = await fetch(`${apiBase()}/api/courtpiece`, {
    method: 'POST',
    headers: sessionHeaders(sessionToken),
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    throw new Error(await parseError(res, 'Failed to create Court Piece board'));
  }
  const raw = asRecord(await res.json()) ?? {};
  const courtpieceId = pickId(raw);
  if (!courtpieceId) throw new Error('Failed to create Court Piece board');
  return {
    courtpieceId,
    inviteCode: pickString(raw, 'inviteCode'),
    name: pickString(raw, 'name', 'Court Piece'),
    maxSeats: 4,
    rulesVariant: pickVariant(raw),
    inviteCount: typeof raw.inviteCount === 'number' ? raw.inviteCount : undefined,
  } satisfies CreateCourtpieceResult;
}

export async function resolveCourtpieceInvite(code: string) {
  const res = await fetch(`${apiBase()}/api/courtpiece/invite/${encodeURIComponent(code)}`);
  if (!res.ok) throw new Error('Invite not found');
  const raw = asRecord(await res.json()) ?? {};
  const courtpieceId = pickId(raw);
  if (!courtpieceId) throw new Error('Invite not found');
  return {
    courtpieceId,
    inviteCode: pickString(raw, 'inviteCode', code),
    name: pickString(raw, 'name', 'Court Piece'),
    maxSeats: 4,
    rulesVariant: pickVariant(raw),
  } satisfies CourtpieceInviteResult;
}

export async function fetchCourtpieceChat(courtpieceId: string, options?: AuthOptions) {
  if (options?.sessionToken) {
    return authedFetch(`/api/courtpiece/${courtpieceId}/chat`, options) as Promise<{
      messages: CourtpieceChatLine[];
    }>;
  }
  const res = await fetch(`${apiBase()}/api/courtpiece/${encodeURIComponent(courtpieceId)}/chat`);
  if (!res.ok) throw new Error(await parseError(res, 'Failed to load chat'));
  return res.json() as Promise<{ messages: CourtpieceChatLine[] }>;
}
