import { PlayerAvatar } from '@/components/PlayerAvatar';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import { groupMembersDirty } from '@/hooks/useFriendsSocial';
import type { FriendGroup, FriendProfile } from '@/lib/api';
import { IconAction, InviteTableIcon } from './icons';
import { FriendToggleRow, MemberAvatarStack } from './rows';

export function FriendGroups({
  groups,
  friends,
  friendIds,
  userId,
  busy,
  disabled,
  showCreateGroup,
  newGroupName,
  selectedMembers,
  editingGroupId,
  editMembers,
  confirmDeleteId,
  onToggleCreate,
  onCreateGroup,
  onNewGroupName,
  onToggleMember,
  onInviteGroup,
  onOpenManage,
  onCloseEditor,
  onToggleEditMember,
  onSaveMembers,
  onConfirmDelete,
  onCancelDelete,
  onDeleteGroup,
}: {
  groups: FriendGroup[];
  friends: FriendProfile[];
  friendIds: Set<string>;
  userId: string | null;
  busy: string | null;
  disabled: boolean;
  showCreateGroup: boolean;
  newGroupName: string;
  selectedMembers: Set<string>;
  editingGroupId: string | null;
  editMembers: Set<string>;
  confirmDeleteId: string | null;
  onToggleCreate: () => void;
  onCreateGroup: (e: React.FormEvent) => void;
  onNewGroupName: (value: string) => void;
  onToggleMember: (id: string) => void;
  onInviteGroup: (groupId: string) => void;
  onOpenManage: (group: FriendGroup) => void;
  onCloseEditor: () => void;
  onToggleEditMember: (id: string) => void;
  onSaveMembers: (groupId: string) => void;
  onConfirmDelete: (groupId: string) => void;
  onCancelDelete: () => void;
  onDeleteGroup: (groupId: string) => void;
}) {
  function playableMembers(g: FriendGroup): FriendProfile[] {
    return g.members.filter((m) => m.userId !== userId && friendIds.has(m.userId));
  }

  return (
    <section
      role="tabpanel"
      id="social-panel-groups"
      aria-labelledby="social-tab-groups"
      className="mt-3 min-w-0"
    >
      {groups.length !== 0 ? <div className="flex items-center justify-end gap-2">
        <Button
          variant="ghost"
          disabled={disabled || friends.length === 0}
          title={friends.length === 0 ? 'Add a friend before creating a group' : undefined}
          onClick={onToggleCreate}
          className="py-1.5 px-3 text-xs"
        >
          {showCreateGroup ? 'Cancel' : 'New group'}
        </Button>
      </div> : null}

      {showCreateGroup && (
        <form
          onSubmit={onCreateGroup}
          className="mt-3 space-y-3 rounded-2xl border border-sidebar/15 bg-mushroom/55 p-3.5 sm:p-4"
        >
          <TextField
            variant="hud"
            label="Name"
            value={newGroupName}
            onChange={(e) => onNewGroupName(e.target.value)}
            placeholder="e.g. Friday night"
            maxLength={40}
            required
            autoComplete="off"
            autoFocus
          />
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
                    onToggle={() => onToggleMember(f.userId)}
                  />
                </li>
              ))}
            </ul>
          </div>
          <Button
            type="submit"
            disabled={disabled || busy === 'create-group' || !newGroupName.trim()}
            className="min-h-10 w-full text-xs"
          >
            {busy === 'create-group' ? 'Creating…' : 'Create group'}
          </Button>
        </form>
      )}

      {groups.length === 0 && !showCreateGroup ? (
        <div className="surface-empty-lg mt-3">
          <p className="text-sm font-medium text-ink-strong">No groups yet</p>
          <p className="mt-1 text-xs leading-relaxed text-ink-strong-muted">
            Make a crew of friends, then start a private table for everyone in one tap.
          </p>
          {friends.length > 0 && (
            <Button disabled={disabled} onClick={onToggleCreate} className="mt-4 py-2 px-4 text-xs">
              Create your first group
            </Button>
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
              groupMembersDirty(
                new Set(
                  g.members
                    .filter((m) => m.userId !== g.ownerUserId && friendIds.has(m.userId))
                    .map((m) => m.userId),
                ),
                editMembers,
              );

            if (editing) {
              return (
                <li
                  key={g.id}
                  className="rounded-2xl border border-sidebar/25 bg-mushroom/60 p-3.5 shadow-[0_8px_24px_rgb(29_4_50/0.06)] sm:p-4"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-heading-sub">
                        {g.name}
                      </p>
                      <p className="mt-0.5 text-xs text-ink-strong-muted">
                        Edit who’s in this group
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      onClick={onCloseEditor}
                      className="shrink-0 py-1 px-2.5 text-xs"
                    >
                      Close
                    </Button>
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
                            avatarUrl={m.avatarUrl}
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
                            onToggle={() => onToggleEditMember(f.userId)}
                          />
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="mt-3 flex gap-2">
                    <Button variant="ghost" onClick={onCloseEditor} className="min-h-10 flex-1 text-xs">
                      Cancel
                    </Button>
                    <Button
                      disabled={disabled || busy === `edit-${g.id}` || !dirty}
                      onClick={() => onSaveMembers(g.id)}
                      className="min-h-10 flex-[1.4] text-xs"
                    >
                      {busy === `edit-${g.id}` ? 'Saving…' : 'Save'}
                    </Button>
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
                  <MemberAvatarStack members={g.members} selfUserId={userId} />
                  <div className="min-w-0 flex-1">
                    <p className="font-heading-sub truncate">
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
                          avatarUrl={m.avatarUrl}
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
                      onClick={() => onInviteGroup(g.id)}
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
                          onClick={() => onOpenManage(g)}
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
                            onClick={() => onDeleteGroup(g.id)}
                            className="font-semibold text-danger hover:underline"
                          >
                            Yes, delete
                          </button>
                          <button
                            type="button"
                            onClick={onCancelDelete}
                            className="font-semibold text-ink-strong-muted hover:underline"
                          >
                            Keep
                          </button>
                        </span>
                      ) : (
                        <button
                          type="button"
                          disabled={disabled}
                          onClick={() => onConfirmDelete(g.id)}
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
  );
}
