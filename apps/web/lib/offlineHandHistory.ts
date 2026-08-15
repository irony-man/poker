import type { EngineEvent, HandState } from '@poker/engine';
import { uploadOfflineHand, type UploadHandPayload } from './api/history';
import { readStoredSession } from './session';

const QUEUE_KEY = 'felt-offline-hand-queue';
const MAX_QUEUE = 40;

export type OfflineChatLine = {
  at: number;
  userId: string;
  name: string;
  text: string;
};

function readQueue(): UploadHandPayload[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as UploadHandPayload[]) : [];
  } catch {
    return [];
  }
}

function writeQueue(items: UploadHandPayload[]): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(QUEUE_KEY, JSON.stringify(items.slice(-MAX_QUEUE)));
}

export function enqueueOfflineHand(payload: UploadHandPayload): void {
  writeQueue([...readQueue(), payload]);
}

export function buildOfflineHandResult(
  state: HandState,
  actions: Array<EngineEvent & { at: number }>,
  chat: OfflineChatLine[],
) {
  return {
    winners: state.winners,
    community: state.community,
    players: state.players.map((p) => ({
      seat: p.seat,
      userId: p.userId,
      name: p.name,
      stack: p.stack,
      revealed: p.revealed,
      holeCards: p.holeCards,
    })),
    actions,
    chat,
  };
}

export async function submitOfflineHand(payload: UploadHandPayload): Promise<void> {
  const session = readStoredSession();
  if (!session?.sessionToken) return;
  try {
    await uploadOfflineHand(session.sessionToken, payload);
  } catch {
    enqueueOfflineHand(payload);
  }
}

export async function flushOfflineHandQueue(): Promise<void> {
  const session = readStoredSession();
  if (!session?.sessionToken) return;
  const items = readQueue();
  if (items.length === 0) return;
  const remaining: UploadHandPayload[] = [];
  for (const item of items) {
    try {
      await uploadOfflineHand(session.sessionToken, item);
    } catch {
      remaining.push(item);
    }
  }
  writeQueue(remaining);
}

export function newOfflineTableId(userId: string | null | undefined): string {
  const who = userId && userId !== 'offline-human' ? userId : 'anon';
  const rand =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `offline-${who}-${rand}`;
}
