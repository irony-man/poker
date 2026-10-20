import { authedFetch } from './client';

export type UploadHandPayload = {
  tableId: string;
  handId: string;
  startedAt: number;
  endedAt: number;
  contestId?: string | null;
  source: 'offline';
  botGroupId?: string | null;
  gameComplete?: boolean;
  result: unknown;
  chat?: Array<{ at: number; userId: string; name: string; text: string; kind?: string }>;
};

export type UploadHandResponse = {
  ok: true;
  inserted: boolean;
  whuffiesAwarded?: number;
  whuffieBalance?: number;
};

export async function uploadOfflineHand(sessionToken: string, body: UploadHandPayload) {
  return authedFetch('/api/history/hands', {
    sessionToken,
    method: 'POST',
    body,
  }) as Promise<UploadHandResponse>;
}

export type MyHandRow = {
  id: string;
  tableId: string;
  handId: string;
  contestId: string | null;
  source: string;
  startedAt: string;
  endedAt: string | null;
  resultJson: string | Record<string, unknown>;
};

export type AnalysisHandsQuery = {
  tableId?: string;
  since?: number;
  before?: number;
  limit?: number;
  /** Only hands vs bots (incl. offline) or vs other players. */
  opponents?: 'bots' | 'players';
};

function analysisSearch(query: AnalysisHandsQuery): string {
  const params = new URLSearchParams();
  if (query.tableId) params.set('tableId', query.tableId);
  if (query.opponents) params.set('opponents', query.opponents);
  if (query.since !== undefined) params.set('since', String(Math.floor(query.since)));
  if (query.before !== undefined) params.set('before', String(Math.floor(query.before)));
  if (query.limit !== undefined) params.set('limit', String(Math.floor(query.limit)));
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

export async function fetchAnalysisHands(sessionToken: string, query: AnalysisHandsQuery = {}) {
  return authedFetch(`/api/me/analysis/hands${analysisSearch(query)}`, { sessionToken }) as Promise<{
    hands: MyHandRow[];
    nextBefore: number | null;
  }>;
}

export type AnalysisTableRow = {
  tableId: string;
  source: string;
  opponents: 'bots' | 'players';
  firstAt: number;
  lastAt: number;
  hands: number;
  handsWon: number;
  /** Other players dealt in at this table. */
  players: { userId: string; name: string; isBot: boolean }[];
  /** A coaching review has already been saved for this table. */
  coached?: boolean;
};

export async function fetchAnalysisTables(
  sessionToken: string,
  query: Omit<AnalysisHandsQuery, 'tableId' | 'since'> = {},
) {
  return authedFetch(`/api/me/analysis/tables${analysisSearch(query)}`, { sessionToken }) as Promise<{
    tables: AnalysisTableRow[];
    nextBefore: number | null;
  }>;
}

export type CoachQuota = {
  limit: number;
  used: number;
  remaining: number;
  reviews: Record<string, string>;
  summary: string;
};

export async function fetchCoachQuota(sessionToken: string, tableId?: string) {
  const qs = tableId ? `?tableId=${encodeURIComponent(tableId)}` : '';
  return authedFetch(`/api/me/analysis/coach/quota${qs}`, {
    sessionToken,
    silent: true,
  }) as Promise<CoachQuota>;
}

export async function requestTableCoach(sessionToken: string, tableId: string) {
  return authedFetch('/api/me/analysis/coach', {
    sessionToken,
    method: 'POST',
    body: { tableId },
    silent: true,
  }) as Promise<CoachQuota & { cached: boolean }>;
}

export async function fetchMyHands(sessionToken: string, limit = 50) {
  const n = Math.max(1, Math.min(200, Math.floor(limit)));
  return authedFetch(`/api/me/hands?limit=${n}`, { sessionToken }) as Promise<{
    hands: MyHandRow[];
  }>;
}
