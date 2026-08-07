'use client';

import { useCallback, useEffect, useState } from 'react';
import { PlayerAvatar } from '@/components/PlayerAvatar';
import {
  challengeFriend,
  createFriendGroup,
  deleteFriendGroup,
  inviteFriendGroup,
  joinFriendChallenge,
  listFriends,
  respondFriendRequest,
  searchUsers,
  sendFriendRequest,
  type FriendGroup,
  type FriendProfile,
  type PendingChallenge,
  type PendingRequest,
} from '@/lib/api';
import { useSession } from '@/lib/store';

/** Friends, groups & challenges — requires logged-in session. */
export function FriendsPanel({
  disabled,
  onNavigateTable,
}: {
  disabled: boolean;
  onNavigateTable: (tableId: string, inviteCode: string) => void;
}) {
  const userId = useSession((s) => s.userId);
  const sessionToken = useSession((s) => s.sessionToken);
  const [friends, setFriends] = useState<FriendProfile[]>([]);
  const [groups, setGroups] = useState<FriendGroup[]>([]);
  const [incoming, setIncoming] = useState<PendingRequest[]>([]);
  const [challenges, setChallenges] = useState<PendingChallenge[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<FriendProfile[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [newGroupName, setNewGroupName] = useState('');
  const [selectedMembers, setSelectedMembers] = useState<Set<string>>(new Set());
  const [showCreateGroup, setShowCreateGroup] = useState(false);

  const auth = () => ({ sessionToken: sessionToken! });

  const refresh = useCallback(async () => {
    if (disabled || !userId || !sessionToken) return;
    try {
      const data = await listFriends(auth());
      setFriends(data.friends);
      setGroups(data.groups ?? []);
      setIncoming(data.incoming);
      setChallenges(data.pendingChallenges);
      setLoadError(null);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Could not load friends');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- auth is derived from session
  }, [disabled, userId, sessionToken]);

  useEffect(() => {
    void refresh();
    const id = setInterval(() => void refresh(), 15000);
    return () => clearInterval(id);
  }, [refresh]);

  useEffect(() => {
    if (disabled || searchQuery.trim().length < 2 || !userId || !sessionToken) {
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
  }, [disabled, searchQuery, userId, sessionToken]);

  function toggleMember(id: string) {
    setSelectedMembers((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else if (next.size < 8) next.add(id);
      return next;
    });
  }

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

  async function onCreateGroup(e: React.FormEvent) {
    e.preventDefault();
    if (!newGroupName.trim()) {
      setError('Enter a group name');
      return;
    }
    setBusy('create-group');
    setError(null);
    try {
      await createFriendGroup(
        {
          name: newGroupName.trim(),
          memberUserIds: [...selectedMembers],
        },
        auth(),
      );
      setNewGroupName('');
      setSelectedMembers(new Set());
      setShowCreateGroup(false);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create group');
    } finally {
      setBusy(null);
    }
  }

  async function onInviteGroup(groupId: string) {
    setBusy(`invite-${groupId}`);
    setError(null);
    try {
      const result = await inviteFriendGroup(groupId, auth());
      onNavigateTable(result.tableId, result.inviteCode);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Group invite failed');
    } finally {
      setBusy(null);
    }
  }

  async function onDeleteGroup(groupId: string) {
    setBusy(`delete-${groupId}`);
    setError(null);
    try {
      await deleteFriendGroup(groupId, auth());
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete group');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="hud-panel flex flex-col gap-4 p-5 sm:col-span-2 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-bold uppercase tracking-wider text-sidebar">Friends</h2>
          <p className="mt-1 text-sm text-ink-strong-muted font-medium">
            Groups · quick table invite · heads-up challenge
          </p>
        </div>
        <span className="status-chip shrink-0">Social</span>
      </div>

      <label className="block">
        <span className="hud-label">Find player</span>
        <input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="hud-input"
          placeholder="Search by username…"
          maxLength={32}
          disabled={disabled}
        />
      </label>

      {searchResults.length > 0 && (
        <ul className="divide-y divide-sidebar/10 rounded border border-sidebar/15 bg-mushroom/50">
          {searchResults.map((u) => (
            <li key={u.userId} className="flex items-center gap-3 px-3 py-2.5">
              <PlayerAvatar userId={u.userId} avatarId={u.avatarId} size={36} title={u.name} />
              <span className="min-w-0 flex-1 truncate font-medium text-ink-strong">{u.name}</span>
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
                className="flex flex-wrap items-center gap-2 rounded border border-sidebar/15 bg-mushroom/40 px-3 py-2"
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
          <span className="hud-label">Game invites waiting</span>
          <ul className="mt-2 space-y-2">
            {challenges.map((c) => (
              <li
                key={c.id}
                className="flex flex-wrap items-center gap-2 rounded border border-sidebar/20 bg-sidebar/5 px-3 py-2"
              >
                <PlayerAvatar
                  userId={c.challenger.userId}
                  avatarId={c.challenger.avatarId}
                  size={32}
                  title={c.challenger.name}
                />
                <span className="min-w-0 flex-1 truncate text-sm">
                  <span className="font-medium text-sidebar">{c.challenger.name}</span>
                  {c.groupName ? (
                    <span className="text-ink-strong-muted">
                      {' '}
                      invited you · <span className="text-sidebar/80">{c.groupName}</span>
                    </span>
                  ) : (
                    <span className="text-ink-strong-muted"> challenged you</span>
                  )}
                </span>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => void onJoinChallenge(c)}
                  className="rounded border border-sidebar/25 bg-sidebar/8 px-3 py-1.5 text-xs font-display font-semibold uppercase tracking-wider text-sidebar hover:bg-sidebar/12"
                >
                  Join table
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Groups */}
      <div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="hud-label">Groups ({groups.length})</span>
          <button
            type="button"
            disabled={disabled || friends.length === 0}
            onClick={() => setShowCreateGroup((v) => !v)}
            className="btn-ghost py-1 px-2.5 text-xs disabled:opacity-40"
          >
            {showCreateGroup ? 'Cancel' : 'New group'}
          </button>
        </div>

        {showCreateGroup && (
          <form
            onSubmit={(e) => void onCreateGroup(e)}
            className="mt-2 space-y-3 rounded border border-sidebar/15 bg-mushroom/40 p-3"
          >
            <label className="block">
              <span className="hud-label">Group name</span>
              <input
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                className="hud-input"
                placeholder="e.g. Home game crew"
                maxLength={40}
                required
              />
            </label>
            <div>
              <span className="hud-label">Add friends ({selectedMembers.size}/8)</span>
              {friends.length === 0 ? (
                <p className="mt-1 text-xs text-ink-strong-muted">Add friends first, then build a group.</p>
              ) : (
                <ul className="mt-2 max-h-40 space-y-1.5 overflow-y-auto">
                  {friends.map((f) => {
                    const on = selectedMembers.has(f.userId);
                    return (
                      <li key={f.userId}>
                        <button
                          type="button"
                          onClick={() => toggleMember(f.userId)}
                          className={`flex w-full items-center gap-2 rounded border px-2 py-1.5 text-left text-sm transition ${
                            on
                              ? 'border-sidebar/30 bg-sidebar/10 text-sidebar'
                              : 'border-sidebar/12 bg-mushroom/40 text-ink-strong hover:border-sidebar/25'
                          }`}
                        >
                          <PlayerAvatar
                            userId={f.userId}
                            avatarId={f.avatarId}
                            size={28}
                            title={f.name}
                          />
                          <span className="min-w-0 flex-1 truncate">{f.name}</span>
                          <span className="text-[10px] uppercase tracking-wider opacity-70">
                            {on ? 'In' : 'Add'}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
            <button
              type="submit"
              disabled={disabled || busy === 'create-group' || !newGroupName.trim()}
              className="btn-primary w-full min-h-10 text-sm"
            >
              Create group
            </button>
          </form>
        )}

        {groups.length === 0 && !showCreateGroup ? (
          <p className="mt-2 text-sm text-ink-strong-muted">
            Create a group of friends for one-tap table invites.
          </p>
        ) : (
          <ul className="mt-2 space-y-2">
            {groups.map((g) => (
              <li
                key={g.id}
                className="rounded border border-sidebar/15 bg-mushroom/35 px-3 py-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-display font-semibold uppercase tracking-wider text-sidebar truncate">
                      {g.name}
                    </p>
                    <p className="mt-0.5 text-xs text-ink-strong-muted">
                      {g.members.length} member{g.members.length === 1 ? '' : 's'}
                      {!g.isOwner ? ' · shared' : ''}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      disabled={disabled || busy === `invite-${g.id}` || g.members.length === 0}
                      onClick={() => void onInviteGroup(g.id)}
                      className="rounded border border-sidebar/25 bg-sidebar/5 px-3 py-1.5 text-xs font-display font-semibold uppercase tracking-wider text-sidebar transition hover:bg-sidebar/10 disabled:opacity-40"
                    >
                      Invite to game
                    </button>
                    {g.isOwner && (
                      <button
                        type="button"
                        disabled={disabled || busy === `delete-${g.id}`}
                        onClick={() => void onDeleteGroup(g.id)}
                        className="btn-ghost py-1.5 px-2 text-xs"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>
                {g.members.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {g.members.map((m) => (
                      <span
                        key={m.userId}
                        className="inline-flex items-center gap-1.5 rounded border border-sidebar/12 bg-mushroom/50 px-2 py-1 text-xs text-ink-strong"
                      >
                        <PlayerAvatar
                          userId={m.userId}
                          avatarId={m.avatarId}
                          size={20}
                          title={m.name}
                        />
                        {m.name}
                      </span>
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <span className="hud-label">Your friends ({friends.length})</span>
        {friends.length === 0 ? (
          <p className="mt-2 text-sm text-ink-strong-muted">No friends yet — search for players above.</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {friends.map((f) => (
              <li
                key={f.userId}
                className="flex items-center gap-3 rounded border border-sidebar/12 bg-mushroom/35 px-3 py-2.5"
              >
                <PlayerAvatar userId={f.userId} avatarId={f.avatarId} size={36} title={f.name} />
                <span className="min-w-0 flex-1 truncate font-medium">{f.name}</span>
                <button
                  type="button"
                  disabled={disabled || busy === `challenge-${f.userId}`}
                  onClick={() => void onChallenge(f.userId)}
                  className="rounded border border-sidebar/25 bg-sidebar/5 px-3 py-1.5 text-xs font-display font-semibold uppercase tracking-wider text-sidebar transition hover:bg-sidebar/10 disabled:opacity-40"
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
          className="status-chip border-danger/30 bg-danger/10 text-danger text-xs"
        >
          {error ?? loadError}
        </p>
      )}
      {!userId && (
        <p className="text-sm text-ink-strong-muted">Sign in to use friends and groups.</p>
      )}
    </div>
  );
}
