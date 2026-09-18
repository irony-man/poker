'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { PlayerAvatar } from '@/components/PlayerAvatar';
import { Button } from '@/components/ui/Button';
import type { PendingChallenge, PendingRequest } from '@/lib/api';
import {
  declineIncomingChallenge,
  joinIncomingChallenge,
  respondIncomingFriendRequest,
} from '@/lib/socialInvites';
import { useSession } from '@/lib/store';

const PREVIEW_LIMIT = 3;

/** Compact pending inbox on Home for signed-in users. */
export function HomePendingStrip() {
  const router = useRouter();
  const sessionToken = useSession((s) => s.sessionToken);
  const social = useSession((s) => s.social);
  const applySocial = useSession((s) => s.applySocial);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!sessionToken || !social) return null;

  const incoming = social.incoming ?? [];
  const challenges = social.pendingChallenges ?? [];
  const outgoing = social.outgoing ?? [];
  const outgoingChallenges = social.outgoingChallenges ?? [];
  const totalIncoming = incoming.length + challenges.length;
  const totalOutgoing = outgoing.length + outgoingChallenges.length;
  if (totalIncoming + totalOutgoing === 0) return null;

  const previewItems: Array<
    | { type: 'request'; item: PendingRequest }
    | { type: 'challenge'; item: PendingChallenge }
  > = [
    ...challenges.map((item) => ({ type: 'challenge' as const, item })),
    ...incoming.map((item) => ({ type: 'request' as const, item })),
  ].slice(0, PREVIEW_LIMIT);

  const remaining = Math.max(0, totalIncoming - previewItems.length);

  async function onRespond(requestId: string, accept: boolean) {
    if (!sessionToken) return;
    setBusy(requestId);
    setError(null);
    try {
      await respondIncomingFriendRequest(requestId, accept, sessionToken, applySocial);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    } finally {
      setBusy(null);
    }
  }

  async function onJoin(challenge: PendingChallenge) {
    if (!sessionToken) return;
    setBusy(`join-${challenge.id}`);
    setError(null);
    try {
      await joinIncomingChallenge(challenge, sessionToken, applySocial, router);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to join');
    } finally {
      setBusy(null);
    }
  }

  async function onDecline(challengeId: string) {
    if (!sessionToken) return;
    setBusy(`decline-${challengeId}`);
    setError(null);
    try {
      await declineIncomingChallenge(challengeId, sessionToken, applySocial);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not decline');
    } finally {
      setBusy(null);
    }
  }

  return (
    <section
      className="mb-10 rounded-2xl border border-sidebar/15 bg-white/70 p-4 shadow-sm sm:mb-14 sm:p-5"
      aria-label="Pending requests"
    >
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="font-display text-sm font-bold uppercase tracking-[0.14em] text-primary">
            Pending
          </h2>
          <p className="mt-0.5 text-xs text-muted">
            {totalIncoming > 0
              ? `${totalIncoming} incoming`
              : 'Nothing incoming'}
            {totalOutgoing > 0 ? ` · ${totalOutgoing} sent` : ''}
          </p>
        </div>
        <Link
          href="/friends?tab=pending"
          className="text-xs font-semibold text-sidebar hover:underline"
        >
          View all
        </Link>
      </div>

      {previewItems.length > 0 ? (
        <ul className="mt-3 space-y-2">
          {previewItems.map((row) => {
            if (row.type === 'request') {
              const req = row.item;
              return (
                <li
                  key={`r-${req.id}`}
                  className="flex flex-wrap items-center gap-2 rounded-xl border border-sidebar/10 bg-page/40 px-3 py-2"
                >
                  <PlayerAvatar
                    userId={req.from.userId}
                    avatarId={req.from.avatarId}
                    avatarUrl={req.from.avatarUrl}
                    size={28}
                    title={req.from.name}
                  />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-primary">
                    {req.from.name}
                    <span className="font-normal text-muted"> · friend request</span>
                  </span>
                  <div className="flex gap-1.5">
                    <Button
                      size="sm"
                      disabled={busy === req.id}
                      onClick={() => void onRespond(req.id, true)}
                      className="min-h-8 px-2.5 py-1 text-[11px]"
                    >
                      Accept
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={busy === req.id}
                      onClick={() => void onRespond(req.id, false)}
                      className="min-h-8 px-2.5 py-1 text-[11px]"
                    >
                      Decline
                    </Button>
                  </div>
                </li>
              );
            }
            const c = row.item;
            const actionBusy = busy === `join-${c.id}` || busy === `decline-${c.id}`;
            return (
              <li
                key={`c-${c.id}`}
                className="flex flex-wrap items-center gap-2 rounded-xl border border-sidebar/10 bg-mushroom/40 px-3 py-2"
              >
                <PlayerAvatar
                  userId={c.challenger.userId}
                  avatarId={c.challenger.avatarId}
                  avatarUrl={c.challenger.avatarUrl}
                  size={28}
                  title={c.challenger.name}
                />
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-primary">
                  {c.challenger.name}
                  <span className="font-normal text-muted">
                    {' '}
                    · {c.groupName ?? challengeShortLabel(c)}
                  </span>
                </span>
                <div className="flex gap-1.5">
                  <Button
                    size="sm"
                    disabled={actionBusy}
                    onClick={() => void onJoin(c)}
                    className="min-h-8 px-2.5 py-1 text-[11px]"
                  >
                    Join
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={actionBusy}
                    onClick={() => void onDecline(c.id)}
                    className="min-h-8 px-2.5 py-1 text-[11px]"
                  >
                    Decline
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-muted">
          You have {totalOutgoing} sent request{totalOutgoing === 1 ? '' : 's'} waiting.
        </p>
      )}

      {remaining > 0 ? (
        <p className="mt-2 text-xs text-muted">
          +{remaining} more on{' '}
          <Link href="/friends?tab=pending" className="font-semibold text-sidebar hover:underline">
            Friends
          </Link>
        </p>
      ) : null}

      {error ? (
        <p className="mt-2 text-xs font-medium text-danger" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}

function challengeShortLabel(c: PendingChallenge): string {
  if (c.kind === 'contest' || c.contestId) return 'contest invite';
  if (c.kind === 'ludo' || c.ludoId) return 'Ludo invite';
  if (c.kind === 'snakes' || c.snakesId) return 'Snakes invite';
  if (c.kind === 'memory' || c.memoryId) return 'Memory invite';
  if (c.kind === 'courtpiece' || c.courtpieceId) return 'Court Piece invite';
  return 'table invite';
}
