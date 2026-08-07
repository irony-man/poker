'use client';

import { useCallback, useEffect, useState } from 'react';
import { LobbySplitCard } from '@/components/LobbySplitCard';
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

/** Friends, groups & challenges for the main lobby content area. */
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
    <LobbySplitCard imageSrc="/home-cards.png" imageAlt="Friendly home-game cards and chips">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="text-sm font-medium text-ink-strong-muted">
          Search players · accept requests · challenge to a table
        </p>
        <span className="status-chip shrink-0">Social</span>
      </div>

      <label className="block w-full">
        <span className="hud-label">Find player</span>
        <input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="hud-input"
          maxLength={32}
          disabled={disabled}
          autoComplete="off"
        />
      </label>

      {searchResults.length > 0 && (
        <ul className="divide-y divide-sidebar/10 rounded-lg border border-sidebar/12">
          {searchResults.map((u) => (
            <li key={u.userId} className="flex items-center gap-3 px-3 py-2.5">
              <PlayerAvatar userId={u.userId} avatarId={u.avatarId} size={32} title={u.name} />
              <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink-strong">
                {u.name}
              </span>
              <button
                type="button"
                disabled={disabled || busy === u.userId}
                onClick={() => void onAddFriend(u.userId)}
                className="btn-ghost py-1.5 px-3 text-xs"
              >
                Add
              </button>
            </li>
          ))}
        </ul>
      )}

      {incoming.length > 0 && (
        <section>
          <h2 className="hud-label">Requests</h2>
          <ul className="mt-2 grid gap-2 sm:grid-cols-2">
            {incoming.map((req) => (
              <li
                key={req.id}
                className="flex flex-wrap items-center gap-2 rounded-lg border border-sidebar/12 bg-mushroom/45 px-3 py-2.5"
              >
                <PlayerAvatar
                  userId={req.from.userId}
                  avatarId={req.from.avatarId}
                  size={28}
                  title={req.from.name}
                />
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink-strong">
                  {req.from.name}
                </span>
                <button
                  type="button"
                  disabled={disabled || busy === req.id}
                  onClick={() => void onRespond(req.id, true)}
                  className="btn-primary py-1.5 px-3 text-xs"
                >
                  Accept
                </button>
                <button
                  type="button"
                  disabled={disabled || busy === req.id}
                  onClick={() => void onRespond(req.id, false)}
                  className="btn-ghost py-1.5 px-3 text-xs"
                >
                  Decline
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {challenges.length > 0 && (
        <section>
          <h2 className="hud-label">Game invites</h2>
          <ul className="mt-2 grid gap-2 sm:grid-cols-2">
            {challenges.map((c) => (
              <li
                key={c.id}
                className="flex flex-col gap-2 rounded-lg border border-sidebar/12 bg-mushroom/45 px-3 py-3"
              >
                <div className="flex items-center gap-2">
                  <PlayerAvatar
                    userId={c.challenger.userId}
                    avatarId={c.challenger.avatarId}
                    size={28}
                    title={c.challenger.name}
                  />
                  <span className="min-w-0 flex-1 text-sm leading-snug text-ink-strong">
                    <span className="font-medium">{c.challenger.name}</span>
                    {c.groupName ? (
                      <span className="text-ink-strong-muted"> · {c.groupName}</span>
                    ) : (
                      <span className="text-ink-strong-muted"> challenged you</span>
                    )}
                  </span>
                </div>
                <button
                  type="button"
                  disabled={disabled || busy === `join-${c.id}`}
                  onClick={() => void onJoinChallenge(c)}
                  className="btn-primary min-h-10 w-full text-xs"
                >
                  Join table
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <section>
          <div className="flex items-center justify-between gap-2">
            <h2 className="hud-label">Groups ({groups.length})</h2>
            <button
              type="button"
              disabled={disabled || friends.length === 0}
              onClick={() => setShowCreateGroup((v) => !v)}
              className="btn-ghost py-1.5 px-3 text-xs"
            >
              {showCreateGroup ? 'Cancel' : 'New group'}
            </button>
          </div>

          {showCreateGroup && (
            <form
              onSubmit={(e) => void onCreateGroup(e)}
              className="mt-2 space-y-3 rounded-lg border border-sidebar/12 bg-mushroom/45 p-3 sm:p-4"
            >
              <label className="block">
                <span className="hud-label">Group name</span>
                <input
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  className="hud-input"
                  maxLength={40}
                  required
                  autoComplete="off"
                />
              </label>
              <div>
                <span className="hud-label">Members ({selectedMembers.size}/8)</span>
                {friends.length === 0 ? (
                  <p className="mt-1 text-sm text-ink-strong-muted">Add friends first.</p>
                ) : (
                  <ul className="mt-2 max-h-40 space-y-1.5 overflow-y-auto">
                    {friends.map((f) => {
                      const on = selectedMembers.has(f.userId);
                      return (
                        <li key={f.userId}>
                          <button
                            type="button"
                            onClick={() => toggleMember(f.userId)}
                            className={`flex w-full items-center gap-2 rounded-lg border px-2.5 py-2 text-left text-sm transition ${
                              on
                                ? 'border-sidebar/35 bg-sidebar/10 text-ink-strong'
                                : 'border-sidebar/12 bg-transparent text-ink-strong-muted hover:border-sidebar/25'
                            }`}
                          >
                            <PlayerAvatar
                              userId={f.userId}
                              avatarId={f.avatarId}
                              size={24}
                              title={f.name}
                            />
                            <span className="min-w-0 flex-1 truncate">{f.name}</span>
                            <span className="text-[10px] font-display uppercase tracking-wider opacity-70">
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
                className="btn-primary min-h-10 w-full text-xs"
              >
                Create group
              </button>
            </form>
          )}

          {groups.length === 0 && !showCreateGroup ? (
            <p className="mt-2 text-sm text-ink-strong-muted">
              Create a group for one-tap table invites.
            </p>
          ) : (
            <ul className="mt-2 space-y-2">
              {groups.map((g) => (
                <li
                  key={g.id}
                  className="rounded-lg border border-sidebar/12 bg-mushroom/45 p-3 sm:p-4"
                >
                  <div className="min-w-0">
                    <p className="truncate font-display text-sm font-semibold uppercase tracking-wider text-sidebar">
                      {g.name}
                    </p>
                    <p className="mt-0.5 text-xs text-ink-strong-muted">
                      {g.members.length} member{g.members.length === 1 ? '' : 's'}
                      {!g.isOwner ? ' · shared' : ''}
                    </p>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={disabled || busy === `invite-${g.id}` || g.members.length === 0}
                      onClick={() => void onInviteGroup(g.id)}
                      className="btn-primary py-1.5 px-3 text-xs"
                    >
                      Invite
                    </button>
                    {g.isOwner && (
                      <button
                        type="button"
                        disabled={disabled || busy === `delete-${g.id}`}
                        onClick={() => void onDeleteGroup(g.id)}
                        className="btn-ghost py-1.5 px-3 text-xs"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                  {g.members.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {g.members.map((m) => (
                        <span
                          key={m.userId}
                          className="inline-flex items-center gap-1.5 rounded-md border border-sidebar/12 px-2 py-0.5 text-xs text-ink-strong-muted"
                        >
                          <PlayerAvatar
                            userId={m.userId}
                            avatarId={m.avatarId}
                            size={18}
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
        </section>

        <section>
          <h2 className="hud-label">Friends ({friends.length})</h2>
          {friends.length === 0 ? (
            <p className="mt-2 text-sm text-ink-strong-muted">No friends yet — search above.</p>
          ) : (
            <ul className="mt-2 space-y-2">
              {friends.map((f) => (
                <li
                  key={f.userId}
                  className="flex items-center gap-3 rounded-lg border border-sidebar/12 bg-mushroom/45 px-3 py-2.5"
                >
                  <PlayerAvatar userId={f.userId} avatarId={f.avatarId} size={32} title={f.name} />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink-strong">
                    {f.name}
                  </span>
                  <button
                    type="button"
                    disabled={disabled || busy === `challenge-${f.userId}`}
                    onClick={() => void onChallenge(f.userId)}
                    className="btn-primary py-1.5 px-3 text-xs"
                  >
                    Challenge
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
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
    </LobbySplitCard>
  );
}
