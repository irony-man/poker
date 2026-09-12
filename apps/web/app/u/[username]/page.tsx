'use client';

import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { MoneyAmount } from '@/components/CurrencyIcon';
import { LoadingScreen } from '@/components/LoadingScreen';
import { LobbyPageShell } from '@/components/LobbyPageShell';
import { PlayerAvatar } from '@/components/PlayerAvatar';
import { PlayingCard } from '@/components/PlayingCard';
import { Button } from '@/components/ui/Button';
import { StatusChip } from '@/components/ui/StatusChip';
import { authHref } from '@/lib/authRedirect';
import {
  challengeFriend,
  fetchHandsTogether,
  fetchPublicProfile,
  respondFriendRequest,
  sendFriendRequest,
  type PublicProfile,
} from '@/lib/api';
import { cn } from '@/lib/cn';
import {
  formatHandWhen,
  parsePlayedHand,
  type PlayedHandLevel,
} from '@/features/progress/playedHand';
import { readStoredSession } from '@/lib/session';
import { useSession } from '@/lib/store';
import { useLobbySession } from '@/lib/useLobbySession';

function HoleThumb({ cards }: { cards: [string, string] | null }) {
  return (
    <div className="flex shrink-0 items-end">
      <div className="-mr-2 origin-bottom -rotate-[6deg] sm:-mr-2.5">
        <PlayingCard code={cards?.[0]} faceDown={!cards} size="xs" dealDelay={0} />
      </div>
      <div className="relative z-[1] origin-bottom rotate-[5deg]">
        <PlayingCard code={cards?.[1]} faceDown={!cards} size="xs" dealDelay={0} />
      </div>
    </div>
  );
}

function SharedPlayerColumn({
  label,
  cards,
  winner,
}: {
  label: string;
  cards: [string, string] | null;
  winner?: boolean;
}) {
  return (
    <div className="flex min-w-[4.5rem] flex-col items-start gap-2 sm:min-w-[5.5rem]">
      <div className="flex max-w-full items-center gap-1.5">
        <span className="truncate text-xs font-semibold text-ink-strong">{label}</span>
        {winner ? (
          <StatusChip tone="positive" className="!px-1.5 !py-0.5 text-[10px]">
            Won
          </StatusChip>
        ) : null}
      </div>
      <HoleThumb cards={cards} />
    </div>
  );
}

function SharedHandRow({ hand }: { hand: PlayedHandLevel }) {
  const when = formatHandWhen(hand.startedAt);
  const winnerLabel = hand.won
    ? 'You won'
    : hand.winnerName
      ? `${hand.winnerName} won`
      : 'Hand complete';
  const others = hand.shownPlayers.filter((p) => !p.isViewer && p.holeCards);
  return (
    <li className="overflow-hidden rounded-2xl border border-sidebar/12 bg-white p-4 shadow-[0_4px_16px_rgb(29_4_50_/_0.04)] sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
        <p className="min-w-0 text-sm font-semibold text-ink-strong">
          <span className={hand.won ? 'text-positive' : 'text-sidebar'}>{winnerLabel}</span>
          {hand.handName && hand.handName !== 'Uncontested' ? (
            <span className="font-medium text-ink-strong-muted"> · {hand.handName}</span>
          ) : null}
        </p>
        <p className="shrink-0 text-xs text-ink-strong-muted">
          {when || 'Unknown time'}
          {hand.source === 'offline' ? ' · Solo' : ''}
        </p>
      </div>

      <div className="mt-4 flex flex-wrap items-end gap-5 sm:gap-7">
        <SharedPlayerColumn label="You" cards={hand.holeCards} winner={hand.won} />
        {others.map((p) => (
          <SharedPlayerColumn
            key={p.userId || p.name}
            label={p.name}
            cards={p.holeCards}
            winner={p.isWinner}
          />
        ))}
      </div>

      {hand.community.length > 0 ? (
        <div className="mt-4 border-t border-sidebar/10 pt-4">
          <p className="mb-2 text-[10px] font-display font-bold uppercase tracking-[0.14em] text-ink-strong-muted">
            Board
          </p>
          <div className="flex flex-wrap gap-1 sm:gap-1.5">
            {hand.community.map((code, i) => (
              <PlayingCard key={`${code}-${i}`} code={code} size="xs" dealDelay={0} />
            ))}
          </div>
        </div>
      ) : null}
    </li>
  );
}

function PublicProfilePageInner() {
  const params = useParams<{ username: string }>();
  const router = useRouter();
  const rawParam = typeof params.username === 'string' ? params.username : '';
  const usernameParam = decodeURIComponent(rawParam);

  const { authReady, signedIn } = useLobbySession();
  const sessionToken = useSession((s) => s.sessionToken);
  const userId = useSession((s) => s.userId);
  const token = sessionToken ?? readStoredSession()?.sessionToken ?? null;
  const viewerId = userId ?? readStoredSession()?.userId ?? null;

  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [sharedHands, setSharedHands] = useState<PlayedHandLevel[]>([]);
  const [sharedLoading, setSharedLoading] = useState(false);
  const [sharedError, setSharedError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!usernameParam) {
      setProfile(null);
      setError('User not found');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await fetchPublicProfile(usernameParam, token);
      setProfile(data);
      if (data.relationship === 'self') {
        router.replace('/profile');
      }
    } catch (err) {
      setProfile(null);
      setError(err instanceof Error ? err.message : 'Could not load profile');
    } finally {
      setLoading(false);
    }
  }, [usernameParam, token, router]);

  useEffect(() => {
    if (!authReady) return;
    void load();
  }, [authReady, load]);

  const loadShared = useCallback(async () => {
    if (!token || !viewerId || !usernameParam || !profile || profile.relationship === 'self') {
      setSharedHands([]);
      setSharedError(null);
      setSharedLoading(false);
      return;
    }
    setSharedLoading(true);
    setSharedError(null);
    try {
      const res = await fetchHandsTogether(usernameParam, token, 50);
      setSharedHands(res.hands.map((row) => parsePlayedHand(row, viewerId)));
    } catch (err) {
      setSharedHands([]);
      setSharedError(err instanceof Error ? err.message : 'Could not load shared hands');
    } finally {
      setSharedLoading(false);
    }
  }, [token, viewerId, usernameParam, profile]);

  useEffect(() => {
    if (!authReady || !signedIn || !profile || profile.relationship === 'self') return;
    void loadShared();
  }, [authReady, signedIn, profile, loadShared]);

  const onAddFriend = async () => {
    if (!token || !profile || busy) return;
    setBusy(true);
    setError(null);
    try {
      await sendFriendRequest(profile.id, { sessionToken: token });
      setProfile((prev) =>
        prev ? { ...prev, relationship: 'outgoing', incomingRequestId: undefined } : prev,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not send request';
      if (/already friends/i.test(msg)) {
        setProfile((prev) =>
          prev ? { ...prev, relationship: 'friends', incomingRequestId: undefined } : prev,
        );
      } else if (/already pending/i.test(msg)) {
        setProfile((prev) =>
          prev ? { ...prev, relationship: 'outgoing', incomingRequestId: undefined } : prev,
        );
      } else {
        setError(msg);
      }
    } finally {
      setBusy(false);
    }
  };

  const onAccept = async () => {
    if (!token || !profile?.incomingRequestId || busy) return;
    setBusy(true);
    setError(null);
    try {
      await respondFriendRequest(profile.incomingRequestId, true, { sessionToken: token });
      setProfile((prev) =>
        prev ? { ...prev, relationship: 'friends', incomingRequestId: undefined } : prev,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not accept request');
    } finally {
      setBusy(false);
    }
  };

  const onChallenge = async () => {
    if (!token || !profile || busy) return;
    setBusy(true);
    setError(null);
    try {
      const result = await challengeFriend(profile.id, { sessionToken: token });
      router.push(`/table/${result.tableId}?invite=${encodeURIComponent(result.inviteCode)}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start challenge');
      setBusy(false);
    }
  };

  const joined = profile
    ? new Date(profile.createdAt).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : null;

  const returnPath = usernameParam ? `/u/${encodeURIComponent(usernameParam)}` : '/';

  const sharedCountLabel = useMemo(() => {
    const n = sharedHands.length;
    if (sharedLoading) return null;
    if (n === 0) return null;
    return `${n} shared ${n === 1 ? 'hand' : 'hands'}`;
  }, [sharedHands.length, sharedLoading]);

  if (!authReady || (loading && !profile && !error)) {
    return <LoadingScreen label="Loading profile…" />;
  }

  if (profile?.relationship === 'self') {
    return <LoadingScreen label="Opening your profile…" />;
  }

  return (
    <LobbyPageShell signedIn={signedIn} requireAuth={false} error={error}>
      {profile ? (
        <div className="flex w-full flex-col gap-5 sm:gap-6">
          <section
            className={cn(
              'surface-card overflow-hidden border-sidebar/12 p-0 shadow-[0_14px_36px_rgb(29_4_50_/_0.08)]',
            )}
          >
            <div className="flex flex-col gap-6 p-5 sm:p-7 md:flex-row md:items-start md:gap-8">
              <div className="flex shrink-0 flex-col items-center md:items-start">
                <div className="rounded-full bg-white p-1 shadow-[0_0_0_1px_rgb(29_4_50_/_0.08)]">
                  <PlayerAvatar
                    avatarId={profile.avatarId}
                    avatarUrl={profile.avatarUrl}
                    userId={profile.id}
                    size={128}
                    title={profile.username}
                    className="ring-1 ring-sidebar/10"
                  />
                </div>
              </div>

              <div className="min-w-0 flex-1">
                <h2 className="truncate font-display text-3xl font-bold tracking-tight text-sidebar sm:text-[2rem]">
                  {profile.username}
                </h2>
                <p className="mt-2.5 flex flex-wrap items-center gap-x-10 gap-y-1">
                  <MoneyAmount
                    amount={profile.chipBalance}
                    showChips
                    className="font-display text-xl font-bold tracking-tight text-sidebar sm:text-2xl"
                  />
                  <MoneyAmount
                    amount={profile.whuffieBalance}
                    showWhuffies
                    className="font-display text-lg font-semibold tracking-tight text-sidebar/80 sm:text-xl"
                  />
                </p>
                <p className="mt-3 font-prose-muted">
                  {joined ? (
                    <>
                      Joined {joined}
                      <span className="mx-1.5 text-sidebar/30" aria-hidden>
                        ·
                      </span>
                    </>
                  ) : null}
                  {profile.friendCount}{' '}
                  {profile.friendCount === 1 ? 'friend' : 'friends'}
                  <span className="mx-1.5 text-sidebar/30" aria-hidden>
                    ·
                  </span>
                  {profile.handsPlayed}{' '}
                  {profile.handsPlayed === 1 ? 'hand' : 'hands'} played
                </p>

                <div className="mt-5 flex flex-wrap items-center gap-2">
                  {!signedIn ? (
                    <>
                      <Button href={authHref('sign-in', returnPath)} className="text-xs">
                        Sign in to add friend
                      </Button>
                      <Button
                        variant="ghost"
                        href={authHref('sign-up', returnPath)}
                        className="text-xs"
                      >
                        Create account
                      </Button>
                    </>
                  ) : profile.relationship === 'friends' ? (
                    <>
                      <StatusChip tone="positive" className="text-xs">
                        Friends
                      </StatusChip>
                      <Button
                        type="button"
                        disabled={busy}
                        onClick={() => void onChallenge()}
                        className="text-xs"
                      >
                        {busy ? 'Starting…' : 'Challenge'}
                      </Button>
                    </>
                  ) : profile.relationship === 'incoming' ? (
                    <Button
                      type="button"
                      disabled={busy}
                      onClick={() => void onAccept()}
                      className="text-xs"
                    >
                      {busy ? 'Accepting…' : 'Accept friend request'}
                    </Button>
                  ) : profile.relationship === 'outgoing' ? (
                    <StatusChip className="text-xs">Request sent</StatusChip>
                  ) : (
                    <Button
                      type="button"
                      disabled={busy}
                      onClick={() => void onAddFriend()}
                      className="text-xs"
                    >
                      {busy ? 'Sending…' : 'Add friend'}
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </section>

          {signedIn ? (
            <section className="surface-card-lg relative z-0 overflow-hidden border-sidebar/12">
              <div className="relative z-10 mb-4 flex items-baseline justify-between gap-3">
                <h3 className="font-heading-section">Hands together</h3>
                {sharedCountLabel ? (
                  <span className="text-xs font-medium text-ink-strong-muted">
                    {sharedCountLabel}
                  </span>
                ) : null}
              </div>
              {sharedLoading ? (
                <p className="text-sm text-ink-strong-muted">Loading shared hands…</p>
              ) : sharedError ? (
                <StatusChip tone="danger" role="alert" className="text-xs">
                  {sharedError}
                </StatusChip>
              ) : sharedHands.length === 0 ? (
                <div className="surface-empty">
                  <p className="text-sm text-ink-strong-muted">No shared hands yet</p>
                </div>
              ) : (
                <ul className="relative z-0 space-y-3">
                  {sharedHands.map((hand) => (
                    <SharedHandRow key={hand.id} hand={hand} />
                  ))}
                </ul>
              )}
            </section>
          ) : null}
        </div>
      ) : !loading ? (
        <div className="surface-empty-lg">
          <p className="text-sm font-medium text-ink-strong">Player not found</p>
          <p className="mt-1 text-xs leading-relaxed text-ink-strong-muted">
            No account matches that username.
          </p>
          <Button href="/" variant="ghost" className="mt-4 text-xs">
            Back to lobby
          </Button>
        </div>
      ) : null}
    </LobbyPageShell>
  );
}

export default function PublicProfilePage() {
  return <PublicProfilePageInner />;
}
