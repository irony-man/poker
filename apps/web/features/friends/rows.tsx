import { PlayerAvatar } from '@/components/PlayerAvatar';
import type { FriendProfile } from '@/lib/api';
import { CheckIcon } from './icons';

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
      {extra > 0 && <span className="ml-1.5 text-[11px] font-medium text-muted">+{extra}</span>}
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
  const status = showOnline ? (friend.online ? 'online' : 'offline') : null;
  const name = [friend.name, status, selected ? 'selected' : null].filter(Boolean).join(', ');

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onToggle}
      aria-pressed={selected}
      aria-label={name}
      className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2 text-left text-primary outline-none transition focus-visible:ring-2 focus-visible:ring-sidebar/40 disabled:cursor-not-allowed disabled:opacity-45 ${
        selected
          ? 'border-sidebar/45 bg-sidebar/[0.08]'
          : 'border-sidebar/10 bg-raised/60 hover:border-sidebar/25 hover:bg-raised'
      }`}
    >
      {showCheck ? (
        <span
          className={`flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[5px] border-2 transition ${
            selected
              ? 'border-sidebar bg-sidebar text-on-chrome'
              : 'border-sidebar/30 bg-white text-transparent'
          }`}
          aria-hidden
        >
          <CheckIcon className="h-3 w-3 [stroke-width:3]" />
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
              friend.online ? 'bg-positive' : 'bg-sidebar/25'
            }`}
            title={friend.online ? 'Online' : 'Offline'}
            aria-hidden
          />
        ) : null}
      </span>
      <span className="min-w-0 flex-1 truncate text-sm font-medium">{friend.name}</span>
      {showOnline && friend.online ? (
        <span className="shrink-0 text-[11px] font-semibold uppercase tracking-wider text-positive">
          Online
        </span>
      ) : null}
    </button>
  );
}
