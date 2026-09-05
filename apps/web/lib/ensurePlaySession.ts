import { refreshTicket } from '@/lib/api';
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
 * Mint a fresh WS ticket from the HTTP session before joining a table/board.
 * Stored tickets can go stale after server restarts even when the session is valid.
 */
export async function ensurePlaySession(): Promise<StoredSession> {
  const stored = readStoredSession();
  if (!stored) {
    throw new Error('Sign in required');
  }

  try {
    const fresh = await refreshTicket(stored.sessionToken);
    const next: StoredSession = {
      userId: fresh.userId,
      username: fresh.username,
      name: fresh.name,
      ticket: fresh.ticket,
      sessionToken: stored.sessionToken,
      avatarId: fresh.avatarId ?? stored.avatarId,
      ...(typeof fresh.chipBalance === 'number' ? { chipBalance: fresh.chipBalance } : {}),
      ...(typeof fresh.whuffieBalance === 'number' ? { whuffieBalance: fresh.whuffieBalance } : {}),
    };
    applyPlaySession(next);
    return next;
  } catch (err) {
    clearStoredSession();
    useSession.getState().clearSession();
    throw err instanceof Error ? err : new Error('Session expired');
  }
}
