'use client';

import { useState } from 'react';
import { LobbySplitCard } from '@/components/LobbySplitCard';
import { PlayerAvatar } from '@/components/PlayerAvatar';
import { Button } from '@/components/ui/Button';
import { Tabs } from '@/components/ui/Tabs';
import { TextField } from '@/components/ui/TextField';
import { imageAssetUrl } from '@/lib/assets';
import {
  challengeFriend,
  createFriendGroup,
  declineFriendChallenge,
  deleteFriendGroup,
  inviteFriendGroup,
  joinFriendChallenge,
  registerContest,
  removeFriend,
  respondFriendRequest,
  sendFriendRequest,
  updateFriendGroup,
  type FriendGroup,
  type FriendProfile,
  type PendingChallenge,
} from '@/lib/api';
import { useFriendsSocial } from '@/hooks/useFriendsSocial';
import { useConfirm } from '@/components/ConfirmPopover';
import { FriendGroups } from './FriendGroups';
import { FriendInvites } from './FriendInvites';
import { FriendList } from './FriendList';

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
  const confirm = useConfirm();
  const {
    userId,
    sessionToken,
    refreshSocial,
    friends,
    groups,
    incoming,
    challenges,
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
  } = useFriendsSocial({ disabled, onFriendCountChange });

  const [socialTab, setSocialTab] = useState<'friends' | 'groups'>('friends');
  const [newGroupName, setNewGroupName] = useState('');
  const [selectedMembers, setSelectedMembers] = useState<Set<string>>(new Set());
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editMembers, setEditMembers] = useState<Set<string>>(new Set());
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

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
      void refreshSocial();
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
    const ok = await confirm({
      title: `Remove ${friend.name}?`,
      description: 'They will leave your friends list. You can add them again later.',
      confirmLabel: 'Remove',
      cancelLabel: 'Cancel',
      tone: 'danger',
    });
    if (!ok) return;
    setBusy(`remove-${friend.userId}`);
    setError(null);
    try {
      await removeFriend(friend.userId, auth());
      flash(`Removed ${friend.name}`);
      await refresh();
      void refreshSocial();
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
      void refreshSocial();
      const isContest = challenge.kind === 'contest' || Boolean(challenge.contestId);
      if (isContest && challenge.contestId) {
        try {
          await registerContest(challenge.contestId, auth());
        } catch {
          /* already registered or full — still open lobby */
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
      void refreshSocial();
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
        { name: newGroupName.trim(), memberUserIds: [...selectedMembers] },
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

  const playerSearch = (
    <div className="flex w-full flex-col gap-3">
      <TextField
        variant="hud"
        label={<span className="!font-bold">Find a Friend</span>}
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        placeholder="Enter exact username…"
        maxLength={32}
        disabled={disabled}
        autoComplete="off"
        spellCheck={false}
        help="Matches the full username only (case-insensitive)."
      />

      {searchResults.length > 0 && (
        <ul className="surface-list bg-white/80">
          {searchResults.map((u) => {
            const handle = u.username ?? u.name;
            return (
              <li key={u.userId} className="flex items-center gap-3 bg-mushroom/40 px-3 py-2.5">
                <PlayerAvatar
                  userId={u.userId}
                  avatarId={u.avatarId}
                  avatarUrl={u.avatarUrl}
                  size={32}
                  title={handle}
                />
                <span className="font-row-label">
                  {handle}
                </span>
                <Button
                  variant="ghost"
                  disabled={disabled || busy === u.userId}
                  onClick={() => void onAddFriend(u.userId)}
                  className="py-1.5 px-3 text-xs"
                >
                  Add friend
                </Button>
              </li>
            );
          })}
        </ul>
      )}

      {searchLookedUp && searchQuery.trim() && searchResults.length === 0 && (
        <p className="surface-empty text-sm text-ink-strong-muted">
          No user named <span className="font-medium text-ink-strong">{searchQuery.trim()}</span>
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

      <FriendInvites
        incoming={incoming}
        challenges={challenges}
        busy={busy}
        disabled={disabled}
        onRespond={(id, accept) => void onRespond(id, accept)}
        onJoinChallenge={(c) => void onJoinChallenge(c)}
        onDeclineChallenge={(id) => void onDeclineChallenge(id)}
      />

      <div className="min-w-0">
        {variant !== 'embedded' ? (
          <Tabs
            label="Friends and groups"
            variant="segmented"
            idPrefix="social-tab"
            selected={socialTab}
            onSelect={setSocialTab}
            disabled={disabled}
            options={[
              { id: 'friends', label: 'Friends', panelId: 'social-panel-friends' },
              { id: 'groups', label: 'Groups', panelId: 'social-panel-groups' },
            ]}
          />
        ) : null}

        {variant !== 'embedded' && socialTab === 'groups' && (
          <FriendGroups
            groups={groups}
            friends={friends}
            friendIds={friendIds}
            userId={userId}
            busy={busy}
            disabled={disabled}
            showCreateGroup={showCreateGroup}
            newGroupName={newGroupName}
            selectedMembers={selectedMembers}
            editingGroupId={editingGroupId}
            editMembers={editMembers}
            confirmDeleteId={confirmDeleteId}
            onToggleCreate={() => {
              closeMemberEditor();
              setConfirmDeleteId(null);
              setShowCreateGroup((v) => !v);
            }}
            onCreateGroup={(e) => void onCreateGroup(e)}
            onNewGroupName={setNewGroupName}
            onToggleMember={toggleMember}
            onInviteGroup={(id) => void onInviteGroup(id)}
            onOpenManage={openManageMembers}
            onCloseEditor={closeMemberEditor}
            onToggleEditMember={toggleEditMember}
            onSaveMembers={(id) => void onSaveGroupMembers(id)}
            onConfirmDelete={setConfirmDeleteId}
            onCancelDelete={() => setConfirmDeleteId(null)}
            onDeleteGroup={(id) => void onDeleteGroup(id)}
          />
        )}

        {(variant === 'embedded' || socialTab === 'friends') && (
          <section
            role="tabpanel"
            id="social-panel-friends"
            aria-labelledby="social-tab-friends"
            className={variant === 'embedded' ? 'min-w-0' : 'mt-3 min-w-0'}
          >
            <FriendList
              friends={friends}
              busy={busy}
              disabled={disabled}
              onRemoveFriend={(f) => void onRemoveFriend(f)}
              onChallenge={(id) => void onChallenge(id)}
            />
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
      imageSrc={imageAssetUrl('home-host.png')}
      imageAlt="Invite friends to your table"
      mediaHeader={playerSearch}
    >
      {socialBody}
    </LobbySplitCard>
  );
}
