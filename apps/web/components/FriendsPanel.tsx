'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
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
  updateFriendGroup,
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
  const username = useSession((s) => s.username);
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

  const [newGroupName, setNewGroupName] = useState('');
  const [selectedMembers, setSelectedMembers] = useState<Set<string>>(new Set());
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  /** Owner is editing members of this group id. */
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editMembers, setEditMembers] = useState<Set<string>>(new Set());
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const auth = () => ({ sessionToken: sessionToken! });
  const friendIds = useMemo(() => new Set(friends.map((f) => f.userId)), [friends]);

  const flash = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 3200);
  };

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
    const q = searchQuery.trim();
    if (disabled || !q || !userId || !sessionToken) {
      setSearchResults([]);
      setSearchLookedUp(false);
      return;
    }
    const t = setTimeout(async () => {
      try {
        const data = await searchUsers(q, auth());
        setSearchResults(data.users);
        setSearchLookedUp(true);
      } catch {
        setSearchResults([]);
        setSearchLookedUp(true);
      }
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [disabled, searchQuery, userId, sessionToken]);

  async function onShareUsername() {
    const handle = (username ?? '').trim();
    if (!handle) {
      setError('Sign in to share your username');
      return;
    }
    try {
      if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
        await navigator.share({
          title: 'POKR username',
          text: `Add me on POKR: ${handle}`,
        });
        flash('Shared');
        return;
      }
    } catch (err) {
      // User cancelled share sheet — don't fall through to copy noise.
      if (err instanceof DOMException && err.name === 'AbortError') return;
    }
    try {
      await navigator.clipboard.writeText(handle);
      flash('Username copied');
    } catch {
      setError('Could not copy username');
    }
  }

  async function onCopyUsername() {
    const handle = (username ?? '').trim();
    if (!handle) {
      setError('Sign in to copy your username');
      return;
    }
    try {
      await navigator.clipboard.writeText(handle);
      flash('Username copied');
    } catch {
      setError('Could not copy username');
    }
  }

  function toggleMember(id: string) {
    setSelectedMembers((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else if (next.size < 8) next.add(id);
      return next;
    });
  }

  function toggleEditMember(id: string) {
    setEditMembers((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else if (next.size < 8) next.add(id);
      return next;
    });
  }

  function closeMemberEditor() {
    setEditingGroupId(null);
    setEditMembers(new Set());
  }

  function openManageMembers(group: FriendGroup) {
    if (editingGroupId === group.id) {
      closeMemberEditor();
      return;
    }
    setShowCreateGroup(false);
    setConfirmDeleteId(null);
    setError(null);
    setEditingGroupId(group.id);
    setEditMembers(
      new Set(
        group.members
          .filter((m) => m.userId !== group.ownerUserId && friendIds.has(m.userId))
          .map((m) => m.userId),
      ),
    );
  }

  async function onSaveGroupMembers(groupId: string) {
    setBusy(`edit-${groupId}`);
    setError(null);
    try {
      // Only friends — drop anyone no longer connected.
      const memberUserIds = [...editMembers].filter((id) => friendIds.has(id));
      await updateFriendGroup(groupId, { memberUserIds }, auth());
      closeMemberEditor();
      flash('Group updated');
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update group');
    } finally {
      setBusy(null);
    }
  }

  async function onAddFriend(targetUserId: string) {
    setBusy(targetUserId);
    setError(null);
    try {
      await sendFriendRequest(targetUserId, auth());
      setSearchQuery('');
      setSearchResults([]);
      flash('Friend request sent');
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
      flash(accept ? 'Friend added' : 'Request declined');
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
      setError('Give your group a name');
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
      flash('Group created');
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
      const msg = err instanceof Error ? err.message : 'Could not start table';
      // Friendlier wording for common server error.
      setError(
        /invite friends/i.test(msg)
          ? 'Some people left your friends list. Open Manage and update the group.'
          : msg,
      );
    } finally {
      setBusy(null);
    }
  }

  async function onDeleteGroup(groupId: string) {
    setBusy(`delete-${groupId}`);
    setError(null);
    try {
      await deleteFriendGroup(groupId, auth());
      setConfirmDeleteId(null);
      if (editingGroupId === groupId) closeMemberEditor();
      flash('Group deleted');
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete group');
    } finally {
      setBusy(null);
    }
  }

  /** Friends still linked, for starting a group table. */
  function playableMembers(g: FriendGroup): FriendProfile[] {
    return g.members.filter((m) => m.userId !== userId && friendIds.has(m.userId));
  }

  function MemberAvatarStack({ members }: { members: FriendProfile[] }) {
    const shown = members.slice(0, 3);
    const extra = members.length - shown.length;
    return (
      <div className="flex shrink-0 items-center">
        <div className="flex -space-x-2">
          {shown.map((m, i) => (
            <span
              key={m.userId}
              className="inline-flex rounded-full"
              style={{ zIndex: shown.length - i }}
            >
              <PlayerAvatar
                userId={m.userId}
                avatarId={m.avatarId}
                size={28}
                title={m.userId === userId ? 'You' : m.name}
              />
            </span>
          ))}
        </div>
        {extra > 0 && (
          <span className="ml-1.5 text-[11px] font-medium text-ink-strong-muted">+{extra}</span>
        )}
      </div>
    );
  }

  function FriendToggleRow({
    friend,
    selected,
    onToggle,
  }: {
    friend: FriendProfile;
    selected: boolean;
    onToggle: () => void;
  }) {
    return (
      <button
        type="button"
        onClick={onToggle}
        className={`flex w-full items-center gap-2.5 rounded-xl border px-2.5 py-2 text-left transition ${
          selected
            ? 'border-sidebar/40 bg-sidebar/[0.08] text-ink-strong'
            : 'border-transparent bg-mushroom/40 text-ink-strong-muted hover:border-sidebar/15 hover:bg-mushroom/70'
        }`}
      >
        <span
          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border text-[10px] font-bold ${
            selected
              ? 'border-sidebar bg-sidebar text-mushroom'
              : 'border-sidebar/25 bg-transparent text-transparent'
          }`}
          aria-hidden
        >
          ✓
        </span>
        <PlayerAvatar userId={friend.userId} avatarId={friend.avatarId} size={28} title={friend.name} />
        <span className="min-w-0 flex-1 truncate text-sm font-medium">{friend.name}</span>
      </button>
    );
  }

  return (
    <LobbySplitCard
      imageSrc="/home-host.png"
      imageAlt="Invite friends to your table"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="font-display text-xl font-bold tracking-tight text-ink-strong sm:text-2xl">
            Social
          </h1>
          <p className="mt-0.5 text-sm text-ink-strong-muted">
            Friends, groups, and private tables
          </p>
        </div>
        {username && (
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-sidebar/12 bg-mushroom/45 px-3 py-2">
            <div className="min-w-0">
              <p className="text-[10px] font-display font-semibold uppercase tracking-[0.14em] text-ink-strong-muted">
                Your username
              </p>
              <p className="truncate text-sm font-medium text-ink-strong">{username}</p>
            </div>
            <button
              type="button"
              disabled={disabled}
              onClick={() => void onCopyUsername()}
              className="btn-ghost py-1.5 px-2.5 text-xs"
            >
              Copy
            </button>
            <button
              type="button"
              disabled={disabled}
              onClick={() => void onShareUsername()}
              className="btn-primary py-1.5 px-2.5 text-xs"
            >
              Share
            </button>
          </div>
        )}
      </div>

      {(error || loadError || toast) && (
        <div
          role={error || loadError ? 'alert' : 'status'}
          className={`flex items-start justify-between gap-2 rounded-xl border px-3 py-2 text-sm ${
            error || loadError
              ? 'border-danger/25 bg-danger/10 text-danger'
              : 'border-sidebar/20 bg-sidebar/8 text-sidebar'
          }`}
        >
          <p className="min-w-0 flex-1 leading-snug">{error ?? loadError ?? toast}</p>
          {(error || loadError) && (
            <button
              type="button"
              className="shrink-0 text-xs font-semibold opacity-70 hover:opacity-100"
              onClick={() => {
                setError(null);
                setLoadError(null);
              }}
            >
              Dismiss
            </button>
          )}
        </div>
      )}

      <label className="block w-full">
        <span className="hud-label">Find player</span>
        <input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="hud-input"
          placeholder="Enter exact username…"
          maxLength={32}
          disabled={disabled}
          autoComplete="off"
          spellCheck={false}
        />
        <p className="mt-1 text-xs text-ink-strong-muted">
          Matches the full username only (case-insensitive).
        </p>
      </label>

      {searchResults.length > 0 && (
        <ul className="divide-y divide-sidebar/10 overflow-hidden rounded-xl border border-sidebar/12">
          {searchResults.map((u) => {
            const handle = u.username ?? u.name;
            return (
              <li key={u.userId} className="flex items-center gap-3 bg-mushroom/40 px-3 py-2.5">
                <PlayerAvatar userId={u.userId} avatarId={u.avatarId} size={32} title={handle} />
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink-strong">
                  {handle}
                </span>
                <button
                  type="button"
                  disabled={disabled || busy === u.userId}
                  onClick={() => void onAddFriend(u.userId)}
                  className="btn-ghost py-1.5 px-3 text-xs"
                >
                  Add friend
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {searchLookedUp && searchQuery.trim() && searchResults.length === 0 && (
        <p className="rounded-xl border border-dashed border-sidebar/20 bg-mushroom/35 px-3 py-2.5 text-sm text-ink-strong-muted">
          No user named{' '}
          <span className="font-medium text-ink-strong">{searchQuery.trim()}</span>
        </p>
      )}

      {incoming.length > 0 && (
        <section>
          <h2 className="hud-label">Friend requests</h2>
          <ul className="mt-2 grid gap-2 sm:grid-cols-2">
            {incoming.map((req) => (
              <li
                key={req.id}
                className="flex flex-wrap items-center gap-2 rounded-xl border border-sidebar/12 bg-mushroom/50 px-3 py-2.5"
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
          <h2 className="hud-label">Table invites</h2>
          <ul className="mt-2 grid gap-2 sm:grid-cols-2">
            {challenges.map((c) => (
              <li
                key={c.id}
                className="flex flex-col gap-2.5 rounded-xl border border-sidebar/15 bg-gradient-to-b from-mushroom/70 to-mushroom/40 px-3 py-3"
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
                      <span className="text-ink-strong-muted"> wants to play</span>
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

      <div className="grid gap-8 lg:grid-cols-2 lg:gap-10">
        {/* ——— Groups ——— */}
        <section className="min-w-0">
          <div className="flex items-center justify-between gap-2">
            <h2 className="hud-label">Groups</h2>
            <button
              type="button"
              disabled={disabled || friends.length === 0}
              title={friends.length === 0 ? 'Add a friend before creating a group' : undefined}
              onClick={() => {
                closeMemberEditor();
                setConfirmDeleteId(null);
                setShowCreateGroup((v) => !v);
              }}
              className="btn-ghost py-1.5 px-3 text-xs"
            >
              {showCreateGroup ? 'Cancel' : 'New group'}
            </button>
          </div>

          {showCreateGroup && (
            <form
              onSubmit={(e) => void onCreateGroup(e)}
              className="mt-3 space-y-3 rounded-2xl border border-sidebar/15 bg-mushroom/55 p-3.5 sm:p-4"
            >
              <label className="block">
                <span className="hud-label">Name</span>
                <input
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  className="hud-input"
                  placeholder="e.g. Friday night"
                  maxLength={40}
                  required
                  autoComplete="off"
                  autoFocus
                />
              </label>
              <div>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="hud-label">Friends to include</span>
                  <span className="text-[11px] text-ink-strong-muted">{selectedMembers.size}/8</span>
                </div>
                <p className="mt-1 text-xs text-ink-strong-muted">
                  You are always in the group. Pick who else sits with you.
                </p>
                <ul className="mt-2 max-h-44 space-y-1 overflow-y-auto">
                  {friends.map((f) => (
                    <li key={f.userId}>
                      <FriendToggleRow
                        friend={f}
                        selected={selectedMembers.has(f.userId)}
                        onToggle={() => toggleMember(f.userId)}
                      />
                    </li>
                  ))}
                </ul>
              </div>
              <button
                type="submit"
                disabled={disabled || busy === 'create-group' || !newGroupName.trim()}
                className="btn-primary min-h-10 w-full text-xs"
              >
                {busy === 'create-group' ? 'Creating…' : 'Create group'}
              </button>
            </form>
          )}

          {groups.length === 0 && !showCreateGroup ? (
            <div className="mt-3 rounded-2xl border border-dashed border-sidebar/20 bg-mushroom/35 px-4 py-6 text-center">
              <p className="text-sm font-medium text-ink-strong">No groups yet</p>
              <p className="mt-1 text-xs leading-relaxed text-ink-strong-muted">
                Make a crew of friends, then start a private table for everyone in one tap.
              </p>
              {friends.length > 0 && (
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => setShowCreateGroup(true)}
                  className="btn-primary mt-4 py-2 px-4 text-xs"
                >
                  Create your first group
                </button>
              )}
            </div>
          ) : (
            <ul className="mt-3 space-y-3">
              {groups.map((g) => {
                const editing = editingGroupId === g.id;
                const playable = playableMembers(g);
                const canManage = g.isOwner && friends.length > 0;
                const dirty =
                  editing &&
                  (() => {
                    const original = new Set(
                      g.members
                        .filter((m) => m.userId !== g.ownerUserId && friendIds.has(m.userId))
                        .map((m) => m.userId),
                    );
                    if (original.size !== editMembers.size) return true;
                    for (const id of editMembers) if (!original.has(id)) return true;
                    return false;
                  })();

                if (editing) {
                  return (
                    <li
                      key={g.id}
                      className="rounded-2xl border border-sidebar/25 bg-mushroom/60 p-3.5 shadow-[0_8px_24px_rgb(29_4_50/0.06)] sm:p-4"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-display text-sm font-semibold uppercase tracking-wider text-sidebar">
                            {g.name}
                          </p>
                          <p className="mt-0.5 text-xs text-ink-strong-muted">Edit who’s in this group</p>
                        </div>
                        <button
                          type="button"
                          onClick={closeMemberEditor}
                          className="btn-ghost shrink-0 py-1 px-2.5 text-xs"
                        >
                          Close
                        </button>
                      </div>

                      <div className="mt-3 flex items-center gap-2.5 rounded-xl border border-sidebar/10 bg-mushroom/70 px-2.5 py-2">
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-sidebar/30 bg-sidebar/10 text-[10px] text-sidebar">
                          ·
                        </span>
                        {g.members
                          .filter((m) => m.userId === g.ownerUserId)
                          .map((m) => (
                            <div key={m.userId} className="flex min-w-0 flex-1 items-center gap-2">
                              <PlayerAvatar
                                userId={m.userId}
                                avatarId={m.avatarId}
                                size={28}
                                title="You"
                              />
                              <div className="min-w-0">
                                <p className="truncate text-sm font-medium text-ink-strong">You</p>
                                <p className="text-[10px] uppercase tracking-wide text-ink-strong-muted">
                                  Owner · always included
                                </p>
                              </div>
                            </div>
                          ))}
                      </div>

                      <div className="mt-3">
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="hud-label">Friends</span>
                          <span className="text-[11px] text-ink-strong-muted">{editMembers.size}/8</span>
                        </div>
                        <ul className="mt-1.5 max-h-48 space-y-1 overflow-y-auto">
                          {friends.map((f) => (
                            <li key={f.userId}>
                              <FriendToggleRow
                                friend={f}
                                selected={editMembers.has(f.userId)}
                                onToggle={() => toggleEditMember(f.userId)}
                              />
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div className="mt-3 flex gap-2">
                        <button
                          type="button"
                          onClick={closeMemberEditor}
                          className="btn-ghost min-h-10 flex-1 text-xs"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          disabled={disabled || busy === `edit-${g.id}` || !dirty}
                          onClick={() => void onSaveGroupMembers(g.id)}
                          className="btn-primary min-h-10 flex-[1.4] text-xs"
                        >
                          {busy === `edit-${g.id}` ? 'Saving…' : 'Save'}
                        </button>
                      </div>
                    </li>
                  );
                }

                return (
                  <li
                    key={g.id}
                    className="rounded-2xl border border-sidebar/12 bg-mushroom/50 p-3.5 sm:p-4"
                  >
                    <div className="flex items-center gap-3">
                      <MemberAvatarStack members={g.members} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-display text-sm font-semibold uppercase tracking-wider text-sidebar">
                          {g.name}
                        </p>
                        <p className="mt-0.5 text-xs text-ink-strong-muted">
                          {g.members.length} member{g.members.length === 1 ? '' : 's'}
                          {g.isOwner ? '' : ' · shared with you'}
                        </p>
                      </div>
                    </div>

                    <ul className="mt-3 flex flex-wrap gap-1.5">
                      {g.members.map((m) => {
                        const isYou = m.userId === userId;
                        const isOwner = m.userId === g.ownerUserId;
                        return (
                          <li
                            key={m.userId}
                            className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-xs ${
                              isYou
                                ? 'border-sidebar/25 bg-sidebar/10 text-sidebar'
                                : 'border-sidebar/10 bg-mushroom/80 text-ink-strong-muted'
                            }`}
                          >
                            <PlayerAvatar
                              userId={m.userId}
                              avatarId={m.avatarId}
                              size={16}
                              title={isYou ? 'You' : m.name}
                            />
                            <span className="max-w-[6.5rem] truncate font-medium">
                              {isYou ? 'You' : m.name}
                            </span>
                            {isOwner && (
                              <span className="text-[9px] font-display uppercase tracking-wide opacity-55">
                                host
                              </span>
                            )}
                          </li>
                        );
                      })}
                    </ul>

                    <div className="mt-3 flex flex-col gap-2">
                      <button
                        type="button"
                        disabled={disabled || busy === `invite-${g.id}` || playable.length === 0}
                        title={
                          playable.length === 0
                            ? 'Add friends to this group to start a table'
                            : `Start a table with ${playable.length} friend${playable.length === 1 ? '' : 's'}`
                        }
                        onClick={() => void onInviteGroup(g.id)}
                        className="btn-primary min-h-10 w-full text-xs"
                      >
                        {busy === `invite-${g.id}`
                          ? 'Opening table…'
                          : playable.length === 0
                            ? 'Add friends to play'
                            : 'Invite to table'}
                      </button>

                      {g.isOwner && (
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-0.5">
                          {canManage && (
                            <button
                              type="button"
                              disabled={disabled}
                              onClick={() => openManageMembers(g)}
                              className="text-xs font-semibold text-sidebar underline-offset-2 hover:underline"
                            >
                              Manage members
                            </button>
                          )}
                          {confirmDeleteId === g.id ? (
                            <span className="flex flex-wrap items-center gap-2 text-xs">
                              <span className="text-ink-strong-muted">Delete this group?</span>
                              <button
                                type="button"
                                disabled={disabled || busy === `delete-${g.id}`}
                                onClick={() => void onDeleteGroup(g.id)}
                                className="font-semibold text-danger hover:underline"
                              >
                                Yes, delete
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteId(null)}
                                className="font-semibold text-ink-strong-muted hover:underline"
                              >
                                Keep
                              </button>
                            </span>
                          ) : (
                            <button
                              type="button"
                              disabled={disabled}
                              onClick={() => setConfirmDeleteId(g.id)}
                              className="text-xs font-medium text-ink-strong-muted hover:text-danger"
                            >
                              Delete
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* ——— Friends ——— */}
        <section className="min-w-0">
          <h2 className="hud-label">Friends · {friends.length}</h2>
          {friends.length === 0 ? (
            <div className="mt-3 rounded-2xl border border-dashed border-sidebar/20 bg-mushroom/35 px-4 py-6 text-center">
              <p className="text-sm font-medium text-ink-strong">No friends yet</p>
              <p className="mt-1 text-xs leading-relaxed text-ink-strong-muted">
                Enter someone&apos;s exact username above to send a request, then challenge them or
                add them to a group. Share your username so friends can find you.
              </p>
            </div>
          ) : (
            <ul className="mt-3 space-y-2">
              {friends.map((f) => (
                <li
                  key={f.userId}
                  className="flex items-center gap-3 rounded-2xl border border-sidebar/12 bg-mushroom/50 px-3 py-2.5"
                >
                  <PlayerAvatar userId={f.userId} avatarId={f.avatarId} size={36} title={f.name} />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink-strong">
                    {f.name}
                  </span>
                  <button
                    type="button"
                    disabled={disabled || busy === `challenge-${f.userId}`}
                    onClick={() => void onChallenge(f.userId)}
                    className="btn-primary shrink-0 py-1.5 px-3 text-xs"
                  >
                    Challenge
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {!userId && (
        <p className="text-sm text-ink-strong-muted">Sign in to use friends and groups.</p>
      )}
    </LobbySplitCard>
  );
}
