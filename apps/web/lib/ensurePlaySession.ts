import {
  clearStoredSession,
  readStoredSession,
  writeStoredSession,
  type StoredSession,
} from '@/lib/session';
import { useSession } from '@/lib/store';

/** Apply a play session into zustand + localStorage. */
export function applyPlaySession(session: StoredSession): void {
  writeStoredSession(session);
  useSession.getState().setSession({
    userId: session.userId,
    username: session.username,
    name: session.name,
    ticket: session.ticket,
    sessionToken: session.sessionToken,
    ...(typeof session.chipBalance === 'number' ? { chipBalance: session.chipBalance } : {}),
    ...(typeof session.whuffieBalance === 'number' ? { whuffieBalance: session.whuffieBalance } : {}),
  });
}

/**
 * Hydrate the play session from local storage (no network).
 * Stale WS tickets are recovered in `ws.ts` via bad_auth → /api/ticket.
 */
export async function ensurePlaySession(): Promise<StoredSession> {
  const stored = readStoredSession();
  if (!stored) {
    throw new Error('Sign in required');
  }
  applyPlaySession(stored);
  return stored;
}

/** Clear local auth after a fatal session failure. */
export function wipePlaySession(): void {
  clearStoredSession();
  useSession.getState().clearSession();
}
