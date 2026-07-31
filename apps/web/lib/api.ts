export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
export const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? 'ws://localhost:4000/ws';

async function authHeaders(clerkToken?: string | null): Promise<HeadersInit> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (clerkToken) headers.Authorization = `Bearer ${clerkToken}`;
  return headers;
}

export async function register(
  name: string,
  avatarId?: number,
  options?: { clerkToken?: string | null; userId?: string | null },
) {
  const res = await fetch(`${API_URL}/api/register`, {
    method: 'POST',
    headers: await authHeaders(options?.clerkToken),
    body: JSON.stringify({
      name,
      avatarId,
      ...(options?.userId ? { userId: options.userId } : {}),
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || 'Register failed');
  }
  return res.json() as Promise<{
    userId: string;
    name: string;
    ticket: string;
    avatarId?: number;
  }>;
}

export async function createTable(
  input: {
    userId: string;
    name: string;
    smallBlind: number;
    bigBlind: number;
    buyIn: number;
    turnTimeMs: number;
    maxSeats: number;
    botCount?: number;
    isPrivate: boolean;
    inviteCode?: string;
  },
  options?: { clerkToken?: string | null },
) {
  const res = await fetch(`${API_URL}/api/tables`, {
    method: 'POST',
    headers: await authHeaders(options?.clerkToken),
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const text = await res.text();
    let message = text || 'Failed to create table';
    try {
      const parsed = JSON.parse(text) as { error?: string };
      if (typeof parsed.error === 'string' && parsed.error) message = parsed.error;
    } catch {
      /* keep raw text */
    }
    throw new Error(message);
  }
  return res.json() as Promise<{
    tableId: string;
    inviteCode: string;
    name: string;
    config: {
      maxSeats: number;
      smallBlind: number;
      bigBlind: number;
      buyIn: number;
      turnTimeMs: number;
    };
  }>;
}

export interface PublicTableSummary {
  tableId: string;
  inviteCode: string;
  name: string;
  stakeId: string;
  seatedCount: number;
  maxSeats: number;
  config: {
    maxSeats: number;
    smallBlind: number;
    bigBlind: number;
    buyIn: number;
    turnTimeMs: number;
  };
}

export async function listPublicTables() {
  const res = await fetch(`${API_URL}/api/tables`);
  if (!res.ok) throw new Error('Failed to load tables');
  return res.json() as Promise<{ tables: PublicTableSummary[] }>;
}

export async function resolveInvite(code: string) {
  const res = await fetch(`${API_URL}/api/tables/invite/${code}`);
  if (!res.ok) throw new Error('Invite not found');
  return res.json() as Promise<{
    tableId: string;
    inviteCode: string;
    name: string;
    config: {
      maxSeats: number;
      smallBlind: number;
      bigBlind: number;
      buyIn: number;
      turnTimeMs: number;
    };
  }>;
}

export interface FriendProfile {
  userId: string;
  name: string;
  avatarId: number;
}

export interface PendingRequest {
  id: string;
  from: FriendProfile;
  createdAt: number;
}

export interface PendingChallenge {
  id: string;
  challenger: FriendProfile;
  tableId: string;
  inviteCode: string;
  createdAt: number;
}

type AuthOptions = { clerkToken?: string | null; userId?: string | null };

async function authedFetch(
  path: string,
  options: AuthOptions & { method?: string; body?: unknown },
) {
  const res = await fetch(`${API_URL}${path}`, {
    method: options.method ?? 'GET',
    headers: await authHeaders(options.clerkToken),
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });
  if (!res.ok) {
    let message = res.status === 401 ? 'Sign in required' : 'Request failed';
    try {
      const data = (await res.json()) as { error?: string };
      if (data.error) message = data.error;
    } catch {
      const text = await res.text();
      if (text) message = text;
    }
    throw new Error(message);
  }
  return res.json();
}

export async function listFriends(options: AuthOptions) {
  const q = options.userId ? `?userId=${encodeURIComponent(options.userId)}` : '';
  return authedFetch(`/api/friends${q}`, options) as Promise<{
    friends: FriendProfile[];
    incoming: PendingRequest[];
    pendingChallenges: PendingChallenge[];
  }>;
}

export async function searchUsers(query: string, options: AuthOptions) {
  const params = new URLSearchParams({ q: query });
  if (options.userId) params.set('userId', options.userId);
  return authedFetch(`/api/friends/search?${params}`, options) as Promise<{
    users: FriendProfile[];
  }>;
}

export async function sendFriendRequest(targetUserId: string, options: AuthOptions) {
  return authedFetch('/api/friends/requests', {
    ...options,
    method: 'POST',
    body: { targetUserId, userId: options.userId },
  });
}

export async function respondFriendRequest(
  requestId: string,
  accept: boolean,
  options: AuthOptions,
) {
  return authedFetch(`/api/friends/requests/${requestId}/respond`, {
    ...options,
    method: 'POST',
    body: { accept, userId: options.userId },
  });
}

export async function challengeFriend(friendUserId: string, options: AuthOptions) {
  return authedFetch('/api/friends/challenge', {
    ...options,
    method: 'POST',
    body: { friendUserId, userId: options.userId },
  }) as Promise<{ tableId: string; inviteCode: string; challengeId: string }>;
}

export async function joinFriendChallenge(challengeId: string, options: AuthOptions) {
  return authedFetch(`/api/friends/challenges/${challengeId}/join`, {
    ...options,
    method: 'POST',
    body: { userId: options.userId },
  });
}
