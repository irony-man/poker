import {
  apiBase,
  apiFetch,
  authedFetch,
  parseError,
  sessionHeaders,
  type AuthOptions,
} from './client';

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

/** Outgoing friend request (viewer is the sender). */
export interface OutgoingRequest {
  id: string;
  to: FriendProfile;
  createdAt: number;
}

export interface PendingChallenge {
  id: string;
  challenger: FriendProfile;
  /** Omitted on very old payloads; treat as table. */
  kind?: 'table' | 'contest' | 'ludo' | 'snakes' | 'memory' | 'courtpiece';
  tableId: string | null;
  contestId?: string | null;
  ludoId?: string | null;
  snakesId?: string | null;
  memoryId?: string | null;
  courtpieceId?: string | null;
  inviteCode: string;
  createdAt: number;
  groupId?: string;
  groupName?: string;
}

/** Outgoing game invite (viewer is the challenger). */
export interface OutgoingChallenge {
  id: string;
  challenged: FriendProfile;
  kind?: 'table' | 'contest' | 'ludo' | 'snakes' | 'memory' | 'courtpiece';
  tableId: string | null;
  contestId?: string | null;
  ludoId?: string | null;
  snakesId?: string | null;
  memoryId?: string | null;
  courtpieceId?: string | null;
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

export interface FriendSuggestion extends FriendProfile {
  online: boolean;
  mutualCount: number;
  /** Up to two mutual friend names, alphabetical. */
  mutualNames: string[];
  handsTogether: number;
  reason: 'mutual' | 'played' | 'both';
}

export async function listFriendSuggestions(options: AuthOptions) {
  return authedFetch('/api/friends/suggestions', { ...options, silent: true }) as Promise<{
    suggestions: FriendSuggestion[];
  }>;
}

export async function dismissFriendSuggestion(userId: string, options: AuthOptions) {
  return authedFetch(`/api/friends/suggestions/${encodeURIComponent(userId)}/dismiss`, {
    ...options,
    method: 'POST',
    body: {},
  }) as Promise<{ ok: boolean }>;
}

export interface FriendLinkOwner {
  userId: string;
  username: string;
  name: string;
  avatarId: number;
  avatarUrl: string | null;
}

export type FriendLinkRedeemResult = 'friends' | 'already_friends';

export type FriendLinkRelationship = 'self' | 'friends' | 'outgoing' | 'incoming' | 'none';

export async function getFriendLink(options: AuthOptions) {
  return authedFetch('/api/friends/link', options) as Promise<{ code: string; url: string }>;
}

export interface EmailInviteOutcome {
  /** New friend requests sent to existing players. */
  requested: number;
  /** They had already asked you, so you are now friends. */
  accepted: number;
  /** Already friends, or your request was already pending. */
  alreadyConnected: number;
  /** Invite emails sent to addresses with no account. */
  emailed: number;
  /** Blocked by the 24h dedupe or daily cap, or failed to send. */
  skipped: number;
}

export async function sendFriendEmailInvites(emails: string[], options: AuthOptions) {
  return authedFetch('/api/friends/invite-email', {
    ...options,
    method: 'POST',
    body: { emails },
  }) as Promise<EmailInviteOutcome>;
}

/**
 * Public: owner card for a friend link. With a session token, also the
 * viewer's relationship to the owner. Null when the code is unknown.
 */
export async function resolveFriendLink(
  code: string,
  sessionToken?: string | null,
): Promise<{ owner: FriendLinkOwner; relationship?: FriendLinkRelationship } | null> {
  const res = await apiFetch(`${apiBase()}/api/friend-links/${encodeURIComponent(code)}`, {
    headers: sessionHeaders(sessionToken),
    silent: true,
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(await parseError(res, 'Could not load invite'));
  return (await res.json()) as { owner: FriendLinkOwner; relationship?: FriendLinkRelationship };
}

export async function redeemFriendLink(code: string, options: AuthOptions) {
  return authedFetch(`/api/friend-links/${encodeURIComponent(code)}/redeem`, {
    ...options,
    method: 'POST',
    body: {},
  }) as Promise<{ result: FriendLinkRedeemResult; owner: FriendLinkOwner }>;
}

export async function listFriends(options: AuthOptions) {
  return authedFetch(`/api/friends`, options) as Promise<{
    friends: FriendProfile[];
    incoming: PendingRequest[];
    outgoing?: OutgoingRequest[];
    pendingChallenges: PendingChallenge[];
    outgoingChallenges?: OutgoingChallenge[];
    groups: FriendGroup[];
  }>;
}

/** Keep lobby session "online" for friend invite filters. */
export async function pingPresence(options: AuthOptions) {
  return authedFetch('/api/presence', {
    ...options,
    method: 'POST',
    body: {},
    silent: true,
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

export async function cancelFriendRequest(requestId: string, options: AuthOptions) {
  return authedFetch(`/api/friends/requests/${requestId}`, {
    ...options,
    method: 'DELETE',
  }) as Promise<{ ok: boolean }>;
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
    body: { ...body, lobby: true },
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
    body: { friendUserId, lobby: true },
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

export async function cancelFriendChallenge(challengeId: string, options: AuthOptions) {
  return authedFetch(`/api/friends/challenges/${challengeId}/cancel`, {
    ...options,
    method: 'POST',
    body: {},
  }) as Promise<{ ok: boolean }>;
}
