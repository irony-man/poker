import Link from 'next/link';
import { PlayerAvatar } from '@/components/PlayerAvatar';
import type { PendingChallenge, PendingRequest } from '@/lib/api';
import { publicProfileHref } from '@/lib/publicProfile';
import { CheckIcon, IconAction, JoinTableIcon, XIcon } from './icons';

export function FriendInvites({
  incoming,
  challenges,
  busy,
  disabled,
  onRespond,
  onJoinChallenge,
  onDeclineChallenge,
}: {
  incoming: PendingRequest[];
  challenges: PendingChallenge[];
  busy: string | null;
  disabled: boolean;
  onRespond: (requestId: string, accept: boolean) => void;
  onJoinChallenge: (challenge: PendingChallenge) => void;
  onDeclineChallenge: (challengeId: string) => void;
}) {
  return (
    <>
      {incoming.length > 0 && (
        <section>
          <h2 className="hud-label">Friend requests</h2>
          <ul className="mt-2 grid gap-2 sm:grid-cols-2">
            {incoming.map((req) => {
              const handle = req.from.username ?? req.from.name;
              return (
                <li
                  key={req.id}
                  className="surface-row flex flex-wrap items-center gap-2 bg-page/50"
                >
                  <Link
                    href={publicProfileHref(handle)}
                    className="shrink-0 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-sidebar/40"
                    title={`View ${handle}`}
                  >
                    <PlayerAvatar
                      userId={req.from.userId}
                      avatarId={req.from.avatarId}
                      avatarUrl={req.from.avatarUrl}
                      size={28}
                      title={req.from.name}
                    />
                  </Link>
                  <Link
                    href={publicProfileHref(handle)}
                    className="font-row-label min-w-0 flex-1 truncate hover:underline"
                  >
                    {req.from.name}
                  </Link>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <IconAction
                      label="Accept friend request"
                      disabled={disabled || busy === req.id}
                      tone="primary"
                      onClick={() => onRespond(req.id, true)}
                    >
                      <CheckIcon className="h-4 w-4" />
                    </IconAction>
                    <IconAction
                      label="Decline friend request"
                      disabled={disabled || busy === req.id}
                      tone="ghost"
                      onClick={() => onRespond(req.id, false)}
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

      {challenges.length > 0 && (
        <section>
          <h2 className="hud-label">Invites</h2>
          <ul className="mt-2 grid gap-2 sm:grid-cols-2">
            {challenges.map((c) => {
              const isContest = c.kind === 'contest' || Boolean(c.contestId);
              const isLudo = c.kind === 'ludo' || Boolean(c.ludoId);
              const isSnakes = c.kind === 'snakes' || Boolean(c.snakesId);
              const isMemory = c.kind === 'memory' || Boolean(c.memoryId);
              const actionBusy = busy === `join-${c.id}` || busy === `decline-${c.id}`;
              const handle = c.challenger.username ?? c.challenger.name;
              const inviteLabel = isContest
                ? 'invited you to a contest'
                : isLudo
                  ? 'invited you to Ludo'
                  : isSnakes
                    ? 'invited you to Snakes & Ladders'
                    : isMemory
                      ? 'invited you to Memory Match'
                      : 'wants to play';
              const joinLabel = isContest
                ? 'Join contest'
                : isLudo
                  ? 'Join Ludo'
                  : isSnakes
                    ? 'Join Snakes'
                    : isMemory
                      ? 'Join Memory'
                      : 'Join table';
              return (
                <li
                  key={c.id}
                  className="flex items-center gap-2 rounded-xl border border-sidebar/15 bg-gradient-to-b from-mushroom/70 to-mushroom/40 px-3 py-2.5"
                >
                  <Link
                    href={publicProfileHref(handle)}
                    className="shrink-0 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-sidebar/40"
                    title={`View ${handle}`}
                  >
                    <PlayerAvatar
                      userId={c.challenger.userId}
                      avatarId={c.challenger.avatarId}
                      avatarUrl={c.challenger.avatarUrl}
                      size={28}
                      title={c.challenger.name}
                    />
                  </Link>
                  <span className="min-w-0 flex-1 text-sm leading-snug text-primary">
                    <Link
                      href={publicProfileHref(handle)}
                      className="font-medium hover:underline"
                    >
                      {c.challenger.name}
                    </Link>
                    {c.groupName ? (
                      <span className="text-muted"> · {c.groupName}</span>
                    ) : (
                      <span className="text-muted"> {inviteLabel}</span>
                    )}
                  </span>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <IconAction
                      label={joinLabel}
                      disabled={disabled || actionBusy}
                      tone="primary"
                      onClick={() => onJoinChallenge(c)}
                    >
                      <JoinTableIcon className="h-4 w-4" />
                    </IconAction>
                    <IconAction
                      label="Decline invite"
                      disabled={disabled || actionBusy}
                      tone="ghost"
                      onClick={() => onDeclineChallenge(c.id)}
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
    </>
  );
}
