'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { LobbySplitCard } from '@/components/LobbySplitCard';
import { NewBadge } from '@/components/NewBadge';
import { PlayerAvatar } from '@/components/PlayerAvatar';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { Tabs } from '@/components/ui/Tabs';
import { TextField } from '@/components/ui/TextField';
import { imageAssetUrl, resolvePublicImage } from '@/lib/assets';
import { authHref } from '@/lib/authRedirect';
import { cn } from '@/lib/cn';
import { markFeatureSeen } from '@/lib/newFeatures';
import { useNewFeature } from '@/lib/useNewFeature';
import {
  cancelFriendChallenge,
  cancelFriendRequest,
  challengeFriend,
  createFriendGroup,
  declineFriendChallenge,
  deleteFriendGroup,
  dismissFriendSuggestion,
  inviteFriendGroup,
  joinFriendChallenge,
  registerContest,
  removeFriend,
  respondFriendRequest,
  sendFriendRequest,
  updateFriendGroup,
  type FriendGroup,
  type FriendProfile,
  type FriendSuggestion,
  type PendingChallenge,
} from '@/lib/api';
import { useFriendSuggestions } from '@/hooks/useFriendSuggestions';
import { useFriendsSocial } from '@/hooks/useFriendsSocial';
import { useConfirm } from '@/components/ConfirmPopover';
import { publicProfileHref } from '@/lib/publicProfile';
import { FriendGroups } from './FriendGroups';
import { FriendInvites } from './FriendInvites';
import { EmailInviteDialog } from './EmailInviteDialog';
import { FriendLinkDialog } from './FriendLinkDialog';
import { FriendList } from './FriendList';
import { FriendSuggestions } from './FriendSuggestions';
import { AddFriendIcon, LinkIcon, MailIcon } from './icons';

type SocialTab = 'pending' | 'friends' | 'groups';

function parseSocialTab(raw: string | null | undefined): SocialTab | null {
  if (raw === 'pending' || raw === 'friends' || raw === 'groups') return raw;
  return null;
}

function tabFromLocation(): SocialTab | null {
  if (typeof window === 'undefined') return null;
  return parseSocialTab(new URLSearchParams(window.location.search).get('tab'));
}

function TabCount({
  count,
  selected,
  alert = false,
  title,
}: {
  count: number;
  selected: boolean;
  alert?: boolean;
  title?: string;
}) {
  if (count <= 0) return null;
  return (
    <span
      title={title}
      className={cn(
        'ml-1 inline-flex h-4 min-w-4 shrink-0 items-center justify-center rounded-full px-1 text-[10px] font-bold leading-none tracking-normal tabular-nums sm:ml-2 sm:h-[18px] sm:min-w-[18px] sm:px-1.5',
        alert
          ? 'bg-danger text-on-chrome'
          : cn(
              'max-[359px]:hidden',
              selected ? 'bg-white/20 text-on-chrome' : 'bg-sidebar/10 text-sidebar',
            ),
      )}
    >
      {count}
    </span>
  );
}

/** Friends, groups & challenges for the main lobby content area. */
export function FriendsPanel({
  disabled,
  onNavigateTable,
  onNavigateContest,
  onNavigateLudo,
  onNavigateSnakes,
  onNavigateMemory,
  onNavigateCourtpiece,
  variant = 'page',
  onFriendCountChange,
  imageSrc,
  imageAlt,
}: {
  disabled: boolean;
  onNavigateTable: (tableId: string, inviteCode: string) => void;
  onNavigateContest?: (contestId: string) => void;
  onNavigateLudo?: (ludoId: string, inviteCode: string) => void;
  onNavigateSnakes?: (snakesId: string, inviteCode: string) => void;
  onNavigateMemory?: (memoryId: string, inviteCode: string) => void;
  onNavigateCourtpiece?: (courtpieceId: string, inviteCode: string) => void;
  /** Page uses lobby split+art; embedded is a single column for profile tab. */
  variant?: 'page' | 'embedded';
  onFriendCountChange?: (count: number) => void;
  imageSrc?: string;
  imageAlt?: string;
}) {
  const confirm = useConfirm();
  const {
    userId,
    sessionToken,
    refreshSocial,
    friends,
    groups,
    incoming,
    outgoing,
    challenges,
    outgoingChallenges,
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
    loadError,
    setLoadError,
    auth,
    friendIds,
    flash,
    refresh,
  } = useFriendsSocial({ disabled, onFriendCountChange });
  const { suggestions, removeSuggestion } = useFriendSuggestions({ disabled });
  const [inviteDialog, setInviteDialog] = useState<'link' | 'email' | null>(null);
  const linkInviteNew = useNewFeature('friends-link-invite');
  const closeInviteDialog = useCallback(() => setInviteDialog(null), []);

  const incomingPendingCount = incoming.length + challenges.length;
  const sentPendingCount = outgoing.length + outgoingChallenges.length;
  const [socialTab, setSocialTab] = useState<SocialTab>(() => {
    const fromUrl = tabFromLocation();
    if (fromUrl) return fromUrl;
    return incomingPendingCount > 0 ? 'pending' : 'friends';
  });
  const didAutoSelectPending = useRef(false);

  useEffect(() => {
    const fromUrl = tabFromLocation();
    if (fromUrl) {
      setSocialTab(fromUrl);
      return;
    }
    if (!didAutoSelectPending.current && incomingPendingCount > 0) {
      didAutoSelectPending.current = true;
      setSocialTab('pending');
    }
  }, [incomingPendingCount]);

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
      removeSuggestion(targetUserId);
      flash('Friend request sent');
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add friend');
    } finally {
      setBusy(null);
    }
  }

  async function onDismissSuggestion(suggestion: FriendSuggestion) {
    setBusy(`dismiss-${suggestion.userId}`);
    setError(null);
    try {
      await dismissFriendSuggestion(suggestion.userId, auth());
      removeSuggestion(suggestion.userId);
      flash('Suggestion hidden');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not hide suggestion');
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
      const isLudo = challenge.kind === 'ludo' || Boolean(challenge.ludoId);
      const isSnakes = challenge.kind === 'snakes' || Boolean(challenge.snakesId);
      const isMemory = challenge.kind === 'memory' || Boolean(challenge.memoryId);
      const isCourtpiece = challenge.kind === 'courtpiece' || Boolean(challenge.courtpieceId);
      if (isContest && challenge.contestId) {
        try {
          await registerContest(challenge.contestId, auth());
        } catch {
          /* already registered or full — still open lobby */
        }
        if (onNavigateContest) onNavigateContest(challenge.contestId);
        else window.location.href = `/contest/${challenge.contestId}`;
      } else if (isLudo && challenge.ludoId) {
        if (onNavigateLudo) onNavigateLudo(challenge.ludoId, challenge.inviteCode);
        else window.location.href = `/ludo/${challenge.ludoId}?invite=${challenge.inviteCode}`;
      } else if (isSnakes && challenge.snakesId) {
        if (onNavigateSnakes) onNavigateSnakes(challenge.snakesId, challenge.inviteCode);
        else window.location.href = `/snakes/${challenge.snakesId}?invite=${challenge.inviteCode}`;
      } else if (isMemory && challenge.memoryId) {
        if (onNavigateMemory) onNavigateMemory(challenge.memoryId, challenge.inviteCode);
        else window.location.href = `/memory/${challenge.memoryId}?invite=${challenge.inviteCode}`;
      } else if (isCourtpiece && challenge.courtpieceId) {
        if (onNavigateCourtpiece) {
          onNavigateCourtpiece(challenge.courtpieceId, challenge.inviteCode);
        } else {
          window.location.href = `/courtpiece/${challenge.courtpieceId}?invite=${challenge.inviteCode}`;
        }
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

  async function onCancelRequest(requestId: string) {
    setBusy(`cancel-req-${requestId}`);
    setError(null);
    try {
      await cancelFriendRequest(requestId, auth());
      flash('Request cancelled');
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not cancel request');
    } finally {
      setBusy(null);
    }
  }

  async function onCancelChallenge(challengeId: string) {
    setBusy(`cancel-ch-${challengeId}`);
    setError(null);
    try {
      await cancelFriendChallenge(challengeId, auth());
      flash('Invite cancelled');
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not cancel invite');
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
    <div className="flex w-full flex-col gap-2">
      <TextField
        variant="hud"
        label="Find a friend"
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
              <li
                key={u.userId}
                className="flex items-center gap-3 bg-raised/60 px-3 py-2.5 transition-colors hover:bg-raised"
              >
                <Link
                  href={publicProfileHref(handle)}
                  className="shrink-0 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-sidebar/40"
                  title={`View ${handle}`}
                >
                  <PlayerAvatar
                    userId={u.userId}
                    avatarId={u.avatarId}
                    avatarUrl={u.avatarUrl}
                    size={36}
                    title={handle}
                  />
                </Link>
                <Link
                  href={publicProfileHref(handle)}
                  className="font-row-label min-w-0 flex-1 truncate hover:underline"
                >
                  {handle}
                </Link>
                {friendIds.has(u.userId) ? (
                  <span className="shrink-0 text-xs font-semibold text-positive">Friends</span>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={disabled || busy === u.userId}
                    onClick={() => void onAddFriend(u.userId)}
                    className="inline-flex shrink-0 items-center gap-1.5"
                  >
                    <AddFriendIcon className="h-3.5 w-3.5" />
                    Add friend
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {searchLookedUp && searchQuery.trim() && searchResults.length === 0 && (
        <p className="surface-empty text-sm text-muted">
          No user named <span className="font-medium text-primary">{searchQuery.trim()}</span>
        </p>
      )}
    </div>
  );

  const inviteButtons = (
    <>
      {userId && (
        <section aria-labelledby="friend-invite-heading" className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between gap-2">
            <h2 id="friend-invite-heading" className="hud-label">
              Invite someone new
            </h2>
            <span className="hidden text-[11px] text-muted sm:inline">
              Share a link or email an invite
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="relative min-w-0">
              <IconButton
                className="w-full"
                variant="ghost"
                size="sm"
                icon={<LinkIcon />}
                label="Friend Link"
                disabled={disabled}
                onClick={() => {
                  markFeatureSeen('friends-link-invite');
                  setInviteDialog('link');
                }}
              >
                Friend Link
              </IconButton>
              {linkInviteNew ? (
                <NewBadge tone="light" className="pointer-events-none absolute -right-1.5 -top-2" />
              ) : null}
            </div>
            <IconButton
              className="w-full"
              variant="ghost"
              size="sm"
              icon={<MailIcon />}
              label="Email Invite"
              disabled={disabled}
              onClick={() => setInviteDialog('email')}
            >
              Email Invite
            </IconButton>
          </div>
        </section>
      )}
      <FriendLinkDialog open={inviteDialog === 'link'} onClose={closeInviteDialog} />
      <EmailInviteDialog open={inviteDialog === 'email'} onClose={closeInviteDialog} />
    </>
  );

  const errorAlert =
    error || loadError ? (
      <div
        role="alert"
        className="flex items-start justify-between gap-2 rounded-xl border border-danger/25 bg-danger/10 px-3 py-2 text-sm text-danger"
      >
        <p className="min-w-0 flex-1 leading-snug">{error ?? loadError}</p>
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
      </div>
    ) : null;

  const socialBody = (
    <>
      <div className="min-w-0 border-t border-sidebar/10 pt-5 sm:pt-6">
        <Tabs
          label="Friends, pending, and groups"
          variant="segmented"
          className="gap-0.5 [&>button]:min-w-0 [&>button]:px-1.5 [&>button]:text-[11px] [&>button]:tracking-[0.06em] sm:gap-0 sm:[&>button]:px-3 sm:[&>button]:text-xs sm:[&>button]:tracking-[0.14em]"
          idPrefix="social-tab"
          selected={socialTab}
          onSelect={setSocialTab}
          disabled={disabled}
          options={[
            {
              id: 'pending',
              label: 'Pending',
              panelId: 'social-panel-pending',
              badge:
                incomingPendingCount > 0 ? (
                  <TabCount
                    count={incomingPendingCount}
                    selected={socialTab === 'pending'}
                    alert
                    title={`${incomingPendingCount} waiting on you${
                      sentPendingCount > 0 ? ` · ${sentPendingCount} sent` : ''
                    }`}
                  />
                ) : (
                  <TabCount
                    count={sentPendingCount}
                    selected={socialTab === 'pending'}
                    title={`${sentPendingCount} sent`}
                  />
                ),
            },
            {
              id: 'friends',
              label: 'Friends',
              panelId: 'social-panel-friends',
              badge: <TabCount count={friends.length} selected={socialTab === 'friends'} />,
            },
            {
              id: 'groups',
              label: 'Groups',
              panelId: 'social-panel-groups',
              badge: <TabCount count={groups.length} selected={socialTab === 'groups'} />,
            },
          ]}
        />

        {socialTab === 'pending' ? (
          <section
            role="tabpanel"
            id="social-panel-pending"
            aria-labelledby="social-tab-pending"
            className="mt-3 min-w-0"
          >
            <FriendInvites
              incoming={incoming}
              challenges={challenges}
              outgoing={outgoing}
              outgoingChallenges={outgoingChallenges}
              busy={busy}
              disabled={disabled}
              onRespond={(id, accept) => void onRespond(id, accept)}
              onJoinChallenge={(c) => void onJoinChallenge(c)}
              onDeclineChallenge={(id) => void onDeclineChallenge(id)}
              onCancelRequest={(id) => void onCancelRequest(id)}
              onCancelChallenge={(id) => void onCancelChallenge(id)}
            />
          </section>
        ) : null}

        {socialTab === 'groups' && (
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

        {socialTab === 'friends' && (
          <section
            role="tabpanel"
            id="social-panel-friends"
            aria-labelledby="social-tab-friends"
            className="mt-3 min-w-0"
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
    </>
  );

  const signedOutNote = (
    <div className="surface-empty-lg">
      <p className="text-sm font-medium text-primary">Sign in to see your friends</p>
      <p className="mt-1 text-xs leading-relaxed text-muted">
        Your friends list, pending requests and groups live on your account.
      </p>
      <div className="mt-4 flex justify-center gap-2">
        <Button href={authHref('sign-in', '/friends')} size="sm">
          Sign in
        </Button>
        <Button href={authHref('sign-up', '/friends')} variant="ghost" size="sm">
          Create account
        </Button>
      </div>
    </div>
  );

  const friendsPages = (
    <>
      {errorAlert}
      {inviteButtons}
      {playerSearch}
      {userId && !searchQuery.trim() && (
        <FriendSuggestions
          suggestions={suggestions}
          busy={busy}
          disabled={disabled}
          onAdd={(id) => void onAddFriend(id)}
          onDismiss={(s) => void onDismissSuggestion(s)}
        />
      )}
      {userId ? socialBody : signedOutNote}
    </>
  );

  if (variant === 'embedded') {
    return <div className="flex min-w-0 flex-col gap-4 sm:gap-5">{friendsPages}</div>;
  }

  return (
    <LobbySplitCard
      imageSrc={resolvePublicImage(imageSrc || imageAssetUrl('home-host.webp'))}
      imageAlt={imageAlt || 'Invite friends to your table'}
      imageRight
      alignTop
      stickyMedia
    >
      {friendsPages}
    </LobbySplitCard>
  );
}
