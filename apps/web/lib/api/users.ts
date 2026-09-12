import { coerceMoney } from '@/lib/currency';
import { apiBase, parseError, sessionHeaders } from './client';
import type { MyHandRow } from './history';

export type PublicProfileRelationship =
  | 'self'
  | 'friends'
  | 'outgoing'
  | 'incoming'
  | 'none';

export interface PublicProfile {
  id: string;
  username: string;
  name: string;
  avatarId: number;
  avatarUrl: string | null;
  createdAt: number;
  handsPlayed: number;
  friendCount: number;
  chipBalance: number;
  whuffieBalance: number;
  relationship?: PublicProfileRelationship;
  incomingRequestId?: string;
}

function normalizePublicProfile(data: PublicProfile): PublicProfile {
  return {
    ...data,
    chipBalance: coerceMoney(data.chipBalance),
    whuffieBalance: coerceMoney(data.whuffieBalance),
    handsPlayed:
      typeof data.handsPlayed === 'number' && Number.isFinite(data.handsPlayed)
        ? Math.max(0, Math.floor(data.handsPlayed))
        : 0,
    friendCount:
      typeof data.friendCount === 'number' && Number.isFinite(data.friendCount)
        ? Math.max(0, Math.floor(data.friendCount))
        : 0,
    avatarId:
      typeof data.avatarId === 'number' && Number.isFinite(data.avatarId)
        ? Math.max(0, Math.floor(data.avatarId))
        : 0,
    avatarUrl: typeof data.avatarUrl === 'string' ? data.avatarUrl : null,
    relationship: data.relationship,
    incomingRequestId:
      typeof data.incomingRequestId === 'string' ? data.incomingRequestId : undefined,
  };
}

/** Public profile for `/u/[username]` (auth optional — adds relationship when signed in). */
export async function fetchPublicProfile(
  username: string,
  sessionToken?: string | null,
): Promise<PublicProfile> {
  const res = await fetch(`${apiBase()}/api/users/${encodeURIComponent(username)}`, {
    headers: sessionHeaders(sessionToken),
  });
  if (res.status === 404) throw new Error('User not found');
  if (!res.ok) throw new Error(await parseError(res, 'Could not load profile'));
  return normalizePublicProfile((await res.json()) as PublicProfile);
}

/** Hands both the viewer and this user played (session required). */
export async function fetchHandsTogether(
  username: string,
  sessionToken: string,
  limit = 50,
): Promise<{ hands: MyHandRow[] }> {
  const n = Math.max(1, Math.min(200, Math.floor(limit)));
  const res = await fetch(
    `${apiBase()}/api/users/${encodeURIComponent(username)}/hands-together?limit=${n}`,
    { headers: sessionHeaders(sessionToken) },
  );
  if (res.status === 404) throw new Error('User not found');
  if (!res.ok) throw new Error(await parseError(res, 'Could not load shared hands'));
  return res.json() as Promise<{ hands: MyHandRow[] }>;
}
