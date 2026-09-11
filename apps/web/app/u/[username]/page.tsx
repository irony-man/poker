'use client';

import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { MoneyAmount } from '@/components/CurrencyIcon';
import { LoadingScreen } from '@/components/LoadingScreen';
import { LobbyPageShell } from '@/components/LobbyPageShell';
import { PlayerAvatar } from '@/components/PlayerAvatar';
import { Button } from '@/components/ui/Button';
import { StatusChip } from '@/components/ui/StatusChip';
import { authHref } from '@/lib/authRedirect';
import {
  challengeFriend,
  fetchPublicProfile,
  respondFriendRequest,
  sendFriendRequest,
  type PublicProfile,
} from '@/lib/api';
import { cn } from '@/lib/cn';
import { readStoredSession } from '@/lib/session';
import { useSession } from '@/lib/store';
import { useLobbySession } from '@/lib/useLobbySession';

function PublicProfilePageInner() {
  const params = useParams<{ username: string }>();
  const router = useRouter();
  const rawParam = typeof params.username === 'string' ? params.username : '';
  const usernameParam = decodeURIComponent(rawParam);

  const { authReady, signedIn } = useLobbySession();
  const sessionToken = useSession((s) => s.sessionToken);
  const token = sessionToken ?? readStoredSession()?.sessionToken ?? null;

  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

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
