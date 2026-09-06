import type { ContestMode, ContestView } from '@poker/protocol';
import { apiBase, authedFetch, parseError, sessionHeaders, type AuthOptions } from './client';

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
  const res = await fetch(`${apiBase()}/api/contests`, {
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
  }) as Promise<{ inviteCount: number; challengeIds: string[]; contest?: ContestView }>;
}

export async function listPublicContests() {
  const res = await fetch(`${apiBase()}/api/contests`);
  if (!res.ok) throw new Error('Failed to load contests');
  return res.json() as Promise<{ contests: ContestView[] }>;
}

export async function listMyContests(options: AuthOptions) {
  return authedFetch('/api/contests/mine', options) as Promise<{ contests: ContestView[] }>;
}

export async function resolveContestInvite(code: string) {
  const res = await fetch(`${apiBase()}/api/contests/invite/${code}`);
  if (!res.ok) throw new Error('Contest not found');
  return res.json() as Promise<{ contest: ContestView }>;
}

export async function getContest(contestId: string) {
  const res = await fetch(`${apiBase()}/api/contests/${contestId}`);
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
