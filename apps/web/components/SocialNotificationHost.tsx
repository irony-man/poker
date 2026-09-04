'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { PlayerAvatar } from '@/components/PlayerAvatar';
import { Button } from '@/components/ui/Button';
import { useSocialNotifications } from '@/hooks/useSocialNotifications';
import {
  declineFriendChallenge,
  joinFriendChallenge,
  listFriends,
  registerContest,
  respondFriendRequest,
  type PendingChallenge,
} from '@/lib/api';
import { useSession } from '@/lib/store';

export function SocialNotificationHost() {
  const router = useRouter();
  const applySocial = useSession((s) => s.applySocial);
  const { sessionToken, newestRequest, newestChallenge, extraCount, isNewRequest, isNewChallenge } =
    useSocialNotifications();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function refreshSocial() {
    if (!sessionToken) return;
    try {
      const data = await listFriends({ sessionToken });
      applySocial({
        friends: data.friends,
        incoming: data.incoming,
        pendingChallenges: data.pendingChallenges,
        groups: data.groups ?? [],
      });
    } catch {
      /* social_sync remains source of truth */
    }
  }

  if (!sessionToken || (!newestRequest && !newestChallenge)) return null;

  async function onRespond(requestId: string, accept: boolean) {
    if (!sessionToken) return;
    setBusy(requestId);
    setError(null);
    try {
      await respondFriendRequest(requestId, accept, { sessionToken });
      await refreshSocial();
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
      await joinFriendChallenge(challenge.id, { sessionToken });
      void refreshSocial();
      const isContest = challenge.kind === 'contest' || Boolean(challenge.contestId);
      if (isContest && challenge.contestId) {
        try {
          await registerContest(challenge.contestId, { sessionToken });
        } catch {
          /* already registered or full */
        }
        router.push(`/contest/${challenge.contestId}`);
      } else if (challenge.tableId) {
        const q = challenge.inviteCode
          ? `?invite=${encodeURIComponent(challenge.inviteCode)}`
          : '';
        router.push(`/table/${challenge.tableId}${q}`);
      } else {
        setError('Invite is no longer valid');
      }
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
      await declineFriendChallenge(challengeId, { sessionToken });
      await refreshSocial();
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
      <div className="pointer-events-auto w-full max-w-[20rem] space-y-2">
        {newestChallenge ? (
          <InviteCard
            title={challengeTitle(newestChallenge)}
            subtitle={challengeSubtitle(newestChallenge)}
            name={newestChallenge.challenger.name}
            avatarId={newestChallenge.challenger.avatarId}
            avatarUrl={newestChallenge.challenger.avatarUrl}
            userId={newestChallenge.challenger.userId}
            primaryLabel="Join"
            isNew={isNewChallenge}
            busy={busy === `join-${newestChallenge.id}` || busy === `decline-${newestChallenge.id}`}
            onPrimary={() => void onJoin(newestChallenge)}
            onSecondary={() => void onDecline(newestChallenge.id)}
          />
        ) : null}
        {newestRequest ? (
          <InviteCard
            title="Friend request"
            subtitle={`${newestRequest.from.name} wants to add you`}
            name={newestRequest.from.name}
            avatarId={newestRequest.from.avatarId}
            avatarUrl={newestRequest.from.avatarUrl}
            userId={newestRequest.from.userId}
            primaryLabel="Accept"
            isNew={isNewRequest}
            busy={busy === newestRequest.id}
            onPrimary={() => void onRespond(newestRequest.id, true)}
            onSecondary={() => void onRespond(newestRequest.id, false)}
          />
        ) : null}
        {extraCount > 0 ? (
          <Link
            href="/friends"
            className="glass-sheet block rounded-xl border border-sidebar/15 px-3 py-2 text-center text-xs font-semibold text-sidebar shadow-[0_8px_24px_rgb(29_4_50/0.16)] backdrop-blur-xl hover:bg-white"
          >
            +{extraCount} more on Friends
          </Link>
        ) : null}
        {error ? (
          <p className="rounded-lg bg-danger/10 px-3 py-1.5 text-xs font-medium text-danger">
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
  return 'Table invite';
}

function challengeSubtitle(c: PendingChallenge): string {
  if (c.kind === 'contest' || c.contestId) {
    return `${c.challenger.name} invited you to a contest`;
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
      className={`overflow-hidden rounded-xl border bg-[rgb(255_252_250_/0.97)] shadow-[0_10px_32px_rgb(29_4_50/0.24),0_1px_0_rgb(255_255_255/0.65)_inset] backdrop-blur-xl ${
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
          <p className="mt-0.5 text-sm font-semibold leading-snug text-ink-strong">{subtitle}</p>
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
