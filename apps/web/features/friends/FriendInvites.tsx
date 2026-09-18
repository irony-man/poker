import Link from 'next/link';
import { PlayerAvatar } from '@/components/PlayerAvatar';
import type {
  OutgoingChallenge,
  OutgoingRequest,
  PendingChallenge,
  PendingRequest,
} from '@/lib/api';
import { challengeInvitePath } from '@/lib/socialInvites';
import { publicProfileHref } from '@/lib/publicProfile';
import { CheckIcon, IconAction, JoinTableIcon, XIcon } from './icons';

function challengeInviteLabel(c: PendingChallenge | OutgoingChallenge): string {
  const isContest = c.kind === 'contest' || Boolean(c.contestId);
  const isLudo = c.kind === 'ludo' || Boolean(c.ludoId);
  const isSnakes = c.kind === 'snakes' || Boolean(c.snakesId);
  const isMemory = c.kind === 'memory' || Boolean(c.memoryId);
  const isCourtpiece = c.kind === 'courtpiece' || Boolean(c.courtpieceId);
  if (isContest) return 'contest';
  if (isLudo) return 'Ludo';
  if (isSnakes) return 'Snakes & Ladders';
  if (isMemory) return 'Memory Match';
  if (isCourtpiece) return 'Court Piece';
  return 'table';
}

function challengeJoinLabel(c: PendingChallenge): string {
  const kind = challengeInviteLabel(c);
  if (kind === 'contest') return 'Join contest';
  if (kind === 'Ludo') return 'Join Ludo';
  if (kind === 'Snakes & Ladders') return 'Join Snakes';
  if (kind === 'Memory Match') return 'Join Memory';
  if (kind === 'Court Piece') return 'Join Court Piece';
  return 'Join table';
}

export function FriendInvites({
  incoming,
  challenges,
  outgoing = [],
  outgoingChallenges = [],
  busy,
  disabled,
  onRespond,
  onJoinChallenge,
  onDeclineChallenge,
  onCancelRequest,
  onCancelChallenge,
}: {
  incoming: PendingRequest[];
  challenges: PendingChallenge[];
  outgoing?: OutgoingRequest[];
  outgoingChallenges?: OutgoingChallenge[];
  busy: string | null;
  disabled: boolean;
  onRespond: (requestId: string, accept: boolean) => void;
  onJoinChallenge: (challenge: PendingChallenge) => void;
  onDeclineChallenge: (challengeId: string) => void;
  onCancelRequest?: (requestId: string) => void;
  onCancelChallenge?: (challengeId: string) => void;
}) {
  const hasOutgoing = outgoing.length > 0 || outgoingChallenges.length > 0;

  return (
    <div className="space-y-5">
      <section>
        <h2 className="hud-label">Friend requests</h2>
        {incoming.length === 0 ? (
          <p className="mt-2 text-sm text-muted">No friend requests</p>
        ) : (
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
        )}
      </section>

      <section>
        <h2 className="hud-label">Invites</h2>
        {challenges.length === 0 ? (
          <p className="mt-2 text-sm text-muted">No invites</p>
        ) : (
          <ul className="mt-2 grid gap-2 sm:grid-cols-2">
            {challenges.map((c) => {
              const actionBusy = busy === `join-${c.id}` || busy === `decline-${c.id}`;
              const handle = c.challenger.username ?? c.challenger.name;
              const kindLabel = challengeInviteLabel(c);
              const inviteLabel =
                kindLabel === 'table' ? 'wants to play' : `invited you to ${kindLabel}`;
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
                      label={challengeJoinLabel(c)}
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
        )}
      </section>

      {(hasOutgoing || onCancelRequest || onCancelChallenge) && (
        <section>
          <h2 className="hud-label">Sent</h2>
          {!hasOutgoing ? (
            <p className="mt-2 text-sm text-muted">Nothing waiting</p>
          ) : (
            <ul className="mt-2 grid gap-2 sm:grid-cols-2">
              {outgoing.map((req) => {
                const handle = req.to.username ?? req.to.name;
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
                        userId={req.to.userId}
                        avatarId={req.to.avatarId}
                        avatarUrl={req.to.avatarUrl}
                        size={28}
                        title={req.to.name}
                      />
                    </Link>
                    <div className="min-w-0 flex-1">
                      <Link
                        href={publicProfileHref(handle)}
                        className="font-row-label truncate hover:underline"
                      >
                        {req.to.name}
                      </Link>
                      <p className="text-xs text-muted">Friend request pending</p>
                    </div>
                    {onCancelRequest ? (
                      <IconAction
                        label="Cancel friend request"
                        disabled={disabled || busy === `cancel-req-${req.id}`}
                        tone="ghost"
                        onClick={() => onCancelRequest(req.id)}
                      >
                        <XIcon className="h-4 w-4" />
                      </IconAction>
                    ) : null}
                  </li>
                );
              })}
              {outgoingChallenges.map((c) => {
                const handle = c.challenged.username ?? c.challenged.name;
                const openPath = challengeInvitePath({
                  ...c,
                  challenger: c.challenged,
                });
                return (
                  <li
                    key={c.id}
                    className="flex items-center gap-2 rounded-xl border border-sidebar/15 bg-page/40 px-3 py-2.5"
                  >
                    <Link
                      href={publicProfileHref(handle)}
                      className="shrink-0 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-sidebar/40"
                      title={`View ${handle}`}
                    >
                      <PlayerAvatar
                        userId={c.challenged.userId}
                        avatarId={c.challenged.avatarId}
                        avatarUrl={c.challenged.avatarUrl}
                        size={28}
                        title={c.challenged.name}
                      />
                    </Link>
                    <div className="min-w-0 flex-1 text-sm leading-snug">
                      <Link
                        href={publicProfileHref(handle)}
                        className="font-medium text-primary hover:underline"
                      >
                        {c.challenged.name}
                      </Link>
                      <p className="text-xs text-muted">
                        Waiting on {challengeInviteLabel(c)}
                        {c.groupName ? ` · ${c.groupName}` : ''}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      {openPath ? (
                        <Link
                          href={openPath}
                          className="rounded-lg border border-sidebar/20 px-2 py-1 text-xs font-semibold text-sidebar hover:bg-sidebar/8"
                        >
                          Open
                        </Link>
                      ) : null}
                      {onCancelChallenge ? (
                        <IconAction
                          label="Cancel invite"
                          disabled={disabled || busy === `cancel-ch-${c.id}`}
                          tone="ghost"
                          onClick={() => onCancelChallenge(c.id)}
                        >
                          <XIcon className="h-4 w-4" />
                        </IconAction>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
