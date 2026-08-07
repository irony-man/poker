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

/** Friends, groups & challenges — requires logged-in session. Styled for the lobby sidebar. */
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

  const inputClass =
    'w-full rounded-md border border-mushroom/20 bg-mushroom/5 px-2.5 py-2 text-sm text-mushroom placeholder:text-mushroom/35 outline-none transition focus:border-mushroom/45';
  const ghostBtn =
    'rounded-md border border-mushroom/20 px-2 py-1 text-[10px] font-display font-semibold uppercase tracking-wider text-mushroom/70 transition hover:border-mushroom/40 hover:text-mushroom disabled:opacity-40';
  const primaryBtn =
    'rounded-md border border-mushroom/30 bg-mushroom/15 px-2.5 py-1.5 text-[10px] font-display font-semibold uppercase tracking-wider text-mushroom transition hover:bg-mushroom/25 disabled:opacity-40';
  const rowClass = 'rounded border border-mushroom/12 bg-mushroom/5 px-2 py-2';
  const labelClass = 'text-[10px] font-display uppercase tracking-[0.16em] text-mushroom/45';

  return (
    <div className="flex flex-col gap-3 text-mushroom">
      <label className="block">
        <span className={labelClass}>Find player</span>
        <input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className={`mt-1.5 ${inputClass}`}
          placeholder="Search username…"
          maxLength={32}
          disabled={disabled}
        />
      </label>

      {searchResults.length > 0 && (
        <ul className="divide-y divide-mushroom/10 rounded border border-mushroom/15">
          {searchResults.map((u) => (
            <li key={u.userId} className="flex items-center gap-2 px-2 py-2">
              <PlayerAvatar userId={u.userId} avatarId={u.avatarId} size={28} title={u.name} />
              <span className="min-w-0 flex-1 truncate text-sm font-medium text-mushroom">
                {u.name}
              </span>
              <button
                type="button"
                disabled={disabled || busy === u.userId}
                onClick={() => void onAddFriend(u.userId)}
                className={ghostBtn}
              >
                Add
              </button>
            </li>
          ))}
        </ul>
      )}

      {incoming.length > 0 && (
        <div>
          <span className={labelClass}>Requests</span>
          <ul className="mt-1.5 space-y-1.5">
            {incoming.map((req) => (
              <li key={req.id} className={`flex flex-wrap items-center gap-1.5 ${rowClass}`}>
                <PlayerAvatar
                  userId={req.from.userId}
                  avatarId={req.from.avatarId}
                  size={24}
                  title={req.from.name}
                />
                <span className="min-w-0 flex-1 truncate text-xs font-medium">{req.from.name}</span>
                <button
                  type="button"
                  disabled={disabled || busy === req.id}
                  onClick={() => void onRespond(req.id, true)}
                  className={primaryBtn}
                >
                  Accept
                </button>
                <button
                  type="button"
                  disabled={disabled || busy === req.id}
                  onClick={() => void onRespond(req.id, false)}
                  className={ghostBtn}
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
          <span className={labelClass}>Game invites</span>
          <ul className="mt-1.5 space-y-1.5">
            {challenges.map((c) => (
              <li key={c.id} className={`flex flex-col gap-1.5 ${rowClass}`}>
                <div className="flex items-center gap-2">
                  <PlayerAvatar
                    userId={c.challenger.userId}
                    avatarId={c.challenger.avatarId}
                    size={24}
                    title={c.challenger.name}
                  />
                  <span className="min-w-0 flex-1 text-xs leading-snug">
                    <span className="font-medium text-mushroom">{c.challenger.name}</span>
                    {c.groupName ? (
                      <span className="text-mushroom/55">
                        {' '}
                        · {c.groupName}
                      </span>
                    ) : (
                      <span className="text-mushroom/55"> challenged you</span>
                    )}
                  </span>
                </div>
                <button
                  type="button"
                  disabled={disabled || busy === `join-${c.id}`}
                  onClick={() => void onJoinChallenge(c)}
                  className={`${primaryBtn} w-full`}
                >
                  Join table
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div>
        <div className="flex items-center justify-between gap-2">
          <span className={labelClass}>Groups ({groups.length})</span>
          <button
            type="button"
            disabled={disabled || friends.length === 0}
            onClick={() => setShowCreateGroup((v) => !v)}
            className={ghostBtn}
          >
            {showCreateGroup ? 'Cancel' : 'New'}
          </button>
        </div>

        {showCreateGroup && (
          <form
            onSubmit={(e) => void onCreateGroup(e)}
            className={`mt-1.5 space-y-2 ${rowClass}`}
          >
            <label className="block">
              <span className={labelClass}>Group name</span>
              <input
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                className={`mt-1 ${inputClass}`}
                placeholder="e.g. Home game"
                maxLength={40}
                required
              />
            </label>
            <div>
              <span className={labelClass}>Members ({selectedMembers.size}/8)</span>
              {friends.length === 0 ? (
                <p className="mt-1 text-[11px] text-mushroom/50">Add friends first.</p>
              ) : (
                <ul className="mt-1.5 max-h-32 space-y-1 overflow-y-auto">
                  {friends.map((f) => {
                    const on = selectedMembers.has(f.userId);
                    return (
                      <li key={f.userId}>
                        <button
                          type="button"
                          onClick={() => toggleMember(f.userId)}
                          className={`flex w-full items-center gap-2 rounded border px-2 py-1 text-left text-xs transition ${
                            on
                              ? 'border-mushroom/35 bg-mushroom/15 text-mushroom'
                              : 'border-mushroom/12 bg-transparent text-mushroom/70 hover:border-mushroom/25'
                          }`}
                        >
                          <PlayerAvatar
                            userId={f.userId}
                            avatarId={f.avatarId}
                            size={22}
                            title={f.name}
                          />
                          <span className="min-w-0 flex-1 truncate">{f.name}</span>
                          <span className="text-[9px] uppercase tracking-wider opacity-70">
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
              className={`${primaryBtn} w-full py-2`}
            >
              Create group
            </button>
          </form>
        )}

        {groups.length === 0 && !showCreateGroup ? (
          <p className="mt-1.5 text-[11px] leading-snug text-mushroom/50">
            Create a group for one-tap invites.
          </p>
        ) : (
          <ul className="mt-1.5 space-y-1.5">
            {groups.map((g) => (
              <li key={g.id} className={rowClass}>
                <div className="min-w-0">
                  <p className="truncate text-xs font-display font-semibold uppercase tracking-wider text-mushroom">
                    {g.name}
                  </p>
                  <p className="mt-0.5 text-[10px] text-mushroom/50">
                    {g.members.length} member{g.members.length === 1 ? '' : 's'}
                    {!g.isOwner ? ' · shared' : ''}
                  </p>
                </div>
                <div className="mt-1.5 flex flex-wrap gap-1">
                  <button
                    type="button"
                    disabled={disabled || busy === `invite-${g.id}` || g.members.length === 0}
                    onClick={() => void onInviteGroup(g.id)}
                    className={primaryBtn}
                  >
                    Invite
                  </button>
                  {g.isOwner && (
                    <button
                      type="button"
                      disabled={disabled || busy === `delete-${g.id}`}
                      onClick={() => void onDeleteGroup(g.id)}
                      className={ghostBtn}
                    >
                      Delete
                    </button>
                  )}
                </div>
                {g.members.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {g.members.map((m) => (
                      <span
                        key={m.userId}
                        className="inline-flex items-center gap-1 rounded border border-mushroom/12 px-1.5 py-0.5 text-[10px] text-mushroom/75"
                      >
                        <PlayerAvatar
                          userId={m.userId}
                          avatarId={m.avatarId}
                          size={16}
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
        <span className={labelClass}>Friends ({friends.length})</span>
        {friends.length === 0 ? (
          <p className="mt-1.5 text-[11px] text-mushroom/50">
            No friends yet — search above.
          </p>
        ) : (
          <ul className="mt-1.5 space-y-1.5">
            {friends.map((f) => (
              <li key={f.userId} className={`flex items-center gap-2 ${rowClass}`}>
                <PlayerAvatar userId={f.userId} avatarId={f.avatarId} size={28} title={f.name} />
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{f.name}</span>
                <button
                  type="button"
                  disabled={disabled || busy === `challenge-${f.userId}`}
                  onClick={() => void onChallenge(f.userId)}
                  className={primaryBtn}
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
          className="rounded border border-danger/35 bg-danger/10 px-2 py-1.5 text-[11px] text-danger"
        >
          {error ?? loadError}
        </p>
      )}
      {!userId && (
        <p className="text-[11px] leading-snug text-mushroom/50">
          Sign in to use friends and groups.
        </p>
      )}
    </div>
  );
}
