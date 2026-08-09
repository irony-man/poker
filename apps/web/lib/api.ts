import type { AuthSession, CreateTableBody, ContestMode, ContestView } from '@poker/protocol';
import { coerceMoney } from '@/lib/currency';

export type { AuthSession, ContestMode, ContestView };

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
export const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? 'ws://localhost:4000/ws';

export interface MeProfile {
  id: string;
  username: string;
  name: string;
  avatarId: number;
  createdAt: number;
  chipBalance: number;
}

function sessionHeaders(sessionToken?: string | null): HeadersInit {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (sessionToken) headers.Authorization = `Bearer ${sessionToken}`;
  return headers;
}

/** Turn Zod `error.message` JSON dumps into a short read-only summary. */
function humanizeApiError(raw: string, fallback: string): string {
  const trimmed = raw.trim();
  if (!trimmed.startsWith('[')) return raw;
  try {
    const issues = JSON.parse(trimmed) as Array<{
      path?: (string | number)[];
      message?: string;
      code?: string;
      received?: unknown;
      options?: unknown[];
    }>;
    if (!Array.isArray(issues) || issues.length === 0) return raw;

    const parts = issues
      .map((issue) => {
        if (typeof issue.message === 'string' && issue.message.trim()) {
          return issue.message.trim();
        }
        if (issue.code === 'invalid_enum_value' && Array.isArray(issue.options)) {
          const field = issue.path?.length ? issue.path.join('.') : 'value';
          const opts = issue.options.map(String).join(' | ');
          return `Invalid ${field}: expected ${opts}`;
        }
        if (issue.path?.length) {
          return `Invalid ${issue.path.join('.')}`;
        }
        return null;
      })
      .filter((part): part is string => !!part);

    return parts.length > 0 ? parts.join('. ') : fallback;
  } catch {
    return raw;
  }
}

async function parseError(res: Response, fallback: string): Promise<string> {
  try {
    const text = await res.text();
    if (!text) return fallback;
    try {
      const data = JSON.parse(text) as { error?: string };
      if (data.error) return humanizeApiError(data.error, fallback);
    } catch {
      return humanizeApiError(text, fallback);
    }
  } catch {
    /* keep fallback */
  }
  return fallback;
}

export async function signup(
  username: string,
  password: string,
  avatarId?: number,
): Promise<AuthSession> {
  const res = await fetch(`${API_URL}/api/signup`, {
    method: 'POST',
    headers: sessionHeaders(),
    body: JSON.stringify({ username, password, avatarId }),
  });
  if (!res.ok) throw new Error(await parseError(res, 'Signup failed'));
  return res.json() as Promise<AuthSession>;
}

export async function login(username: string, password: string): Promise<AuthSession> {
  const res = await fetch(`${API_URL}/api/login`, {
    method: 'POST',
    headers: sessionHeaders(),
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) throw new Error(await parseError(res, 'Login failed'));
  return res.json() as Promise<AuthSession>;
}

export async function logout(sessionToken: string): Promise<void> {
  await fetch(`${API_URL}/api/logout`, {
    method: 'POST',
    headers: sessionHeaders(sessionToken),
  });
}

export async function refreshTicket(sessionToken: string): Promise<{
  ticket: string;
  userId: string;
  name: string;
  username: string;
  avatarId: number;
  chipBalance?: number;
}> {
  const res = await fetch(`${API_URL}/api/ticket`, {
    method: 'POST',
    headers: sessionHeaders(sessionToken),
    body: JSON.stringify({}),
  });
  if (!res.ok) throw new Error(await parseError(res, 'Session expired'));
  return res.json();
}

export async function fetchMe(sessionToken: string): Promise<MeProfile> {
  const res = await fetch(`${API_URL}/api/me`, {
    method: 'GET',
    headers: sessionHeaders(sessionToken),
  });
  if (!res.ok) throw new Error(await parseError(res, 'Could not load profile'));
  const data = (await res.json()) as MeProfile;
  return {
    ...data,
    chipBalance: coerceMoney(data.chipBalance),
    avatarId:
      typeof data.avatarId === 'number' && Number.isFinite(data.avatarId)
        ? Math.max(0, Math.floor(data.avatarId))
        : 0,
  };
}

export async function updateMe(
  sessionToken: string,
  body: { avatarId: number },
): Promise<MeProfile> {
  const res = await fetch(`${API_URL}/api/me`, {
    method: 'PATCH',
    headers: sessionHeaders(sessionToken),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await parseError(res, 'Could not update profile'));
  const data = (await res.json()) as MeProfile;
  return {
    ...data,
    chipBalance: coerceMoney(data.chipBalance),
    avatarId:
      typeof data.avatarId === 'number' && Number.isFinite(data.avatarId)
        ? Math.max(0, Math.floor(data.avatarId))
        : 0,
  };
}

export async function createTable(input: CreateTableBody, sessionToken: string) {
  const res = await fetch(`${API_URL}/api/tables`, {
    method: 'POST',
    headers: sessionHeaders(sessionToken),
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    throw new Error(await parseError(res, 'Failed to create table'));
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
    inviteCount?: number;
  }>;
}

export async function inviteTableFriends(
  tableId: string,
  friendUserIds: string[],
  options: AuthOptions,
) {
  return authedFetch(`/api/tables/${tableId}/invite-friends`, {
    ...options,
    method: 'POST',
    body: { friendUserIds },
  }) as Promise<{ inviteCount: number; challengeIds: string[] }>;
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
  /** Present on friend search results. */
  username?: string;
  avatarId: number;
  /** True when they recently used the app (for invite UX). */
  online?: boolean;
}

export interface PendingRequest {
  id: string;
  from: FriendProfile;
  createdAt: number;
}

export interface PendingChallenge {
  id: string;
  challenger: FriendProfile;
  /** Omitted on very old payloads; treat as table. */
  kind?: 'table' | 'contest';
  tableId: string | null;
  contestId?: string | null;
  inviteCode: string;
  createdAt: number;
  groupId?: string;
  groupName?: string;
}

export interface FriendGroup {
  id: string;
  name: string;
  ownerUserId: string;
  isOwner: boolean;
  members: FriendProfile[];
  createdAt: number;
}

type AuthOptions = { sessionToken: string };

async function authedFetch(
  path: string,
  options: AuthOptions & { method?: string; body?: unknown },
) {
  const res = await fetch(`${API_URL}${path}`, {
    method: options.method ?? 'GET',
    headers: sessionHeaders(options.sessionToken),
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });
  if (!res.ok) {
    throw new Error(
      await parseError(res, res.status === 401 ? 'Sign in required' : 'Request failed'),
    );
  }
  return res.json();
}

export async function listFriends(options: AuthOptions) {
  return authedFetch(`/api/friends`, options) as Promise<{
    friends: FriendProfile[];
    incoming: PendingRequest[];
    pendingChallenges: PendingChallenge[];
    groups: FriendGroup[];
  }>;
}

/** Keep lobby session "online" for friend invite filters. */
export async function pingPresence(options: AuthOptions) {
  return authedFetch('/api/presence', {
    ...options,
    method: 'POST',
    body: {},
  }) as Promise<{ ok: true; onlineMs: number }>;
}

export async function searchUsers(query: string, options: AuthOptions) {
  const params = new URLSearchParams({ q: query });
  return authedFetch(`/api/friends/search?${params}`, options) as Promise<{
    users: FriendProfile[];
  }>;
}

export async function sendFriendRequest(targetUserId: string, options: AuthOptions) {
  return authedFetch('/api/friends/requests', {
    ...options,
    method: 'POST',
    body: { targetUserId },
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
    body: { accept },
  });
}

export async function removeFriend(friendUserId: string, options: AuthOptions) {
  return authedFetch(`/api/friends/${encodeURIComponent(friendUserId)}`, {
    ...options,
    method: 'DELETE',
  });
}

export async function createFriendGroup(
  input: { name: string; memberUserIds: string[] },
  options: AuthOptions,
) {
  return authedFetch('/api/friends/groups', {
    ...options,
    method: 'POST',
    body: input,
  }) as Promise<{ group: FriendGroup }>;
}

export async function updateFriendGroup(
  groupId: string,
  input: { name?: string; memberUserIds?: string[] },
  options: AuthOptions,
) {
  return authedFetch(`/api/friends/groups/${groupId}`, {
    ...options,
    method: 'PATCH',
    body: input,
  }) as Promise<{ group: FriendGroup }>;
}

export async function deleteFriendGroup(groupId: string, options: AuthOptions) {
  return authedFetch(`/api/friends/groups/${groupId}`, {
    ...options,
    method: 'DELETE',
  }) as Promise<{ ok: boolean }>;
}

export async function inviteFriendGroup(
  groupId: string,
  options: AuthOptions,
  body?: {
    memberUserIds?: string[];
    maxSeats?: number;
    smallBlind?: number;
    bigBlind?: number;
    buyIn?: number;
  },
) {
  return authedFetch(`/api/friends/groups/${groupId}/invite`, {
    ...options,
    method: 'POST',
    body: body ?? {},
  }) as Promise<{
    tableId: string;
    inviteCode: string;
    inviteCount: number;
    challengeIds: string[];
  }>;
}

export async function challengeFriend(friendUserId: string, options: AuthOptions) {
  return authedFetch('/api/friends/challenge', {
    ...options,
    method: 'POST',
    body: { friendUserId },
  }) as Promise<{ tableId: string; inviteCode: string; challengeId: string }>;
}

export async function joinFriendChallenge(challengeId: string, options: AuthOptions) {
  return authedFetch(`/api/friends/challenges/${challengeId}/join`, {
    ...options,
    method: 'POST',
    body: {},
  });
}

export async function declineFriendChallenge(challengeId: string, options: AuthOptions) {
  return authedFetch(`/api/friends/challenges/${challengeId}/decline`, {
    ...options,
    method: 'POST',
    body: {},
  }) as Promise<{ ok: boolean }>;
}

export async function createContest(
  input: {
    name?: string;
    mode: ContestMode;
    fieldSize: number;
    startingStack?: number;
    smallBlind?: number;
    bigBlind?: number;
    turnTimeMs?: number;
    botCount?: number;
    isPrivate?: boolean;
    inviteCode?: string;
    autoStart?: boolean;
    handLimit?: number;
    inviteFriendIds?: string[];
  },
  sessionToken: string,
) {
  const res = await fetch(`${API_URL}/api/contests`, {
    method: 'POST',
    headers: sessionHeaders(sessionToken),
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    throw new Error(await parseError(res, 'Failed to create contest'));
  }
  return res.json() as Promise<{ contest: ContestView; inviteCount?: number }>;
}

export async function inviteContestFriends(
  contestId: string,
  friendUserIds: string[],
  options: AuthOptions,
) {
  return authedFetch(`/api/contests/${contestId}/invite-friends`, {
    ...options,
    method: 'POST',
    body: { friendUserIds },
  }) as Promise<{ inviteCount: number; challengeIds: string[] }>;
}

export async function listPublicContests() {
  const res = await fetch(`${API_URL}/api/contests`);
  if (!res.ok) throw new Error('Failed to load contests');
  return res.json() as Promise<{ contests: ContestView[] }>;
}

export async function listMyContests(options: AuthOptions) {
  return authedFetch('/api/contests/mine', options) as Promise<{ contests: ContestView[] }>;
}

export async function resolveContestInvite(code: string) {
  const res = await fetch(`${API_URL}/api/contests/invite/${code}`);
  if (!res.ok) throw new Error('Contest not found');
  return res.json() as Promise<{ contest: ContestView }>;
}

export async function getContest(contestId: string) {
  const res = await fetch(`${API_URL}/api/contests/${contestId}`);
  if (!res.ok) throw new Error('Contest not found');
  return res.json() as Promise<{ contest: ContestView }>;
}

export async function registerContest(contestId: string, options: AuthOptions) {
  return authedFetch(`/api/contests/${contestId}/register`, {
    ...options,
    method: 'POST',
    body: {},
  }) as Promise<{ contest: ContestView }>;
}

export async function unregisterContest(contestId: string, options: AuthOptions) {
  return authedFetch(`/api/contests/${contestId}/unregister`, {
    ...options,
    method: 'POST',
    body: {},
  }) as Promise<{ contest: ContestView }>;
}

export async function startContest(contestId: string, options: AuthOptions) {
  return authedFetch(`/api/contests/${contestId}/start`, {
    ...options,
    method: 'POST',
    body: {},
  }) as Promise<{ contest: ContestView }>;
}
