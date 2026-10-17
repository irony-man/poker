import { useState } from "react";
import { PlayerAvatar } from "@/components/PlayerAvatar";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { groupMembersDirty } from "@/hooks/useFriendsSocial";
import type { FriendGroup, FriendProfile } from "@/lib/api";
import { InviteTableIcon, PlusIcon, XIcon } from "./icons";
import { FriendToggleRow, MemberAvatarStack } from "./rows";
import {
  FriendSearchField,
  NoFriendMatches,
  matchesFriendQuery,
  normalizeQuery,
} from "./search";

const MAX_MEMBERS = 8;
const MAX_NAME = 40;

function friendCountLabel(n: number): string {
  return `${n} friend${n === 1 ? "" : "s"}`;
}

function CloseButton({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted transition hover:bg-sidebar/[0.06] hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar/40"
    >
      <XIcon className="h-4 w-4" />
    </button>
  );
}

function MemberPicker({
  label,
  hint,
  friends,
  selected,
  disabled,
  onToggle,
}: {
  label: string;
  hint?: string;
  friends: FriendProfile[];
  selected: Set<string>;
  disabled: boolean;
  onToggle: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const atCap = selected.size >= MAX_MEMBERS;
  const q = normalizeQuery(query);
  const visible = q ? friends.filter((f) => matchesFriendQuery(f, q)) : friends;
  return (
    <div role="group" aria-label={label} className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-2">
        <span className="hud-label">{label}</span>
        <span
          className={`text-[11px] font-semibold tabular-nums ${atCap ? "text-danger" : "text-muted"}`}
          aria-live="polite"
        >
          {selected.size} of {MAX_MEMBERS} selected
        </span>
      </div>
      {hint ? <p className="-mt-1 text-xs text-muted">{hint}</p> : null}
      {friends.length > 0 ? (
        <FriendSearchField value={query} onChange={setQuery} />
      ) : null}
      {visible.length === 0 && q ? (
        <NoFriendMatches query={query} onClear={() => setQuery("")} />
      ) : null}
      <ul className="max-h-56 space-y-1.5 overflow-y-auto pr-0.5">
        {visible.map((f) => {
          const isOn = selected.has(f.userId);
          return (
            <li key={f.userId}>
              <FriendToggleRow
                friend={f}
                selected={isOn}
                disabled={disabled || (!isOn && atCap)}
                showOnline
                onToggle={() => onToggle(f.userId)}
              />
            </li>
          );
        })}
      </ul>
    </div>
  );
}

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
  const [groupQuery, setGroupQuery] = useState("");
  const gq = showCreateGroup ? "" : normalizeQuery(groupQuery);
  const visibleGroups = gq
    ? groups.filter(
        (g) =>
          g.id === editingGroupId ||
          normalizeQuery(g.name).includes(gq) ||
          g.members.some(
            (m) => m.userId !== userId && matchesFriendQuery(m, gq),
          ),
      )
    : groups;

  function playableMembers(g: FriendGroup): FriendProfile[] {
    return g.members.filter(
      (m) => m.userId !== userId && friendIds.has(m.userId),
    );
  }

  function memberNames(g: FriendGroup): string {
    const owner = g.members.find((m) => m.userId === g.ownerUserId);
    const rest = g.members.filter((m) => m.userId !== g.ownerUserId);
    return [owner, ...rest]
      .filter((m): m is FriendProfile => Boolean(m))
      .map((m) => {
        if (m.userId === userId) return "You";
        return m.userId === g.ownerUserId ? `${m.name} (host)` : m.name;
      })
      .join(", ");
  }

  const noFriends = friends.length === 0;
  const trimmedName = newGroupName.trim();
  const createBusy = busy === "create-group";

  const createForm = (
    <form
      onSubmit={onCreateGroup}
      className="flex flex-col gap-4 rounded-2xl border border-sidebar/15 bg-page/55 p-4 sm:p-5"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-heading-sub">New group</h3>
          <p className="mt-0.5 text-xs text-muted">
            Save the crew you play with, then seat everyone in one tap.
          </p>
        </div>
        <CloseButton label="Cancel new group" onClick={onToggleCreate} />
      </div>

      <TextField
        variant="hud"
        label="Group name"
        value={newGroupName}
        onChange={(e) => onNewGroupName(e.target.value)}
        placeholder="e.g. Friday night"
        maxLength={MAX_NAME}
        required
        autoComplete="off"
        autoFocus
      />

      <MemberPicker
        label="Friends to include"
        hint="You're always in the group."
        friends={friends}
        selected={selectedMembers}
        disabled={disabled}
        onToggle={onToggleMember}
      />

      <div className="flex flex-col gap-3 border-t border-sidebar/10 pt-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-muted">
          {!trimmedName
            ? "Give your group a name to continue."
            : selectedMembers.size === 0
              ? "Just you for now. You can add friends later."
              : `You + ${friendCountLabel(selectedMembers.size)}`}
        </p>
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggleCreate}
            className="flex-1 sm:flex-none"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            size="sm"
            disabled={disabled || createBusy || !trimmedName}
            className="flex-1 disabled:shadow-none sm:flex-none"
          >
            {createBusy ? "Creating…" : "Create group"}
          </Button>
        </div>
      </div>
    </form>
  );

  return (
    <section
      role="tabpanel"
      id="social-panel-groups"
      aria-labelledby="social-tab-groups"
      className="mt-3 flex min-w-0 flex-col gap-3"
    >
      {groups.length > 0 && !showCreateGroup ? (
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-muted">
            {groups.length} group{groups.length === 1 ? "" : "s"}
          </p>
          <Button
            variant="ghost"
            size="sm"
            disabled={disabled || noFriends}
            title={
              noFriends ? "Add a friend before creating a group" : undefined
            }
            onClick={onToggleCreate}
            className="inline-flex items-center gap-1.5"
          >
            <PlusIcon className="h-3.5 w-3.5" />
            New group
          </Button>
        </div>
      ) : null}

      {showCreateGroup ? createForm : null}

      {groups.length > 0 && !showCreateGroup ? (
        <FriendSearchField
          value={groupQuery}
          onChange={setGroupQuery}
          placeholder="Search groups or members"
        />
      ) : null}

      {groups.length > 0 && visibleGroups.length === 0 ? (
        <NoFriendMatches
          query={groupQuery}
          noun="groups"
          onClear={() => setGroupQuery("")}
        />
      ) : null}

      {groups.length === 0 && !showCreateGroup ? (
        <div className="surface-empty-lg">
          <p className="text-sm font-medium text-primary">No groups yet</p>
          <p className="mx-auto mt-1 max-w-xs text-xs leading-relaxed text-muted">
            Make a crew of friends, then start a private table for everyone in
            one tap.
          </p>
          {noFriends ? (
            <p className="mt-3 text-xs font-medium text-sidebar">
              Add a friend first to create a group.
            </p>
          ) : (
            <Button
              size="sm"
              disabled={disabled}
              onClick={onToggleCreate}
              className="mt-4 inline-flex items-center gap-1.5"
            >
              <PlusIcon className="h-3.5 w-3.5" />
              Create your first group
            </Button>
          )}
        </div>
      ) : null}

      {visibleGroups.length > 0 ? (
        <ul className="space-y-3">
          {visibleGroups.map((g) => {
            const editing = editingGroupId === g.id;
            const playable = playableMembers(g);
            const canManage = g.isOwner && friends.length > 0;
            const inviting = busy === `invite-${g.id}`;
            const saving = busy === `edit-${g.id}`;
            const deleting = busy === `delete-${g.id}`;

            if (editing) {
              const dirty = groupMembersDirty(
                new Set(
                  g.members
                    .filter(
                      (m) =>
                        m.userId !== g.ownerUserId && friendIds.has(m.userId),
                    )
                    .map((m) => m.userId),
                ),
                editMembers,
              );
              const owner = g.members.find((m) => m.userId === g.ownerUserId);
              return (
                <li
                  key={g.id}
                  className="flex flex-col gap-4 rounded-2xl border border-sidebar/30 bg-page/60 p-4 shadow-[0_8px_24px_rgb(29_4_50/0.06)] sm:p-5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="font-heading-sub truncate">{g.name}</h3>
                      <p className="mt-0.5 text-xs text-muted">
                        Choose who sits at this group's table.
                      </p>
                    </div>
                    <CloseButton label="Close editor" onClick={onCloseEditor} />
                  </div>

                  {owner ? (
                    <div className="flex items-center gap-3 rounded-xl border border-dashed border-sidebar/20 px-3 py-2">
                      <PlayerAvatar
                        userId={owner.userId}
                        avatarId={owner.avatarId}
                        avatarUrl={owner.avatarUrl}
                        size={28}
                        title="You"
                      />
                      <span className="min-w-0 flex-1 truncate text-sm font-medium text-primary">
                        You
                      </span>
                      <span className="shrink-0 rounded-full bg-sidebar/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-sidebar">
                        Host · always in
                      </span>
                    </div>
                  ) : null}

                  <MemberPicker
                    label="Friends"
                    friends={friends}
                    selected={editMembers}
                    disabled={disabled}
                    onToggle={onToggleEditMember}
                  />

                  <div className="flex flex-col gap-3 border-t border-sidebar/10 pt-4 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-xs text-muted">
                      {dirty ? "You have unsaved changes." : "No changes yet."}
                    </p>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={onCloseEditor}
                        className="flex-1 sm:flex-none"
                      >
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        disabled={disabled || saving || !dirty}
                        onClick={() => onSaveMembers(g.id)}
                        className="flex-1 disabled:shadow-none sm:flex-none"
                      >
                        {saving ? "Saving…" : "Save changes"}
                      </Button>
                    </div>
                  </div>
                </li>
              );
            }

            return (
              <li
                key={g.id}
                className="rounded-2xl border border-sidebar/12 bg-raised/60 p-4 transition-colors hover:border-sidebar/20"
              >
                <div className="flex items-center gap-3">
                  <MemberAvatarStack members={g.members} selfUserId={userId} />
                  <div className="min-w-0 flex-1">
                    <h3 className="font-heading-sub truncate">{g.name}</h3>
                    <p
                      className="mt-0.5 truncate text-xs text-muted"
                      title={memberNames(g)}
                    >
                      {memberNames(g)}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    disabled={disabled || inviting || playable.length === 0}
                    onClick={() => onInviteGroup(g.id)}
                    aria-label={
                      playable.length === 0
                        ? "Add friends to this group to start a table"
                        : `Start a table with ${g.name} (${friendCountLabel(playable.length)})`
                    }
                    title={
                      playable.length === 0
                        ? "Add friends to this group to start a table"
                        : `Seat ${friendCountLabel(playable.length)} at a private table`
                    }
                    className="inline-flex shrink-0 items-center gap-1.5 disabled:shadow-none"
                  >
                    <InviteTableIcon className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">
                      {inviting ? "Opening…" : "Start table"}
                    </span>
                  </Button>
                </div>

                <div className="mt-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-t border-sidebar/10 pt-3 text-xs">
                  <span className="text-muted">
                    {g.members.length} member{g.members.length === 1 ? "" : "s"}
                    {g.isOwner ? "" : " · shared with you"}
                    {playable.length === 0 ? " · add friends to play" : ""}
                  </span>

                  {g.isOwner ? (
                    confirmDeleteId === g.id ? (
                      <span className="flex items-center gap-2" role="alert">
                        <span className="text-muted">Delete this group?</span>
                        <button
                          type="button"
                          disabled={disabled || deleting}
                          onClick={() => onDeleteGroup(g.id)}
                          className="rounded-md bg-danger/10 px-2 py-1 font-semibold text-danger transition hover:bg-danger/15 disabled:opacity-50"
                        >
                          {deleting ? "Deleting…" : "Delete"}
                        </button>
                        <button
                          type="button"
                          onClick={onCancelDelete}
                          className="rounded-md px-2 py-1 font-semibold text-muted transition hover:bg-sidebar/[0.06] hover:text-primary"
                        >
                          Keep
                        </button>
                      </span>
                    ) : (
                      <span className="flex items-center gap-1">
                        {canManage ? (
                          <button
                            type="button"
                            disabled={disabled}
                            onClick={() => onOpenManage(g)}
                            className="rounded-md px-2 py-1 font-semibold text-sidebar transition hover:bg-sidebar/[0.06] disabled:opacity-50"
                          >
                            Manage members
                          </button>
                        ) : null}
                        <button
                          type="button"
                          disabled={disabled}
                          onClick={() => onConfirmDelete(g.id)}
                          className="rounded-md px-2 py-1 font-medium text-muted transition hover:bg-danger/10 hover:text-danger disabled:opacity-50"
                        >
                          Delete
                        </button>
                      </span>
                    )
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}
    </section>
  );
}
