'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { AvatarPicker, PlayerAvatar } from '@/components/PlayerAvatar';
import { FriendsPanel } from '@/components/FriendsPanel';
import { LoadingScreen } from '@/components/LoadingScreen';
import { LobbyPageShell } from '@/components/LobbyPageShell';
import {
  fetchMe,
  listFriends,
  listMyContests,
  updateMe,
  type ContestView,
  type MeProfile,
} from '@/lib/api';
import { saveAvatarId } from '@/lib/avatars';
import { MoneyAmount } from '@/components/CurrencyIcon';
import { enterMobileFullscreen } from '@/lib/mobileFullscreen';
import { readStoredSession, writeStoredSession } from '@/lib/session';
import { useSession } from '@/lib/store';
import { useLobbySession } from '@/lib/useLobbySession';

type ProfileTab = 'overview' | 'contests' | 'friends';

type ContestMatchRow = {
  contest: ContestView;
  place: number | null;
  prizeWuffies: number;
  playedAt: number;
};

function parseProfileTab(raw: string | null): ProfileTab {
  if (raw === 'friends' || raw === 'contests') return raw;
  return 'overview';
}

function modeLabel(mode: ContestView['mode']): string {
  return mode === 'rounds' ? 'Rounds' : 'Wuffies';
}

function placeLabel(place: number | null): string {
  if (place == null) return '—';
  return `#${place}`;
}

function ProfilePageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { authReady, signedIn } = useLobbySession();
  const sessionToken = useSession((s) => s.sessionToken);
  const setChipBalance = useSession((s) => s.setChipBalance);
  const [profile, setProfile] = useState<MeProfile | null>(null);
  const [friendCount, setFriendCount] = useState(0);
  const [contests, setContests] = useState<ContestView[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<ProfileTab>(() => parseProfileTab(searchParams.get('tab')));
  const [editingAvatar, setEditingAvatar] = useState(false);
  const [draftAvatarId, setDraftAvatarId] = useState(0);
  const [savingAvatar, setSavingAvatar] = useState(false);

  const token = sessionToken ?? readStoredSession()?.sessionToken ?? null;

  useEffect(() => {
    setTab(parseProfileTab(searchParams.get('tab')));
  }, [searchParams]);

  const selectTab = useCallback(
    (next: ProfileTab) => {
      setTab(next);
      const params = new URLSearchParams(searchParams.toString());
      if (next === 'overview') params.delete('tab');
      else params.set('tab', next);
      const q = params.toString();
      router.replace(q ? `/profile?${q}` : '/profile', { scroll: false });
    },
    [router, searchParams],
  );

  const load = useCallback(async () => {
    if (!token) {
      setProfile(null);
      setFriendCount(0);
      setContests([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [me, social, mine] = await Promise.all([
        fetchMe(token),
        listFriends({ sessionToken: token }).catch(() => null),
        listMyContests({ sessionToken: token }).catch(() => null),
      ]);
      setProfile(me);
      setDraftAvatarId(me.avatarId);
      setChipBalance(me.chipBalance);
      setFriendCount(social?.friends.length ?? 0);
      setContests(mine?.contests ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load profile');
    } finally {
      setLoading(false);
    }
  }, [token, setChipBalance]);

  useEffect(() => {
    if (!authReady || !signedIn) return;
    void load();
  }, [authReady, signedIn, load]);

  const contestHistory = useMemo((): ContestMatchRow[] => {
    if (!profile) return [];
    return contests
      .filter(
        (c) =>
          c.status === 'completed' && c.entrants.some((e) => e.userId === profile.id),
      )
      .map((contest) => {
        const placement = contest.placements.find((p) => p.userId === profile.id);
        const assignment = contest.assignments.find((a) => a.userId === profile.id);
        return {
          contest,
          place: placement?.place ?? assignment?.place ?? null,
          prizeWuffies: placement?.prizeWuffies ?? 0,
          playedAt: contest.completedAt ?? contest.startedAt ?? contest.createdAt,
        };
      })
      .sort((a, b) => b.playedAt - a.playedAt);
  }, [contests, profile]);

  const openAvatarEditor = () => {
    if (!profile) return;
    setDraftAvatarId(profile.avatarId);
    setEditingAvatar(true);
  };

  const saveAvatar = async () => {
    if (!token || !profile || savingAvatar) return;
    setSavingAvatar(true);
    setError(null);
    try {
      const me = await updateMe(token, { avatarId: draftAvatarId });
      setProfile(me);
      setChipBalance(me.chipBalance);
      saveAvatarId(me.avatarId);
      const stored = readStoredSession();
      if (stored) {
        writeStoredSession({ ...stored, avatarId: me.avatarId });
      }
      setEditingAvatar(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update avatar');
    } finally {
      setSavingAvatar(false);
    }
  };

  if (!authReady) {
    return <LoadingScreen label="Loading…" />;
  }

  const joined =
    profile?.createdAt != null
      ? new Date(profile.createdAt).toLocaleDateString(undefined, {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        })
      : null;

  return (
    <LobbyPageShell
      title="Profile"
      subtitle="Your avatar, display name, and Wuffies bankroll."
      signedIn={signedIn}
      requireAuth
    >
      {loading && !profile ? (
        <p className="text-sm text-ink-strong-muted">Loading profile…</p>
      ) : null}

      {error ? (
        <p role="alert" className="status-chip mb-4 border-danger/30 bg-danger/10 text-danger text-xs">
          {error}
        </p>
      ) : null}

      {profile ? (
        <div className="flex w-full flex-col gap-5 sm:gap-6">
          <section className="overflow-hidden rounded-2xl border border-sidebar/12 bg-white shadow-[0_14px_36px_rgb(29_4_50_/_0.08)]">
            <div className="flex flex-col gap-6 p-5 sm:p-7 md:flex-row md:items-start md:gap-8">
              <div className="flex shrink-0 flex-col items-center gap-2 md:items-start">
                <div className="rounded-full bg-white p-1 shadow-[0_0_0_1px_rgb(29_4_50_/_0.08)]">
                  <PlayerAvatar
                    avatarId={profile.avatarId}
                    userId={profile.id}
                    size={128}
                    title={profile.username}
                    className="ring-1 ring-sidebar/10"
                  />
                </div>
                <button
                  type="button"
                  onClick={openAvatarEditor}
                  className="text-xs font-semibold text-sidebar underline-offset-2 transition hover:underline"
                >
                  Change avatar
                </button>
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                  <div className="min-w-0">
                    <h2 className="truncate font-display text-3xl font-bold tracking-tight text-sidebar sm:text-[2rem]">
                      {profile.username}
                    </h2>
                    <p className="mt-2.5">
                      <MoneyAmount
                        amount={profile.chipBalance}
                        showChips
                        className="font-display text-xl font-bold tracking-tight text-sidebar sm:text-2xl"
                      />
                    </p>
                    <p className="mt-3 text-sm leading-relaxed text-ink-strong-muted">
                      {joined ? (
                        <>
                          Joined {joined}
                          <span className="mx-1.5 text-sidebar/30" aria-hidden>
                            ·
                          </span>
                        </>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => selectTab('friends')}
                        className="font-medium text-sidebar underline-offset-2 hover:underline"
                      >
                        {friendCount} {friendCount === 1 ? 'friend' : 'friends'}
                      </button>
                      <span className="mx-1.5 text-sidebar/30" aria-hidden>
                        ·
                      </span>
                      Online
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={openAvatarEditor}
                    className="inline-flex shrink-0 items-center justify-center rounded-full border border-sidebar bg-sidebar px-4 py-2 text-xs font-display font-bold uppercase tracking-wider text-mushroom transition hover:bg-sidebar/90 sm:mt-0.5"
                  >
                    Edit profile
                  </button>
                </div>

                {editingAvatar ? (
                  <div className="mt-5 rounded-xl border border-sidebar/12 bg-mushroom/40 p-4">
                    <AvatarPicker value={draftAvatarId} onChange={setDraftAvatarId} />
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => void saveAvatar()}
                        disabled={savingAvatar}
                        className="btn-primary text-xs"
                      >
                        {savingAvatar ? 'Saving…' : 'Save avatar'}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingAvatar(false);
                          setDraftAvatarId(profile.avatarId);
                        }}
                        className="btn-ghost text-xs"
                        disabled={savingAvatar}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>

            <div
              className="flex gap-6 border-t border-sidebar/10 px-5 sm:px-7"
              role="tablist"
              aria-label="Profile sections"
            >
              {(
                [
                  { id: 'overview' as const, label: 'Overview' },
                  { id: 'contests' as const, label: 'Contests' },
                  { id: 'friends' as const, label: 'Friends' },
                ] as const
              ).map((item) => {
                const active = tab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    id={`profile-tab-${item.id}`}
                    aria-controls={`profile-panel-${item.id}`}
                    onClick={() => selectTab(item.id)}
                    className={`relative py-3.5 text-sm font-display font-bold tracking-wide transition ${
                      active
                        ? 'text-sidebar'
                        : 'text-ink-strong-muted hover:text-sidebar/80'
                    }`}
                  >
                    {item.label}
                    {active ? (
                      <span
                        className="absolute inset-x-0 bottom-0 h-[3px] rounded-t-sm bg-sidebar"
                        aria-hidden
                      />
                    ) : null}
                  </button>
                );
              })}
            </div>
          </section>

          {tab === 'overview' ? (
            <section
              role="tabpanel"
              id="profile-panel-overview"
              aria-labelledby="profile-tab-overview"
              className="rounded-2xl border border-sidebar/12 bg-white p-5 shadow-[0_10px_28px_rgb(29_4_50_/_0.06)] sm:p-7"
            >
              <h3 className="font-display text-lg font-bold tracking-tight text-sidebar">
                Balance
              </h3>
              <p className="mt-3">
                <MoneyAmount
                  amount={profile.chipBalance}
                  showChips
                  className="font-display text-2xl font-bold text-sidebar"
                />
              </p>
              <p className="mt-2 max-w-xl text-sm leading-relaxed text-ink-strong-muted">
                Same balance for public, private, and contest tables.
              </p>
              <div className="mt-6 flex flex-wrap gap-2.5">
                <Link
                  href="/host"
                  className="inline-flex items-center justify-center rounded-full border border-sidebar/30 bg-transparent px-4 py-2 text-xs font-display font-bold uppercase tracking-wider text-sidebar transition hover:border-sidebar hover:bg-sidebar/5"
                >
                  Host a table
                </Link>
                <button
                  type="button"
                  onClick={() => selectTab('contests')}
                  className="inline-flex items-center justify-center rounded-full border border-sidebar/30 bg-transparent px-4 py-2 text-xs font-display font-bold uppercase tracking-wider text-sidebar transition hover:border-sidebar hover:bg-sidebar/5"
                >
                  Contest history
                </button>
                <button
                  type="button"
                  onClick={() => selectTab('friends')}
                  className="inline-flex items-center justify-center rounded-full border border-sidebar/30 bg-transparent px-4 py-2 text-xs font-display font-bold uppercase tracking-wider text-sidebar transition hover:border-sidebar hover:bg-sidebar/5"
                >
                  Find friends
                </button>
              </div>
            </section>
          ) : tab === 'contests' ? (
            <section
              role="tabpanel"
              id="profile-panel-contests"
              aria-labelledby="profile-tab-contests"
              className="rounded-2xl border border-sidebar/12 bg-white p-5 shadow-[0_10px_28px_rgb(29_4_50_/_0.06)] sm:p-7"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                <div className="min-w-0">
                  <h3 className="font-display text-lg font-bold tracking-tight text-sidebar">
                    Contest matches
                  </h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-ink-strong-muted">
                    Completed contests you played, with place and ranking prizes.
                  </p>
                </div>
              </div>

              {contestHistory.length === 0 ? (
                <p className="mt-5 text-sm text-ink-strong-muted">
                  No completed contests yet.{' '}
                  <Link
                    href="/contests"
                    className="font-medium text-sidebar underline-offset-2 hover:underline"
                  >
                    Join or host one
                  </Link>
                  .
                </p>
              ) : (
                <ul className="mt-5 divide-y divide-sidebar/10 overflow-hidden rounded-xl border border-sidebar/12">
                  {contestHistory.map((row) => {
                    const when = new Date(row.playedAt).toLocaleDateString(undefined, {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    });
                    return (
                      <li key={row.contest.id}>
                        <Link
                          href={`/contest/${row.contest.id}`}
                          onClick={() => enterMobileFullscreen()}
                          className="flex items-center justify-between gap-3 px-3.5 py-3 transition hover:bg-mushroom/50 sm:px-4"
                        >
                          <span className="min-w-0">
                            <span className="block truncate font-medium text-ink-strong">
                              {row.contest.name}
                            </span>
                            <span className="mt-0.5 block text-[11px] text-ink-strong-muted">
                              {when} · {modeLabel(row.contest.mode)} ·{' '}
                              {row.contest.entrants.length} players
                            </span>
                          </span>
                          <span className="flex shrink-0 flex-col items-end gap-0.5">
                            <span className="font-mono text-sm font-semibold text-sidebar">
                              {placeLabel(row.place)}
                            </span>
                            {row.prizeWuffies > 0 ? (
                              <MoneyAmount
                                amount={row.prizeWuffies}
                                prefix="+"
                                className="text-xs font-semibold text-brass-dim"
                              />
                            ) : (
                              <span className="text-[11px] text-ink-strong-muted">No prize</span>
                            )}
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          ) : (
            <section
              role="tabpanel"
              id="profile-panel-friends"
              aria-labelledby="profile-tab-friends"
              className="rounded-2xl border border-sidebar/12 bg-white p-5 shadow-[0_10px_28px_rgb(29_4_50_/_0.06)] sm:p-7"
            >
              <FriendsPanel
                variant="embedded"
                disabled={!signedIn}
                onFriendCountChange={setFriendCount}
                onNavigateTable={(tableId, inviteCode) => {
                  enterMobileFullscreen();
                  router.push(`/table/${tableId}?invite=${inviteCode}`);
                }}
                onNavigateContest={(contestId) => {
                  enterMobileFullscreen();
                  router.push(`/contest/${contestId}`);
                }}
              />
            </section>
          )}
        </div>
      ) : null}
    </LobbyPageShell>
  );
}

export default function ProfilePage() {
  return (
    <Suspense fallback={<LoadingScreen label="Loading…" />}>
      <ProfilePageInner />
    </Suspense>
  );
}
