'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { PendingChallenge, PendingRequest } from '@/lib/api';
import { useSession } from '@/lib/store';

const TOAST_VISIBLE_CAP = 6;

export type SocialToastItem =
  | { kind: 'request'; id: string; request: PendingRequest }
  | { kind: 'challenge'; id: string; challenge: PendingChallenge };

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

  const items = useMemo<SocialToastItem[]>(() => {
    const challengeItems: SocialToastItem[] = challenges.map((challenge) => ({
      kind: 'challenge',
      id: challenge.id,
      challenge,
    }));
    const requestItems: SocialToastItem[] = incoming.map((request) => ({
      kind: 'request',
      id: request.id,
      request,
    }));
    // Interleave by createdAt (newest first across both types).
    return [...challengeItems, ...requestItems].sort((a, b) => {
      const aAt =
        a.kind === 'challenge' ? (a.challenge.createdAt ?? 0) : (a.request.createdAt ?? 0);
      const bAt =
        b.kind === 'challenge' ? (b.challenge.createdAt ?? 0) : (b.request.createdAt ?? 0);
      return bAt - aAt;
    });
  }, [incoming, challenges]);

  useEffect(() => {
    const ids = new Set<string>(items.map((i) => i.id));
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
  }, [items]);

  const visibleItems = items.slice(0, TOAST_VISIBLE_CAP);
  const extraCount = Math.max(0, items.length - visibleItems.length);

  return {
    sessionToken,
    items,
    visibleItems,
    extraCount,
    newIds,
    incoming,
    challenges,
  };
}
