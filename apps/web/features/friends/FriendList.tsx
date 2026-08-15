import { PlayerAvatar } from '@/components/PlayerAvatar';
import type { FriendProfile } from '@/lib/api';
import { ChallengeIcon, IconAction, RemoveFriendIcon } from './icons';

export function FriendList({
  friends,
  busy,
  disabled,
  onRemoveFriend,
  onChallenge,
}: {
  friends: FriendProfile[];
  busy: string | null;
  disabled: boolean;
  onRemoveFriend: (friend: FriendProfile) => void;
  onChallenge: (friendUserId: string) => void;
}) {
  if (friends.length === 0) {
    return (
      <div className="surface-empty-lg">
        <p className="text-sm font-medium text-ink-strong">No friends yet</p>
        <p className="mt-1 text-xs leading-relaxed text-ink-strong-muted">
          Enter someone&apos;s exact username under Find player to send a request, then challenge
          them or add them to a group.
        </p>
      </div>
    );
  }

  return (
    <ul className="space-y-2">
      {friends.map((f) => (
        <li
          key={f.userId}
          className="flex items-center gap-3 rounded-2xl border border-sidebar/12 bg-mushroom/50 px-3 py-2.5"
        >
          <span className="relative shrink-0">
            <PlayerAvatar
              userId={f.userId}
              avatarId={f.avatarId}
              avatarUrl={f.avatarUrl}
              size={36}
              title={f.name}
            />
            <span
              className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white ${
                f.online ? 'bg-positive' : 'bg-sidebar/25'
              }`}
              title={f.online ? 'Online' : 'Offline'}
              aria-hidden
            />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium text-ink-strong">{f.name}</span>
            {f.online ? (
              <span className="mt-0.5 block text-[10px] font-semibold uppercase tracking-wider text-positive">
                Online
              </span>
            ) : null}
          </span>
          <div className="flex shrink-0 items-center gap-1.5">
            <IconAction
              label={busy === `remove-${f.userId}` ? 'Removing…' : `Remove ${f.name}`}
              disabled={
                disabled || busy === `remove-${f.userId}` || busy === `challenge-${f.userId}`
              }
              tone="ghost"
              onClick={() => onRemoveFriend(f)}
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
                disabled || busy === `challenge-${f.userId}` || busy === `remove-${f.userId}`
              }
              tone="primary"
              onClick={() => onChallenge(f.userId)}
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
  );
}
