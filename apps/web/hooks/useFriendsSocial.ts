'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  listFriends,
  searchUsers,
  type FriendGroup,
  type FriendProfile,
  type PendingChallenge,
  type PendingRequest,
} from '@/lib/api';
import { useOnlineFriends } from '@/components/OnlineFriends';
import { useSession } from '@/lib/store';

export function groupMembersDirty(original: Set<string>, editMembers: Set<string>): boolean {
  if (original.size !== editMembers.size) return true;
  for (const id of editMembers) if (!original.has(id)) return true;
  return false;
}

/** Shared friends list / search / toast state for FriendsPanel. */
export function useFriendsSocial({
  disabled,
  onFriendCountChange,
}: {
  disabled: boolean;
  onFriendCountChange?: (count: number) => void;
}) {
  const userId = useSession((s) => s.userId);
  const sessionToken = useSession((s) => s.sessionToken);
  const { refreshSocial } = useOnlineFriends();

  const [friends, setFriends] = useState<FriendProfile[]>([]);
  const [groups, setGroups] = useState<FriendGroup[]>([]);
  const [incoming, setIncoming] = useState<PendingRequest[]>([]);
  const [challenges, setChallenges] = useState<PendingChallenge[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<FriendProfile[]>([]);
  const [searchLookedUp, setSearchLookedUp] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const auth = useCallback(() => {
    if (!sessionToken) throw new Error('Not signed in');
    return { sessionToken };
  }, [sessionToken]);

  const friendIds = useMemo(() => new Set(friends.map((f) => f.userId)), [friends]);

  const flash = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3200);
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, []);

  const refresh = useCallback(async () => {
    if (disabled || !userId || !sessionToken) return;
    try {
      const data = await listFriends({ sessionToken });
      setFriends(data.friends);
      setGroups(data.groups ?? []);
      setIncoming(data.incoming);
      setChallenges(data.pendingChallenges);
      setLoadError(null);
      onFriendCountChange?.(data.friends.length);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Could not load friends');
    }
  }, [disabled, userId, sessionToken, onFriendCountChange]);

  useEffect(() => {
    void refresh();
    const id = setInterval(() => void refresh(), 15000);
    return () => clearInterval(id);
  }, [refresh]);

  useEffect(() => {
    const q = searchQuery.trim();
    if (disabled || !q || !userId || !sessionToken) {
      setSearchResults([]);
      setSearchLookedUp(false);
      return;
    }
    const t = setTimeout(async () => {
      try {
        const data = await searchUsers(q, { sessionToken });
        setSearchResults(data.users);
        setSearchLookedUp(true);
      } catch {
        setSearchResults([]);
        setSearchLookedUp(true);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [disabled, searchQuery, userId, sessionToken]);

  return {
    userId,
    sessionToken,
    refreshSocial,
    friends,
    groups,
    incoming,
    challenges,
    searchQuery,
    setSearchQuery,
    searchResults,
    searchLookedUp,
    busy,
    setBusy,
    error,
    setError,
    toast,
    loadError,
    setLoadError,
    auth,
    friendIds,
    flash,
    refresh,
  };
}
