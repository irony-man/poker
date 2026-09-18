'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { PlayerAvatar } from '@/components/PlayerAvatar';
import { Button } from '@/components/ui/Button';
import { useSocialNotifications } from '@/hooks/useSocialNotifications';
import type { PendingChallenge } from '@/lib/api';
import {
  declineIncomingChallenge,
  joinIncomingChallenge,
  respondIncomingFriendRequest,
} from '@/lib/socialInvites';
import { useSession } from '@/lib/store';

export function SocialNotificationHost() {
  const router = useRouter();
  const applySocial = useSession((s) => s.applySocial);
  const { sessionToken, visibleItems, extraCount, newIds } = useSocialNotifications();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!sessionToken || visibleItems.length === 0) return null;

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
    <div
      className="pointer-events-none fixed inset-x-0 top-0 z-[56] flex justify-end px-3 pt-[max(0.65rem,env(safe-area-inset-top))] sm:px-4 sm:pt-3"
      role="status"
      aria-live="polite"
    >
      <div className="pointer-events-auto flex max-h-[min(70vh,28rem)] w-full max-w-[20rem] flex-col gap-2 overflow-y-auto">
        {visibleItems.map((row) => {
          if (row.kind === 'challenge') {
            const c = row.challenge;
            return (
              <InviteCard
                key={c.id}
                title={challengeTitle(c)}
                subtitle={challengeSubtitle(c)}
                name={c.challenger.name}
                avatarId={c.challenger.avatarId}
                avatarUrl={c.challenger.avatarUrl}
                userId={c.challenger.userId}
                primaryLabel="Join"
                isNew={newIds.has(c.id)}
                busy={busy === `join-${c.id}` || busy === `decline-${c.id}`}
                onPrimary={() => void onJoin(c)}
                onSecondary={() => void onDecline(c.id)}
              />
            );
          }
          const req = row.request;
          return (
            <InviteCard
              key={req.id}
              title="Friend request"
              subtitle={`${req.from.name} wants to add you`}
              name={req.from.name}
              avatarId={req.from.avatarId}
              avatarUrl={req.from.avatarUrl}
              userId={req.from.userId}
              primaryLabel="Accept"
              isNew={newIds.has(req.id)}
              busy={busy === req.id}
              onPrimary={() => void onRespond(req.id, true)}
              onSecondary={() => void onRespond(req.id, false)}
            />
          );
        })}
        {extraCount > 0 ? (
          <Link
            href="/friends?tab=pending"
            className="glass-sheet block shrink-0 rounded-xl border border-sidebar/15 px-3 py-2 text-center text-xs font-semibold text-sidebar shadow-[0_8px_24px_rgb(29_4_50/0.16)] backdrop-blur-xl hover:bg-white"
          >
            +{extraCount} more on Friends
          </Link>
        ) : null}
        {error ? (
          <p className="shrink-0 rounded-lg bg-danger/10 px-3 py-1.5 text-xs font-medium text-danger">
            {error}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function challengeTitle(c: PendingChallenge): string {
  if (c.groupName) return c.groupName;
  if (c.kind === 'contest' || c.contestId) return 'Contest invite';
  if (c.kind === 'ludo' || c.ludoId) return 'Ludo invite';
  if (c.kind === 'snakes' || c.snakesId) return 'Snakes invite';
  if (c.kind === 'memory' || c.memoryId) return 'Memory invite';
  if (c.kind === 'courtpiece' || c.courtpieceId) return 'Court Piece invite';
  return 'Table invite';
}

function challengeSubtitle(c: PendingChallenge): string {
  if (c.kind === 'contest' || c.contestId) {
    return `${c.challenger.name} invited you to a contest`;
  }
  if (c.kind === 'ludo' || c.ludoId) {
    return `${c.challenger.name} invited you to Ludo`;
  }
  if (c.kind === 'snakes' || c.snakesId) {
    return `${c.challenger.name} invited you to Snakes & Ladders`;
  }
  if (c.kind === 'memory' || c.memoryId) {
    return `${c.challenger.name} invited you to Memory Match`;
  }
  if (c.kind === 'courtpiece' || c.courtpieceId) {
    return `${c.challenger.name} invited you to Court Piece`;
  }
  return `${c.challenger.name} wants to play`;
}

function InviteCard({
  title,
  subtitle,
  name,
  avatarId,
  avatarUrl,
  userId,
  primaryLabel,
  isNew,
  busy,
  onPrimary,
  onSecondary,
}: {
  title: string;
  subtitle: string;
  name: string;
  avatarId: number;
  avatarUrl?: string | null;
  userId: string;
  primaryLabel: string;
  isNew?: boolean;
  busy: boolean;
  onPrimary: () => void;
  onSecondary: () => void;
}) {
  return (
    <div
      className={`shrink-0 overflow-hidden rounded-xl border bg-[rgb(255_252_250_/0.97)] shadow-[0_10px_32px_rgb(29_4_50/0.24),0_1px_0_rgb(255_255_255/0.65)_inset] backdrop-blur-xl ${
        isNew ? 'border-brass/55 ring-2 ring-brass/35' : 'border-sidebar/18'
      }`}
    >
      <div className="flex items-start gap-2.5 px-3 py-2.5">
        <PlayerAvatar
          userId={userId}
          avatarId={avatarId}
          avatarUrl={avatarUrl}
          size={36}
          title={name}
        />
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-display font-bold uppercase tracking-[0.14em] text-sidebar/70">
            {title}
          </p>
          <p className="mt-0.5 text-sm font-semibold leading-snug text-primary">{subtitle}</p>
          <div className="mt-2 flex gap-2">
            <Button
              size="sm"
              disabled={busy}
              onClick={onPrimary}
              className="min-h-8 flex-1 px-2.5 py-1.5 text-[11px]"
            >
              {busy ? '…' : primaryLabel}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={onSecondary}
              className="min-h-8 flex-1 px-2.5 py-1.5 text-[11px]"
            >
              Decline
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
