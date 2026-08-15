'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { PendingChallenge, PendingRequest } from '@/lib/api';
import { useSession } from '@/lib/store';

export function useSocialNotifications() {
  const social = useSession((s) => s.social);
  const sessionToken = useSession((s) => s.sessionToken);
  const seenRef = useRef<Set<string> | null>(null);
  const [newIds, setNewIds] = useState<Set<string>>(() => new Set());

  const incoming = useMemo(
    () =>
      [...(social?.incoming ?? [])].sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0)),
    [social],
  );
  const challenges = useMemo(
    () =>
      [...(social?.pendingChallenges ?? [])].sort(
        (a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0),
      ),
    [social],
  );

  useEffect(() => {
    const ids = new Set<string>([
      ...incoming.map((r) => r.id),
      ...challenges.map((c) => c.id),
    ]);
    if (seenRef.current == null) {
      seenRef.current = ids;
      setNewIds(new Set());
      return;
    }
    const fresh = new Set<string>();
    for (const id of ids) {
      if (!seenRef.current.has(id)) fresh.add(id);
    }
    seenRef.current = ids;
    setNewIds(fresh);
  }, [incoming, challenges]);

  const newestRequest = incoming[0] ?? null;
  const newestChallenge = challenges[0] ?? null;
  const extraCount = Math.max(
    0,
    incoming.length + challenges.length - visibleCount(newestRequest, newestChallenge),
  );

  return {
    sessionToken,
    newestRequest,
    newestChallenge,
    extraCount,
    isNewRequest: newestRequest ? newIds.has(newestRequest.id) : false,
    isNewChallenge: newestChallenge ? newIds.has(newestChallenge.id) : false,
    incoming,
    challenges,
  };
}

function visibleCount(request: PendingRequest | null, challenge: PendingChallenge | null): number {
  return (request ? 1 : 0) + (challenge ? 1 : 0);
}
