import { authedFetch } from './client';

export type UploadHandPayload = {
  tableId: string;
  handId: string;
  startedAt: number;
  endedAt: number;
  contestId?: string | null;
  source: 'offline';
  result: unknown;
  chat?: Array<{ at: number; userId: string; name: string; text: string; kind?: string }>;
};

export async function uploadOfflineHand(sessionToken: string, body: UploadHandPayload) {
  return authedFetch('/api/history/hands', {
    sessionToken,
    method: 'POST',
    body,
  }) as Promise<{ ok: true; inserted: boolean }>;
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

export async function fetchMyHands(sessionToken: string, limit = 50) {
  const n = Math.max(1, Math.min(200, Math.floor(limit)));
  return authedFetch(`/api/me/hands?limit=${n}`, { sessionToken }) as Promise<{
    hands: MyHandRow[];
  }>;
}
