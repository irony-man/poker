import { PlayerAvatar } from '@/components/PlayerAvatar';
import type { PendingChallenge, PendingRequest } from '@/lib/api';
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
            {incoming.map((req) => (
              <li
                key={req.id}
                className="surface-row flex flex-wrap items-center gap-2 bg-mushroom/50"
              >
                <PlayerAvatar
                  userId={req.from.userId}
                  avatarId={req.from.avatarId}
                  avatarUrl={req.from.avatarUrl}
                  size={28}
                  title={req.from.name}
                />
                <span className="font-row-label">
                  {req.from.name}
                </span>
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
            ))}
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
              const actionBusy = busy === `join-${c.id}` || busy === `decline-${c.id}`;
              return (
                <li
                  key={c.id}
                  className="flex items-center gap-2 rounded-xl border border-sidebar/15 bg-gradient-to-b from-mushroom/70 to-mushroom/40 px-3 py-2.5"
                >
                  <PlayerAvatar
                    userId={c.challenger.userId}
                    avatarId={c.challenger.avatarId}
                    avatarUrl={c.challenger.avatarUrl}
                    size={28}
                    title={c.challenger.name}
                  />
                  <span className="min-w-0 flex-1 text-sm leading-snug text-ink-strong">
                    <span className="font-medium">{c.challenger.name}</span>
                    {c.groupName ? (
                      <span className="text-ink-strong-muted"> · {c.groupName}</span>
                    ) : isContest ? (
                      <span className="text-ink-strong-muted"> invited you to a contest</span>
                    ) : isLudo ? (
                      <span className="text-ink-strong-muted"> invited you to Ludo</span>
                    ) : (
                      <span className="text-ink-strong-muted"> wants to play</span>
                    )}
                  </span>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <IconAction
                      label={isContest ? 'Join contest' : isLudo ? 'Join Ludo' : 'Join table'}
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
