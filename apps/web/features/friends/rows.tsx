import { PlayerAvatar } from '@/components/PlayerAvatar';
import type { FriendProfile } from '@/lib/api';

export function MemberAvatarStack({
  members,
  selfUserId,
}: {
  members: FriendProfile[];
  selfUserId: string | null | undefined;
}) {
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
              avatarUrl={m.avatarUrl}
              size={28}
              title={m.userId === selfUserId ? 'You' : m.name}
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

export function FriendToggleRow({
  friend,
  selected,
  onToggle,
  disabled,
  showCheck = true,
  showOnline = false,
}: {
  friend: FriendProfile;
  selected: boolean;
  onToggle: () => void;
  disabled?: boolean;
  showCheck?: boolean;
  showOnline?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onToggle}
      className={`flex w-full items-center gap-2.5 rounded-xl border px-2.5 py-2 text-left transition disabled:opacity-45 ${
        selected
          ? 'border-sidebar/40 bg-sidebar/[0.08] text-ink-strong'
          : 'border-transparent bg-mushroom/40 text-ink-strong-muted hover:border-sidebar/15 hover:bg-mushroom/70'
      }`}
    >
      {showCheck ? (
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
      ) : null}
      <span className="relative shrink-0">
        <PlayerAvatar
          userId={friend.userId}
          avatarId={friend.avatarId}
          avatarUrl={friend.avatarUrl}
          size={28}
          title={friend.name}
        />
        {showOnline ? (
          <span
            className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white ${
              friend.online ? 'bg-emerald-500' : 'bg-sidebar/25'
            }`}
            title={friend.online ? 'Online' : 'Offline'}
            aria-hidden
          />
        ) : null}
      </span>
      <span className="min-w-0 flex-1 truncate text-sm font-medium">{friend.name}</span>
      {showOnline && friend.online ? (
        <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wider text-emerald-700/80">
          Online
        </span>
      ) : null}
    </button>
  );
}
