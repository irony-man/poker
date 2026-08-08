'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { LobbySplitCard } from '@/components/LobbySplitCard';
import { PlayerAvatar } from '@/components/PlayerAvatar';
import {
  challengeFriend,
  createFriendGroup,
  declineFriendChallenge,
  deleteFriendGroup,
  inviteFriendGroup,
  joinFriendChallenge,
  listFriends,
  registerContest,
  removeFriend,
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
  onNavigateContest,
  variant = 'page',
  onFriendCountChange,
}: {
  disabled: boolean;
  onNavigateTable: (tableId: string, inviteCode: string) => void;
  onNavigateContest?: (contestId: string) => void;
  /** Page uses lobby split+art; embedded is a single column for profile tab. */
  variant?: 'page' | 'embedded';
  onFriendCountChange?: (count: number) => void;
}) {
  const userId = useSession((s) => s.userId);
  const sessionToken = useSession((s) => s.sessionToken);
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

  const [socialTab, setSocialTab] = useState<'friends' | 'groups'>('friends');
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
      onFriendCountChange?.(data.friends.length);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Could not load friends');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- auth is derived from session
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

  async function onRemoveFriend(friend: FriendProfile) {
    if (disabled || !sessionToken) return;
    const ok = window.confirm(`Remove ${friend.name} from your friends?`);
    if (!ok) return;
    setBusy(`remove-${friend.userId}`);
    setError(null);
    try {
      await removeFriend(friend.userId, auth());
      flash(`Removed ${friend.name}`);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not remove friend');
    } finally {
      setBusy(null);
    }
  }

  async function onJoinChallenge(challenge: PendingChallenge) {
    setBusy(`join-${challenge.id}`);
    setError(null);
    try {
      await joinFriendChallenge(challenge.id, auth());
      const isContest = challenge.kind === 'contest' || Boolean(challenge.contestId);
      if (isContest && challenge.contestId) {
        try {
          await registerContest(challenge.contestId, auth());
        } catch {
          // May already be registered or contest full — still open lobby
        }
        if (onNavigateContest) onNavigateContest(challenge.contestId);
        else window.location.href = `/contest/${challenge.contestId}`;
      } else if (challenge.tableId) {
        onNavigateTable(challenge.tableId, challenge.inviteCode);
      } else {
        setError('Invite is no longer valid');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to join challenge');
    } finally {
      setBusy(null);
    }
  }

  async function onDeclineChallenge(challengeId: string) {
    setBusy(`decline-${challengeId}`);
    setError(null);
    try {
      await declineFriendChallenge(challengeId, auth());
      setChallenges((list) => list.filter((c) => c.id !== challengeId));
      flash('Invite declined');
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not decline invite');
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

  const playerSearch = (
    <div className="flex w-full flex-col gap-3">
      <label className="block w-full">
        <span className="hud-label !font-bold">Find a Friend</span>
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
        <ul className="divide-y divide-sidebar/10 overflow-hidden rounded-xl border border-sidebar/12 bg-white/80">
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
    </div>
  );

  const socialBody = (
    <>
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
                <div className="flex shrink-0 items-center gap-1.5">
                  <IconAction
                    label="Accept friend request"
                    disabled={disabled || busy === req.id}
                    tone="primary"
                    onClick={() => void onRespond(req.id, true)}
                  >
                    <CheckIcon className="h-4 w-4" />
                  </IconAction>
                  <IconAction
                    label="Decline friend request"
                    disabled={disabled || busy === req.id}
                    tone="ghost"
                    onClick={() => void onRespond(req.id, false)}
                  >
                    <XIcon className="h-4 w-4" />
                  </IconAction>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {challenges.length > 0 && (
        <section>
          <h2 className="hud-label">Invites</h2>
          <ul className="mt-2 grid gap-2 sm:grid-cols-2">
            {challenges.map((c) => {
              const isContest = c.kind === 'contest' || Boolean(c.contestId);
              const actionBusy = busy === `join-${c.id}` || busy === `decline-${c.id}`;
              return (
                <li
                  key={c.id}
                  className="flex items-center gap-2 rounded-xl border border-sidebar/15 bg-gradient-to-b from-mushroom/70 to-mushroom/40 px-3 py-2.5"
                >
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
                    ) : isContest ? (
                      <span className="text-ink-strong-muted"> invited you to a contest</span>
                    ) : (
                      <span className="text-ink-strong-muted"> wants to play</span>
                    )}
                  </span>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <IconAction
                      label={isContest ? 'Join contest' : 'Join table'}
                      disabled={disabled || actionBusy}
                      tone="primary"
                      onClick={() => void onJoinChallenge(c)}
                    >
                      <JoinTableIcon className="h-4 w-4" />
                    </IconAction>
                    <IconAction
                      label="Decline invite"
                      disabled={disabled || actionBusy}
                      tone="ghost"
                      onClick={() => void onDeclineChallenge(c.id)}
                    >
                      <XIcon className="h-4 w-4" />
                    </IconAction>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <div className="min-w-0">
        {variant !== 'embedded' ? (
          <div
            role="tablist"
            aria-label="Friends and groups"
            className="flex rounded-xl border border-sidebar/15 bg-mushroom/50 p-1"
          >
            {(
              [
                { id: 'friends' as const, label: 'Friends' },
                { id: 'groups' as const, label: 'Groups' },
              ] as const
            ).map((tab) => {
              const selected = socialTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  id={`social-tab-${tab.id}`}
                  aria-selected={selected}
                  aria-controls={`social-panel-${tab.id}`}
                  disabled={disabled}
                  onClick={() => setSocialTab(tab.id)}
                  className={[
                    'relative min-h-10 flex-1 rounded-lg px-3 py-2 text-center font-display text-xs font-bold uppercase tracking-[0.14em] transition',
                    selected
                      ? 'bg-sidebar text-mushroom shadow-[0_4px_14px_rgb(29_4_50/0.18)]'
                      : 'text-ink-strong-muted hover:bg-sidebar/[0.06] hover:text-sidebar',
                  ].join(' ')}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        ) : null}

        {variant !== 'embedded' && socialTab === 'groups' && (
        <section
          role="tabpanel"
          id="social-panel-groups"
          aria-labelledby="social-tab-groups"
          className="mt-3 min-w-0"
        >
          <div className="flex items-center justify-end gap-2">
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
                      <div className="flex items-center gap-2">
                        <IconAction
                          label={
                            playable.length === 0
                              ? 'Add friends to this group to start a table'
                              : `Invite group to table (${playable.length} friend${playable.length === 1 ? '' : 's'})`
                          }
                          disabled={disabled || busy === `invite-${g.id}` || playable.length === 0}
                          tone="primary"
                          className="min-h-10 min-w-10"
                          onClick={() => void onInviteGroup(g.id)}
                        >
                          {busy === `invite-${g.id}` ? (
                            <span className="text-[10px] font-display font-bold uppercase tracking-wider">
                              …
                            </span>
                          ) : (
                            <InviteTableIcon className="h-4 w-4" />
                          )}
                        </IconAction>
                        <span className="min-w-0 text-xs text-ink-strong-muted">
                          {playable.length === 0
                            ? 'Add friends to play'
                            : busy === `invite-${g.id}`
                              ? 'Opening table…'
                              : 'Invite to table'}
                        </span>
                      </div>

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
        )}

        {(variant === 'embedded' || socialTab === 'friends') && (
        <section
          role="tabpanel"
          id="social-panel-friends"
          aria-labelledby="social-tab-friends"
          className={variant === 'embedded' ? 'min-w-0' : 'mt-3 min-w-0'}
        >
          {friends.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-sidebar/20 bg-mushroom/35 px-4 py-6 text-center">
              <p className="text-sm font-medium text-ink-strong">No friends yet</p>
              <p className="mt-1 text-xs leading-relaxed text-ink-strong-muted">
                Enter someone&apos;s exact username under Find player to send a request, then
                challenge them or add them to a group.
              </p>
            </div>
          ) : (
            <ul className="space-y-2">
              {friends.map((f) => (
                <li
                  key={f.userId}
                  className="flex items-center gap-3 rounded-2xl border border-sidebar/12 bg-mushroom/50 px-3 py-2.5"
                >
                  <PlayerAvatar userId={f.userId} avatarId={f.avatarId} size={36} title={f.name} />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink-strong">
                    {f.name}
                  </span>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <IconAction
                      label={
                        busy === `remove-${f.userId}`
                          ? 'Removing…'
                          : `Remove ${f.name}`
                      }
                      disabled={
                        disabled ||
                        busy === `remove-${f.userId}` ||
                        busy === `challenge-${f.userId}`
                      }
                      tone="ghost"
                      onClick={() => void onRemoveFriend(f)}
                    >
                      {busy === `remove-${f.userId}` ? (
                        <span className="text-[10px] font-display font-bold uppercase tracking-wider">
                          …
                        </span>
                      ) : (
                        <RemoveFriendIcon className="h-4 w-4" />
                      )}
                    </IconAction>
                    <IconAction
                      label={
                        busy === `challenge-${f.userId}`
                          ? 'Starting challenge…'
                          : `Challenge ${f.name}`
                      }
                      disabled={
                        disabled ||
                        busy === `challenge-${f.userId}` ||
                        busy === `remove-${f.userId}`
                      }
                      tone="primary"
                      onClick={() => void onChallenge(f.userId)}
                    >
                      {busy === `challenge-${f.userId}` ? (
                        <span className="text-[10px] font-display font-bold uppercase tracking-wider">
                          …
                        </span>
                      ) : (
                        <ChallengeIcon className="h-4 w-4" />
                      )}
                    </IconAction>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
        )}
      </div>

      {!userId && (
        <p className="text-sm text-ink-strong-muted">Sign in to use friends and groups.</p>
      )}
    </>
  );

  if (variant === 'embedded') {
    return (
      <div className="flex min-w-0 flex-col gap-4 sm:gap-5">
        {playerSearch}
        {socialBody}
      </div>
    );
  }

  return (
    <LobbySplitCard
      imageSrc="/home-host.png"
      imageAlt="Invite friends to your table"
      mediaHeader={playerSearch}
    >
      {socialBody}
    </LobbySplitCard>
  );
}

function IconAction({
  label,
  disabled,
  tone,
  onClick,
  children,
  className = '',
}: {
  label: string;
  disabled?: boolean;
  tone: 'primary' | 'ghost';
  onClick: () => void;
  children: ReactNode;
  className?: string;
}) {
  const base =
    'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border text-sm transition disabled:opacity-50 disabled:pointer-events-none';
  const tones =
    tone === 'primary'
      ? 'btn-primary !min-h-0 !w-9 !px-0 !py-0 shadow-sm'
      : 'btn-ghost !min-h-0 !w-9 !px-0 !py-0';
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`${base} ${tones} ${className}`.trim()}
    >
      {children}
    </button>
  );
}

function iconProps(className?: string) {
  return {
    viewBox: '0 0 24 24',
    fill: 'none' as const,
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    className,
    'aria-hidden': true as const,
  };
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg {...iconProps(className)}>
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg {...iconProps(className)}>
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

/** Enter / join a shared table or contest. */
function JoinTableIcon({ className }: { className?: string }) {
  return (
    <svg {...iconProps(className)}>
      <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
      <path d="M10 17 15 12 10 7" />
      <path d="M15 12H3" />
    </svg>
  );
}

/** 1v1 challenge — crossed swords. */
function ChallengeIcon({ className }: { className?: string }) {
  return (
    <svg {...iconProps(className)}>
      <path d="M14.5 17.5 3 6V3h3l11.5 11.5" />
      <path d="m13 19 6-6" />
      <path d="m16 16 4 4" />
      <path d="m19 21 2-2" />
      <path d="M14.5 6.5 18 3h3v3l-3.5 3.5" />
      <path d="m5 14 4 4" />
      <path d="m7 17-3 3" />
      <path d="m3 19 2 2" />
    </svg>
  );
}

/** Remove from friends list. */
function RemoveFriendIcon({ className }: { className?: string }) {
  return (
    <svg {...iconProps(className)}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <line x1="22" x2="16" y1="11" y2="11" />
    </svg>
  );
}

/** Invite group of friends around a table. */
function InviteTableIcon({ className }: { className?: string }) {
  return (
    <svg {...iconProps(className)}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}
