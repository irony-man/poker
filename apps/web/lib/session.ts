/** Client session helpers for username/password auth. */

export const POKR_SESSION_KEY = 'pokr-session';
/** @deprecated Prefer POKR_SESSION_KEY; kept for reading legacy storage. */
export const FELT_SESSION_KEY = 'felt-session';

/** Locally persisted auth fields (balances are refreshed from the server). */
export type StoredSession = {
  userId: string;
  username: string;
  name: string;
  ticket: string;
  sessionToken: string;
  avatarId?: number;
  chipBalance?: number;
  whuffieBalance?: number;
};

export function readStoredSession(): StoredSession | null {
  if (typeof localStorage === 'undefined') return null;
  const raw =
    localStorage.getItem(POKR_SESSION_KEY) ?? localStorage.getItem(FELT_SESSION_KEY);
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
      ...(typeof s.whuffieBalance === 'number' ? { whuffieBalance: s.whuffieBalance } : {}),
    };
  } catch {
    return null;
  }
}

export function writeStoredSession(session: StoredSession): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(POKR_SESSION_KEY, JSON.stringify(session));
  localStorage.removeItem(FELT_SESSION_KEY);
}

export function clearStoredSession(): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.removeItem(POKR_SESSION_KEY);
  localStorage.removeItem(FELT_SESSION_KEY);
}
