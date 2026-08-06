'use client';

import { useCallback, useEffect, useState } from 'react';
import { PlayerAvatar } from '@/components/PlayerAvatar';
import {
  challengeFriend,
  joinFriendChallenge,
  listFriends,
  respondFriendRequest,
  searchUsers,
  sendFriendRequest,
  type FriendProfile,
  type PendingChallenge,
  type PendingRequest,
} from '@/lib/api';
import { useSession } from '@/lib/store';

/** Friends & challenges — works with anonymous callsign sessions (no Clerk). */
export function FriendsPanel({
  disabled,
  onNavigateTable,
}: {
  disabled: boolean;
  onNavigateTable: (tableId: string, inviteCode: string) => void;
}) {
  const userId = useSession((s) => s.userId);
  const [friends, setFriends] = useState<FriendProfile[]>([]);
  const [incoming, setIncoming] = useState<PendingRequest[]>([]);
  const [challenges, setChallenges] = useState<PendingChallenge[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<FriendProfile[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const auth = () => ({ userId });

  const refresh = useCallback(async () => {
    if (disabled || !userId) return;
    try {
      const data = await listFriends(auth());
      setFriends(data.friends);
      setIncoming(data.incoming);
      setChallenges(data.pendingChallenges);
      setLoadError(null);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Could not load friends');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- auth is derived from userId
  }, [disabled, userId]);

  useEffect(() => {
    void refresh();
    const id = setInterval(() => void refresh(), 15000);
    return () => clearInterval(id);
  }, [refresh]);

  useEffect(() => {
    if (disabled || searchQuery.trim().length < 2 || !userId) {
      setSearchResults([]);
      return;
    }
    const t = setTimeout(async () => {
      try {
        const data = await searchUsers(searchQuery, auth());
        setSearchResults(data.users);
      } catch {
        setSearchResults([]);
      }
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [disabled, searchQuery, userId]);

  async function onAddFriend(targetUserId: string) {
    setBusy(targetUserId);
    setError(null);
    try {
      await sendFriendRequest(targetUserId, auth());
      setSearchQuery('');
      setSearchResults([]);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add friend');
    } finally {
      setBusy(null);
    }
  }

  async function onRespond(requestId: string, accept: boolean) {
    setBusy(requestId);
    setError(null);
    try {
      await respondFriendRequest(requestId, accept, auth());
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    } finally {
      setBusy(null);
    }
  }

  async function onChallenge(friendUserId: string) {
    setBusy(`challenge-${friendUserId}`);
    setError(null);
    try {
      const result = await challengeFriend(friendUserId, auth());
      onNavigateTable(result.tableId, result.inviteCode);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Challenge failed');
    } finally {
      setBusy(null);
    }
  }

  async function onJoinChallenge(challenge: PendingChallenge) {
    setBusy(`join-${challenge.id}`);
    setError(null);
    try {
      await joinFriendChallenge(challenge.id, auth());
      onNavigateTable(challenge.tableId, challenge.inviteCode);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to join challenge');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="hud-panel flex flex-col gap-4 p-5 sm:col-span-2 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-bold uppercase tracking-wider text-gold">Friends</h2>
          <p className="mt-1 text-sm text-cream/45 font-medium">
            Search players · accept requests · quick heads-up challenge
          </p>
        </div>
        <span className="status-chip border-gold/30 bg-gold/10 text-gold shrink-0">Social</span>
      </div>

      <label className="block">
        <span className="hud-label">Find player</span>
        <input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="hud-input"
          placeholder="Search by callsign…"
          maxLength={32}
          disabled={disabled}
        />
      </label>

      {searchResults.length > 0 && (
        <ul className="divide-y divide-cyan/10 rounded border border-cyan/15 bg-ink-raised/50">
          {searchResults.map((u) => (
            <li key={u.userId} className="flex items-center gap-3 px-3 py-2.5">
              <PlayerAvatar userId={u.userId} avatarId={u.avatarId} size={36} title={u.name} />
              <span className="min-w-0 flex-1 truncate font-medium text-cream">{u.name}</span>
              <button
                type="button"
                disabled={disabled || busy === u.userId}
                onClick={() => void onAddFriend(u.userId)}
                className="btn-ghost shrink-0 py-1.5 px-3 text-xs"
              >
                Add
              </button>
            </li>
          ))}
        </ul>
      )}

      {incoming.length > 0 && (
        <div>
          <span className="hud-label">Incoming requests</span>
          <ul className="mt-2 space-y-2">
            {incoming.map((req) => (
              <li
                key={req.id}
                className="flex flex-wrap items-center gap-2 rounded border border-cyan/15 bg-ink-raised/40 px-3 py-2"
              >
                <PlayerAvatar
                  userId={req.from.userId}
                  avatarId={req.from.avatarId}
                  size={32}
                  title={req.from.name}
                />
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{req.from.name}</span>
                <button
                  type="button"
                  disabled={disabled || busy === req.id}
                  onClick={() => void onRespond(req.id, true)}
                  className="btn-primary py-1 px-2.5 text-xs"
                >
                  Accept
                </button>
                <button
                  type="button"
                  disabled={disabled || busy === req.id}
                  onClick={() => void onRespond(req.id, false)}
                  className="btn-ghost py-1 px-2.5 text-xs"
                >
                  Decline
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {challenges.length > 0 && (
        <div>
          <span className="hud-label">Challenges waiting</span>
          <ul className="mt-2 space-y-2">
            {challenges.map((c) => (
              <li
                key={c.id}
                className="flex flex-wrap items-center gap-2 rounded border border-felt-neon/25 bg-felt-neon/5 px-3 py-2"
              >
                <PlayerAvatar
                  userId={c.challenger.userId}
                  avatarId={c.challenger.avatarId}
                  size={32}
                  title={c.challenger.name}
                />
                <span className="min-w-0 flex-1 truncate text-sm">
                  <span className="font-medium text-felt-neon">{c.challenger.name}</span>
                  <span className="text-cream/50"> challenged you</span>
                </span>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => void onJoinChallenge(c)}
                  className="rounded border border-felt-neon/40 bg-felt-neon/15 px-3 py-1.5 text-xs font-display font-semibold uppercase tracking-wider text-felt-neon hover:bg-felt-neon/25"
                >
                  Join table
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div>
        <span className="hud-label">Your friends ({friends.length})</span>
        {friends.length === 0 ? (
          <p className="mt-2 text-sm text-cream/40">No friends yet — search for players above.</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {friends.map((f) => (
              <li
                key={f.userId}
                className="flex items-center gap-3 rounded border border-cyan/10 bg-ink-raised/30 px-3 py-2.5"
              >
                <PlayerAvatar userId={f.userId} avatarId={f.avatarId} size={36} title={f.name} />
                <span className="min-w-0 flex-1 truncate font-medium">{f.name}</span>
                <button
                  type="button"
                  disabled={disabled || busy === `challenge-${f.userId}`}
                  onClick={() => void onChallenge(f.userId)}
                  className="rounded border border-gold/35 bg-gold/10 px-3 py-1.5 text-xs font-display font-semibold uppercase tracking-wider text-gold transition hover:bg-gold/20 disabled:opacity-40"
                >
                  Challenge
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {(error || loadError) && (
        <p
          role="alert"
          className="status-chip border-red-500/40 bg-red-950/50 text-red-300 text-xs"
        >
          {error ?? loadError}
        </p>
      )}
      {!userId && (
        <p className="text-sm text-cream/45">
          Enter a callsign above, then host or join once so we can attach your friends list.
        </p>
      )}
    </div>
  );
}
