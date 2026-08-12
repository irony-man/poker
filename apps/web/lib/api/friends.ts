import { authedFetch, type AuthOptions } from './client';

export interface FriendProfile {
  userId: string;
  name: string;
  /** Present on friend search results. */
  username?: string;
  avatarId: number;
  avatarUrl?: string | null;
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
