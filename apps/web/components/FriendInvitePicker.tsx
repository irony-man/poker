'use client';

import { useEffect, useMemo, useState } from 'react';
import { LoadingScreen } from '@/components/LoadingScreen';
import { choiceOptionClass } from '@/components/ui/choiceStyles';
import { FriendToggleRow } from '@/features/friends/rows';
import type { FriendGroup } from '@/lib/api';
import { useSession } from '@/lib/store';

/** Multi-select friends list for hosting tables / contests (live via social_sync). */
export function FriendInvitePicker({
  sessionToken,
  selectedIds,
  onChange,
  disabled,
  maxSelect = 8,
  excludeUserIds = [],
  title,
  help,
}: {
  sessionToken: string | null;
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
  maxSelect?: number;
  /** Hide users already at the table / contest. */
  excludeUserIds?: string[];
  title?: string;
  help?: string;
}) {
  const social = useSession((s) => s.social);
  const socialLoaded = useSession((s) => s.socialLoaded);
  const friends = social?.friends ?? [];
  const groups = social?.groups ?? [];
  const loading = Boolean(sessionToken && !socialLoaded);
  const [onlineOnly, setOnlineOnly] = useState(false);

  const selected = useMemo(() => new Set(selectedIds), [selectedIds]);
  const excluded = useMemo(() => new Set(excludeUserIds), [excludeUserIds]);

  const onlineFriends = useMemo(
    () => friends.filter((f) => !excluded.has(f.userId) && f.online),
    [friends, excluded],
  );

  const visibleFriends = useMemo(() => {
    const base = friends.filter((f) => !excluded.has(f.userId));
    const list = onlineOnly ? base.filter((f) => f.online) : base;
    return [...list].sort((a, b) => {
      const oa = a.online ? 1 : 0;
      const ob = b.online ? 1 : 0;
      if (oa !== ob) return ob - oa;
      return a.name.localeCompare(b.name);
    });
  }, [friends, excluded, onlineOnly]);

  // Drop selections that became excluded (joined).
  useEffect(() => {
    if (selectedIds.length === 0 || excluded.size === 0) return;
    const next = selectedIds.filter((id) => !excluded.has(id));
    if (next.length !== selectedIds.length) onChange(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-filter when exclusion/selection set changes
  }, [excluded, selectedIds]);

  function toggle(id: string) {
    if (disabled || excluded.has(id)) return;
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else if (next.size < maxSelect) next.add(id);
    onChange([...next]);
  }

  function selectGroup(group: FriendGroup) {
    if (disabled) return;
    const memberIds = group.members
      .map((m) => m.userId)
      .filter((id) => friends.some((f) => f.userId === id) && !excluded.has(id));
    const next = new Set(selected);
    for (const id of memberIds) {
      if (next.size >= maxSelect) break;
      next.add(id);
    }
    onChange([...next]);
  }

  function selectOnline() {
    if (disabled) return;
    const next = new Set(selected);
    for (const f of onlineFriends) {
      if (next.size >= maxSelect) break;
      next.add(f.userId);
    }
    onChange([...next]);
  }

  if (!sessionToken) {
    return (
      <div className="surface-empty py-3">
        <p className="hud-label">{title}</p>
        <p className="mt-1 text-xs text-ink-strong-muted">Sign in to invite friends.</p>
      </div>
    );
  }

  return (
    <div className="min-w-0">
      {title ? <div className="flex items-baseline justify-between gap-2">
        <span className="hud-label">{title}</span>
      </div> : null}
      <p className="field-help mt-1">
        {help ??
          'Selected friends get a notification to join. Optional — you can also share the code.'}
      </p>

      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        <button
          type="button"
          role="switch"
          aria-checked={onlineOnly}
          disabled={disabled}
          onClick={() => setOnlineOnly((v) => !v)}
          className={choiceOptionClass('pill', onlineOnly)}
        >
          Online only
          {onlineFriends.length > 0 ? (
            <span className="ml-1 tabular-nums opacity-80">· {onlineFriends.length}</span>
          ) : null}
        </button>
        {onlineFriends.length > 0 ? (
          <button
            type="button"
            disabled={disabled || selectedIds.length >= maxSelect}
            onClick={selectOnline}
            className={choiceOptionClass('pill', false)}
          >
            Select online
          </button>
        ) : null}
      </div>

      {groups.length > 0 && !onlineOnly && (
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {groups.map((g) => (
            <button
              key={g.id}
              type="button"
              disabled={disabled}
              onClick={() => selectGroup(g)}
              className={choiceOptionClass('pill', false)}
              title={`Select friends in ${g.name}`}
            >
              {g.name}
            </button>
          ))}
        </div>
      )}

      {loading && friends.length === 0 ? (
        <LoadingScreen compact label="Loading friends…" className="!py-3" />
      ) : visibleFriends.length === 0 ? (
        <p className="surface-empty mt-2.5 text-xs text-ink-strong-muted">
          {friends.length === 0
            ? 'No friends yet. Add people from Friends, then invite them here.'
            : onlineOnly
              ? 'No online friends right now. Turn off “Online only” to invite anyone on your list.'
              : 'Everyone on your list already joined.'}
        </p>
      ) : (
        <ul
          className="mt-2.5 max-h-44 space-y-1 overflow-y-auto pr-0.5"
          aria-label={title ?? 'Friends to invite'}
        >
          {visibleFriends.map((f) => {
            const isOn = selected.has(f.userId);
            const atCap = !isOn && selectedIds.length >= maxSelect;
            return (
              <li key={f.userId}>
                <FriendToggleRow
                  friend={f}
                  selected={isOn}
                  disabled={disabled || atCap}
                  showOnline
                  onToggle={() => toggle(f.userId)}
                />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
