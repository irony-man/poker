'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
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

/** Shared friends list / search / toast state for FriendsPanel (WS social_sync). */
export function useFriendsSocial({
  disabled,
  onFriendCountChange,
}: {
  disabled: boolean;
  onFriendCountChange?: (count: number) => void;
}) {
  const userId = useSession((s) => s.userId);
  const sessionToken = useSession((s) => s.sessionToken);
  const social = useSession((s) => s.social);
  const socialLoaded = useSession((s) => s.socialLoaded);
  const { refreshSocial } = useOnlineFriends();

  const friends = social?.friends ?? [];
  const groups = social?.groups ?? [];
  const incoming = social?.incoming ?? [];
  const challenges = social?.pendingChallenges ?? [];

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

  useEffect(() => {
    if (disabled) return;
    onFriendCountChange?.(friends.length);
  }, [disabled, friends.length, onFriendCountChange]);

  useEffect(() => {
    // Surface wait state until first social_sync; clear once loaded.
    if (socialLoaded) setLoadError(null);
  }, [socialLoaded]);

  const refresh = useCallback(async () => {
    if (disabled || !userId || !sessionToken) return;
    await refreshSocial();
  }, [disabled, userId, sessionToken, refreshSocial]);

  // Allow local challenge list updates after accept/decline until next push.
  const [challengeOverride, setChallengeOverride] = useState<PendingChallenge[] | null>(null);
  useEffect(() => {
    setChallengeOverride(null);
  }, [social?.pendingChallenges]);

  const effectiveChallenges = challengeOverride ?? challenges;
  const setChallenges = useCallback((next: PendingChallenge[] | ((prev: PendingChallenge[]) => PendingChallenge[])) => {
    setChallengeOverride((prev) => {
      const base = prev ?? challenges;
      return typeof next === 'function' ? next(base) : next;
    });
  }, [challenges]);

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
    groups: groups as FriendGroup[],
    incoming: incoming as PendingRequest[],
    challenges: effectiveChallenges,
    setChallenges,
    searchQuery,
    setSearchQuery,
    searchResults,
    setSearchResults,
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
