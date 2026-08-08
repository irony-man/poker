'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { AvatarPicker, PlayerAvatar } from '@/components/PlayerAvatar';
import { LoadingScreen } from '@/components/LoadingScreen';
import { LobbyPageShell } from '@/components/LobbyPageShell';
import { challengeFriend, fetchMe, listFriends, updateMe, type FriendProfile, type MeProfile } from '@/lib/api';
import { saveAvatarId } from '@/lib/avatars';
import { formatMoneyLabel, MONEY_TOKEN } from '@/lib/currency';
import { readStoredSession, writeStoredSession } from '@/lib/session';
import { useSession } from '@/lib/store';
import { useLobbySession } from '@/lib/useLobbySession';

type ProfileTab = 'overview' | 'friends';

/** Flat sticker-style Wuffies stack for profile chrome. */
function ChipCluster({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 72 40"
      width="56"
      height="32"
      className={`shrink-0 ${className}`}
      aria-hidden
    >
      {/* back chip — teal */}
      <g transform="translate(22 6)">
        <circle cx="14" cy="14" r="13.5" fill="#0F766E" stroke="#1A0B2E" strokeWidth="2" />
        <circle cx="14" cy="14" r="8" fill="none" stroke="#5EEAD4" strokeWidth="1.6" />
        <circle cx="14" cy="14" r="3.5" fill="#CCFBF1" stroke="#1A0B2E" strokeWidth="1.2" />
      </g>
      {/* mid chip — yellow */}
      <g transform="translate(8 4)">
        <circle cx="14" cy="14" r="13.5" fill="#EAB308" stroke="#1A0B2E" strokeWidth="2" />
        <circle cx="14" cy="14" r="8" fill="none" stroke="#FEF08A" strokeWidth="1.6" />
        <circle cx="14" cy="14" r="3.5" fill="#FEF9C3" stroke="#1A0B2E" strokeWidth="1.2" />
      </g>
      {/* front chip — red/white */}
      <g transform="translate(0 2)">
        <circle cx="14" cy="14" r="13.5" fill="#C5283D" stroke="#1A0B2E" strokeWidth="2" />
        <circle cx="14" cy="14" r="9" fill="#FBF7F4" stroke="#1A0B2E" strokeWidth="1.4" />
        <circle cx="14" cy="14" r="4.5" fill="#C5283D" stroke="#1A0B2E" strokeWidth="1.2" />
      </g>
    </svg>
  );
}

function ChallengeIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M6 12h12" />
      <path d="M12 6v12" />
      <circle cx="12" cy="12" r="9" />
    </svg>
  );
}

export default function ProfilePage() {
  const { authReady, signedIn } = useLobbySession();
  const sessionToken = useSession((s) => s.sessionToken);
  const setChipBalance = useSession((s) => s.setChipBalance);
  const [profile, setProfile] = useState<MeProfile | null>(null);
  const [friends, setFriends] = useState<FriendProfile[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<ProfileTab>('overview');
  const [editingAvatar, setEditingAvatar] = useState(false);
  const [draftAvatarId, setDraftAvatarId] = useState(0);
  const [savingAvatar, setSavingAvatar] = useState(false);
  const [challengeBusy, setChallengeBusy] = useState<string | null>(null);

  const token = sessionToken ?? readStoredSession()?.sessionToken ?? null;

  const load = useCallback(async () => {
    if (!token) {
      setProfile(null);
      setFriends([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [me, social] = await Promise.all([
        fetchMe(token),
        listFriends({ sessionToken: token }).catch(() => ({ friends: [] as FriendProfile[] })),
      ]);
      setProfile(me);
      setDraftAvatarId(me.avatarId);
      setChipBalance(me.chipBalance);
      setFriends(social.friends ?? []);
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

  const onChallenge = async (friendUserId: string) => {
    if (!token || challengeBusy) return;
    setChallengeBusy(friendUserId);
    setError(null);
    try {
      await challengeFriend(friendUserId, { sessionToken: token });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Challenge failed');
    } finally {
      setChallengeBusy(null);
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

  const friendCount = friends.length;

  return (
    <LobbyPageShell
      title="Your profile"
      subtitle="Your balance, how you appear at tables, and when you joined."
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
          {/* Profile header card — Chess.com structure, POKR skin */}
          <section className="overflow-hidden rounded-2xl border border-sidebar/12 bg-white shadow-[0_14px_36px_rgb(29_4_50_/_0.08)]">
            <div className="flex flex-col gap-6 p-5 sm:p-7 md:flex-row md:items-start md:gap-8">
              {/* Avatar column */}
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

              {/* Identity + meta */}
              <div className="min-w-0 flex-1">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                  <div className="min-w-0">
                    <h2 className="truncate font-display text-3xl font-bold tracking-tight text-sidebar sm:text-[2rem]">
                      {profile.username}
                    </h2>
                    <div className="mt-2.5 flex flex-wrap items-center gap-2.5">
                      <ChipCluster />
                      <p className="font-display text-xl font-bold tabular-nums tracking-tight text-sidebar sm:text-2xl">
                        {formatMoneyLabel(profile.chipBalance)}
                      </p>
                    </div>
                    <p className="mt-3 text-sm leading-relaxed text-ink-strong-muted">
                      {joined ? (
                        <>
                          Joined {joined}
                          <span className="mx-1.5 text-sidebar/30" aria-hidden>
                            ·
                          </span>
                        </>
                      ) : null}
                      <Link
                        href="/friends"
                        className="font-medium text-sidebar underline-offset-2 hover:underline"
                      >
                        {friendCount} {friendCount === 1 ? 'friend' : 'friends'}
                      </Link>
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

            {/* Tabs */}
            <div
              className="flex gap-6 border-t border-sidebar/10 px-5 sm:px-7"
              role="tablist"
              aria-label="Profile sections"
            >
              {(
                [
                  { id: 'overview' as const, label: 'Overview' },
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
                    onClick={() => setTab(item.id)}
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

          {/* Tab panels */}
          {tab === 'overview' ? (
            <section
              role="tabpanel"
              id="profile-panel-overview"
              aria-labelledby="profile-tab-overview"
              className="rounded-2xl border border-sidebar/12 bg-white p-5 shadow-[0_10px_28px_rgb(29_4_50_/_0.06)] sm:p-7"
            >
              <h3 className="font-display text-lg font-bold tracking-tight text-sidebar">
                {MONEY_TOKEN}
              </h3>
              <p className="mt-3 flex flex-wrap items-center gap-2.5">
                <ChipCluster />
                <span className="font-display text-2xl font-bold tabular-nums text-sidebar">
                  {formatMoneyLabel(profile.chipBalance)}
                </span>
              </p>
              <p className="mt-2 max-w-xl text-sm leading-relaxed text-ink-strong-muted">
                Same {MONEY_TOKEN} balance for public, private, and contest tables.
              </p>
              <div className="mt-6 flex flex-wrap gap-2.5">
                <Link
                  href="/host"
                  className="inline-flex items-center justify-center rounded-full border border-sidebar/30 bg-transparent px-4 py-2 text-xs font-display font-bold uppercase tracking-wider text-sidebar transition hover:border-sidebar hover:bg-sidebar/5"
                >
                  Host a table
                </Link>
                <Link
                  href="/friends"
                  className="inline-flex items-center justify-center rounded-full border border-sidebar/30 bg-transparent px-4 py-2 text-xs font-display font-bold uppercase tracking-wider text-sidebar transition hover:border-sidebar hover:bg-sidebar/5"
                >
                  Find friends
                </Link>
              </div>
            </section>
          ) : (
            <section
              role="tabpanel"
              id="profile-panel-friends"
              aria-labelledby="profile-tab-friends"
              className="rounded-2xl border border-sidebar/12 bg-white p-5 shadow-[0_10px_28px_rgb(29_4_50_/_0.06)] sm:p-7"
            >
              <div className="mb-4 flex items-center justify-between gap-3">
                <h3 className="font-display text-lg font-bold tracking-tight text-sidebar">Friends</h3>
                <Link
                  href="/friends"
                  className="text-xs font-semibold text-sidebar underline-offset-2 hover:underline"
                >
                  Manage
                </Link>
              </div>
              {friends.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-sidebar/20 bg-mushroom/40 px-4 py-8 text-center">
                  <p className="text-sm font-medium text-ink-strong">No friends yet</p>
                  <p className="mt-1 text-xs leading-relaxed text-ink-strong-muted">
                    Find people by username and send a request from the Friends page.
                  </p>
                  <Link
                    href="/friends"
                    className="btn-primary mt-4 inline-flex text-xs"
                  >
                    Find friends
                  </Link>
                </div>
              ) : (
                <ul className="space-y-2">
                  {friends.map((f) => (
                    <li
                      key={f.userId}
                      className="flex items-center gap-3 rounded-2xl border border-sidebar/12 bg-mushroom/45 px-3 py-2.5"
                    >
                      <PlayerAvatar
                        userId={f.userId}
                        avatarId={f.avatarId}
                        size={40}
                        title={f.name}
                      />
                      <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink-strong">
                        {f.name}
                      </span>
                      <button
                        type="button"
                        disabled={challengeBusy === f.userId}
                        onClick={() => void onChallenge(f.userId)}
                        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-sidebar/20 text-sidebar transition hover:border-sidebar hover:bg-sidebar/8 disabled:opacity-50"
                        aria-label={`Challenge ${f.name}`}
                        title={`Challenge ${f.name}`}
                      >
                        {challengeBusy === f.userId ? (
                          <span className="text-[10px] font-display font-bold">…</span>
                        ) : (
                          <ChallengeIcon className="h-4 w-4" />
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}
        </div>
      ) : null}
    </LobbyPageShell>
  );
}
