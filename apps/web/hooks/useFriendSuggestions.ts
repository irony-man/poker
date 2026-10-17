'use client';

import { useCallback, useEffect, useState } from 'react';
import { listFriendSuggestions, type FriendSuggestion } from '@/lib/api';
import { useSession } from '@/lib/store';

/** "People you may know" list; refetches when friends or sent requests change. */
export function useFriendSuggestions({ disabled }: { disabled: boolean }) {
  const userId = useSession((s) => s.userId);
  const sessionToken = useSession((s) => s.sessionToken);
  const friendCount = useSession((s) => s.social?.friends?.length ?? 0);
  const outgoingCount = useSession((s) => s.social?.outgoing?.length ?? 0);

  const [suggestions, setSuggestions] = useState<FriendSuggestion[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (disabled || !userId || !sessionToken) {
      setSuggestions([]);
      setLoaded(false);
      return;
    }
    let cancelled = false;
    listFriendSuggestions({ sessionToken })
      .then((data) => {
        if (!cancelled) setSuggestions(data.suggestions);
      })
      .catch(() => {
        if (!cancelled) setSuggestions([]);
      })
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [disabled, userId, sessionToken, friendCount, outgoingCount]);

  const removeSuggestion = useCallback((targetUserId: string) => {
    setSuggestions((list) => list.filter((s) => s.userId !== targetUserId));
  }, []);

  return { suggestions, loaded, removeSuggestion };
}
