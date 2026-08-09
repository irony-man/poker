/** Client session helpers for username/password auth. */

export const FELT_SESSION_KEY = 'felt-session';

/** Locally persisted auth fields (chipBalance is refreshed from the server). */
export type StoredSession = {
  userId: string;
  username: string;
  name: string;
  ticket: string;
  sessionToken: string;
  avatarId?: number;
  chipBalance?: number;
};

export function readStoredSession(): StoredSession | null {
  if (typeof localStorage === 'undefined') return null;
  const raw = localStorage.getItem(FELT_SESSION_KEY);
  if (!raw) return null;
  try {
    const s = JSON.parse(raw) as Partial<StoredSession>;
    if (!s.userId || !s.sessionToken || !s.ticket || !s.name) return null;
    return {
      userId: s.userId,
      username: s.username ?? s.name,
      name: s.name,
      ticket: s.ticket,
      sessionToken: s.sessionToken,
      avatarId: s.avatarId,
      ...(typeof s.chipBalance === 'number' ? { chipBalance: s.chipBalance } : {}),
    };
  } catch {
    return null;
  }
}

export function writeStoredSession(session: StoredSession): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(FELT_SESSION_KEY, JSON.stringify(session));
}

export function clearStoredSession(): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.removeItem(FELT_SESSION_KEY);
}
