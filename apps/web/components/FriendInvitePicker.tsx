'use client';

import { useEffect, useMemo, useState } from 'react';
import { PlayerAvatar } from '@/components/PlayerAvatar';
import { LoadingScreen } from '@/components/LoadingScreen';
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
  title = 'Invite friends',
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
      <div className="rounded-xl border border-dashed border-sidebar/20 bg-mushroom/35 px-3 py-3">
        <p className="hud-label">{title}</p>
        <p className="mt-1 text-xs text-ink-strong-muted">Sign in to invite friends.</p>
      </div>
    );
  }

  return (
    <div className="min-w-0">
      <div className="flex items-baseline justify-between gap-2">
        <span className="hud-label">{title}</span>
        <span className="text-[11px] tabular-nums text-ink-strong-muted">
          {selectedIds.length}/{maxSelect}
        </span>
      </div>
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
          className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold transition disabled:opacity-50 ${
            onlineOnly
              ? 'border-sidebar/40 bg-sidebar text-mushroom'
              : 'border-sidebar/15 bg-mushroom/50 text-sidebar hover:border-sidebar/30'
          }`}
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
            className="rounded-full border border-sidebar/15 bg-mushroom/50 px-2.5 py-1 text-[11px] font-semibold text-sidebar transition hover:border-sidebar/30 hover:bg-sidebar/8 disabled:opacity-50"
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
              className="rounded-full border border-sidebar/15 bg-mushroom/50 px-2.5 py-1 text-[11px] font-semibold text-sidebar transition hover:border-sidebar/30 hover:bg-sidebar/8 disabled:opacity-50"
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
        <p className="mt-2.5 rounded-xl border border-dashed border-sidebar/20 bg-mushroom/35 px-3 py-2.5 text-xs text-ink-strong-muted">
          {friends.length === 0
            ? 'No friends yet. Add people from Friends, then invite them here.'
            : onlineOnly
              ? 'No online friends right now. Turn off “Online only” to invite anyone on your list.'
              : 'Everyone on your list already joined.'}
        </p>
      ) : (
        <ul className="mt-2.5 max-h-44 space-y-1 overflow-y-auto pr-0.5">
          {visibleFriends.map((f) => {
            const isOn = selected.has(f.userId);
            const atCap = !isOn && selectedIds.length >= maxSelect;
            return (
              <li key={f.userId}>
                <button
                  type="button"
                  disabled={disabled || atCap}
                  onClick={() => toggle(f.userId)}
                  className={`flex w-full items-center gap-2.5 rounded-xl border px-2.5 py-2 text-left transition disabled:opacity-45 ${
                    isOn
                      ? 'border-sidebar/40 bg-sidebar/[0.08] text-ink-strong'
                      : 'border-transparent bg-mushroom/40 text-ink-strong-muted hover:border-sidebar/15 hover:bg-mushroom/70'
                  }`}
                >
                  <span
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border text-[10px] font-bold ${
                      isOn
                        ? 'border-sidebar bg-sidebar text-mushroom'
                        : 'border-sidebar/25 bg-transparent text-transparent'
                    }`}
                    aria-hidden
                  >
                    ✓
                  </span>
                  <span className="relative shrink-0">
                    <PlayerAvatar
                      userId={f.userId}
                      avatarId={f.avatarId}
                      size={28}
                      title={f.name}
                    />
                    <span
                      className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white ${
                        f.online ? 'bg-emerald-500' : 'bg-sidebar/25'
                      }`}
                      title={f.online ? 'Online' : 'Offline'}
                      aria-hidden
                    />
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{f.name}</span>
                  {f.online ? (
                    <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wider text-emerald-700/80">
                      Online
                    </span>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
