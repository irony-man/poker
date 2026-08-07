/** Client session helpers for username/password auth. */

export const FELT_SESSION_KEY = 'felt-session';

export interface StoredSession {
  userId: string;
  username: string;
  name: string;
  ticket: string;
  sessionToken: string;
  avatarId?: number;
}

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
    };
  } catch {
    return null;
  }
}

export function writeStoredSession(session: StoredSession): void {
  localStorage.setItem(FELT_SESSION_KEY, JSON.stringify(session));
}

export function clearStoredSession(): void {
  localStorage.removeItem(FELT_SESSION_KEY);
}
