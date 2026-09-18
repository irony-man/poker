import {
  declineFriendChallenge,
  joinFriendChallenge,
  listFriends,
  registerContest,
  respondFriendRequest,
  type PendingChallenge,
} from '@/lib/api';
import type { SocialSnapshot } from '@/lib/store';

type RouterLike = { push: (href: string) => void };

/** Normalize REST / social_sync payload into a full SocialSnapshot. */
export function socialSnapshotFromList(data: {
  friends: SocialSnapshot['friends'];
  incoming: SocialSnapshot['incoming'];
  outgoing?: SocialSnapshot['outgoing'];
  pendingChallenges: SocialSnapshot['pendingChallenges'];
  outgoingChallenges?: SocialSnapshot['outgoingChallenges'];
  groups?: SocialSnapshot['groups'];
}): SocialSnapshot {
  return {
    friends: data.friends ?? [],
    incoming: data.incoming ?? [],
    outgoing: data.outgoing ?? [],
    pendingChallenges: data.pendingChallenges ?? [],
    outgoingChallenges: data.outgoingChallenges ?? [],
    groups: data.groups ?? [],
  };
}

export async function refreshSocialSnapshot(
  sessionToken: string,
  applySocial: (social: SocialSnapshot) => void,
): Promise<void> {
  const data = await listFriends({ sessionToken });
  applySocial(socialSnapshotFromList(data));
}

export function challengeInvitePath(challenge: PendingChallenge): string | null {
  const q = challenge.inviteCode
    ? `?invite=${encodeURIComponent(challenge.inviteCode)}`
    : '';
  const isContest = challenge.kind === 'contest' || Boolean(challenge.contestId);
  const isLudo = challenge.kind === 'ludo' || Boolean(challenge.ludoId);
  const isSnakes = challenge.kind === 'snakes' || Boolean(challenge.snakesId);
  const isMemory = challenge.kind === 'memory' || Boolean(challenge.memoryId);
  const isCourtpiece = challenge.kind === 'courtpiece' || Boolean(challenge.courtpieceId);
  if (isContest && challenge.contestId) return `/contest/${challenge.contestId}`;
  if (isLudo && challenge.ludoId) return `/ludo/${challenge.ludoId}${q}`;
  if (isSnakes && challenge.snakesId) return `/snakes/${challenge.snakesId}${q}`;
  if (isMemory && challenge.memoryId) return `/memory/${challenge.memoryId}${q}`;
  if (isCourtpiece && challenge.courtpieceId) {
    return `/courtpiece/${challenge.courtpieceId}${q}`;
  }
  if (challenge.tableId) return `/table/${challenge.tableId}${q}`;
  return null;
}

export async function respondIncomingFriendRequest(
  requestId: string,
  accept: boolean,
  sessionToken: string,
  applySocial: (social: SocialSnapshot) => void,
): Promise<void> {
  await respondFriendRequest(requestId, accept, { sessionToken });
  try {
    await refreshSocialSnapshot(sessionToken, applySocial);
  } catch {
    /* social_sync remains source of truth */
  }
}

export async function joinIncomingChallenge(
  challenge: PendingChallenge,
  sessionToken: string,
  applySocial: (social: SocialSnapshot) => void,
  router: RouterLike,
): Promise<void> {
  await joinFriendChallenge(challenge.id, { sessionToken });
  void refreshSocialSnapshot(sessionToken, applySocial).catch(() => {});

  const isContest = challenge.kind === 'contest' || Boolean(challenge.contestId);
  if (isContest && challenge.contestId) {
    try {
      await registerContest(challenge.contestId, { sessionToken });
    } catch {
      /* already registered or full */
    }
  }

  const path = challengeInvitePath(challenge);
  if (path) router.push(path);
}

export async function declineIncomingChallenge(
  challengeId: string,
  sessionToken: string,
  applySocial: (social: SocialSnapshot) => void,
): Promise<void> {
  await declineFriendChallenge(challengeId, { sessionToken });
  try {
    await refreshSocialSnapshot(sessionToken, applySocial);
  } catch {
    /* social_sync remains source of truth */
  }
}
