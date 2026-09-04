'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AvatarPicker, PlayerAvatar } from '@/components/PlayerAvatar';
import { FriendsPanel } from '@/components/FriendsPanel';
import { LoadingScreen } from '@/components/LoadingScreen';
import { LobbyPageShell } from '@/components/LobbyPageShell';
import { PendingCountBadge, useOnlineFriends } from '@/components/OnlineFriends';
import { contestModeLabel } from '@/lib/contestLabels';
import {
  fetchMe,
  listMyContests,
  logout,
  requestAvatarUploadUrl,
  updateMe,
  type ContestView,
  type MeProfile,
} from '@/lib/api';
import { saveAvatarId } from '@/lib/avatars';
import {
  TABLE_COLOR_PRESETS,
  clampTableColorId,
  saveTableColorId,
  tableColorPreset,
} from '@/lib/tableColors';
import {
  clampTableLayout,
  saveTableLayout,
  type TableLayout,
} from '@/lib/tableLayoutPref';
import { isSfxMuted, setSfxMuted } from '@/lib/audio';
import { clampUiTheme, saveUiTheme, type UiTheme } from '@/lib/uiTheme';
import { MoneyAmount } from '@/components/CurrencyIcon';
import { HandsMap } from '@/features/progress/HandsMap';
import { Button } from '@/components/ui/Button';
import { SelectedCheck } from '@/components/ui/SelectedCheck';
import { StatusChip } from '@/components/ui/StatusChip';
import { Tabs } from '@/components/ui/Tabs';
import { useRadioGroupKeyboard } from '@/lib/useRadioGroupKeyboard';
import { enterMobileFullscreen } from '@/lib/mobileFullscreen';
import { clearStoredSession, readStoredSession, writeStoredSession } from '@/lib/session';
import { useSession } from '@/lib/store';
import { useLobbySession } from '@/lib/useLobbySession';
import { cn } from '@/lib/cn';

type ProfileTab = 'overview' | 'hands' | 'theme' | 'contests' | 'friends';

type ContestMatchRow = {
  contest: ContestView;
  place: number | null;
  prizeWhuffies: number;
  playedAt: number;
};

function ThemeRadioGroup<T extends string | number | boolean>({
  label,
  options,
  selected,
  onSelect,
  disabled,
  className,
  children,
}: {
  label: string;
  options: readonly T[];
  selected: T;
  onSelect: (value: T) => void;
  disabled?: boolean;
  className: string;
  children: (ctx: { tabIndexFor: (value: T) => number }) => ReactNode;
}) {
  const groupRef = useRef<HTMLDivElement>(null);
  const { onKeyDown, tabIndexFor } = useRadioGroupKeyboard({
    options,
    selected,
    onSelect,
    groupRef,
    disabled,
  });
  return (
    <div
      ref={groupRef}
      role="radiogroup"
      aria-label={label}
      onKeyDown={onKeyDown}
      className={className}
    >
      {children({ tabIndexFor })}
    </div>
  );
}

function parseProfileTab(raw: string | null): ProfileTab {
  if (raw === 'friends' || raw === 'contests' || raw === 'theme' || raw === 'hands') return raw;
  return 'overview';
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
  const setWhuffieBalance = useSession((s) => s.setWhuffieBalance);
  const clearSession = useSession((s) => s.clearSession);
  const { pendingCount } = useOnlineFriends();
  const [profile, setProfile] = useState<MeProfile | null>(null);
  const [friendCount, setFriendCount] = useState(0);
  const [contests, setContests] = useState<ContestView[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<ProfileTab>(() => parseProfileTab(searchParams.get('tab')));
  const [editingAvatar, setEditingAvatar] = useState(false);
  const [draftAvatarId, setDraftAvatarId] = useState(0);
  const [savingAvatar, setSavingAvatar] = useState(false);
  const [draftTableColorId, setDraftTableColorId] = useState(0);
  const [savingTableColor, setSavingTableColor] = useState(false);
  const [draftUiTheme, setDraftUiTheme] = useState<UiTheme>('v1');
  const [savingUiTheme, setSavingUiTheme] = useState(false);
  const [draftTableLayout, setDraftTableLayout] = useState<TableLayout>('v1');
  const [savingTableLayout, setSavingTableLayout] = useState(false);
  const [draftSfxMuted, setDraftSfxMuted] = useState(isSfxMuted);
  const [savingSfxMuted, setSavingSfxMuted] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

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
      const [me, mine] = await Promise.all([
        fetchMe(token),
        listMyContests({ sessionToken: token }).catch(() => null),
      ]);
      setProfile(me);
      setDraftAvatarId(me.avatarId);
      setDraftTableColorId(clampTableColorId(me.tableColorId));
      saveTableColorId(me.tableColorId);
      setDraftUiTheme(clampUiTheme(me.uiTheme));
      saveUiTheme(me.uiTheme);
      setDraftTableLayout(clampTableLayout(me.tableLayout));
      saveTableLayout(me.tableLayout);
      setDraftSfxMuted(me.sfxMuted);
      setSfxMuted(me.sfxMuted);
      setChipBalance(me.chipBalance);
      setWhuffieBalance(me.whuffieBalance);
      setFriendCount(me.friendCount ?? 0);
      setContests(mine?.contests ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load profile');
    } finally {
      setLoading(false);
    }
  }, [token, setChipBalance, setWhuffieBalance]);

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
          prizeWhuffies: placement?.prizeWhuffies ?? 0,
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
      const me = await updateMe(token, { avatarId: draftAvatarId, avatarUrl: null });
      setProfile(me);
      setChipBalance(me.chipBalance);
      setWhuffieBalance(me.whuffieBalance);
      setFriendCount(me.friendCount ?? 0);
      saveAvatarId(me.avatarId);
      saveTableColorId(me.tableColorId);
      saveUiTheme(me.uiTheme);
      saveTableLayout(me.tableLayout);
      setSfxMuted(me.sfxMuted);
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

  const uploadAvatar = async (file: File) => {
    if (!token || !profile || savingAvatar) return;
    if (file.size > 2 * 1024 * 1024) {
      setError('Image must be 2 MB or smaller');
      return;
    }
    const contentType = file.type as 'image/jpeg' | 'image/png' | 'image/webp';
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(contentType)) {
      setError('Use JPEG, PNG, or WebP');
      return;
    }
    setSavingAvatar(true);
    setError(null);
    try {
      const { uploadUrl, publicUrl } = await requestAvatarUploadUrl(token, {
        contentType,
        contentLength: file.size,
      });
      const putRes = await fetch(uploadUrl, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': contentType },
      });
      if (!putRes.ok) throw new Error('Upload failed');
      const me = await updateMe(token, { avatarUrl: publicUrl });
      setProfile(me);
      setChipBalance(me.chipBalance);
      setWhuffieBalance(me.whuffieBalance);
      setFriendCount(me.friendCount ?? 0);
      saveTableColorId(me.tableColorId);
      saveUiTheme(me.uiTheme);
      saveTableLayout(me.tableLayout);
      setSfxMuted(me.sfxMuted);
      setEditingAvatar(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not upload avatar');
    } finally {
      setSavingAvatar(false);
    }
  };

  const saveTableColor = async (nextId: number) => {
    if (!token || !profile || savingTableColor) return;
    const clamped = clampTableColorId(nextId);
    if (clamped === clampTableColorId(profile.tableColorId)) {
      setDraftTableColorId(clamped);
      return;
    }
    const previous = draftTableColorId;
    setDraftTableColorId(clamped);
    setSavingTableColor(true);
    setError(null);
    try {
      const me = await updateMe(token, { tableColorId: clamped });
      setProfile(me);
      setChipBalance(me.chipBalance);
      setWhuffieBalance(me.whuffieBalance);
      setFriendCount(me.friendCount ?? 0);
      saveTableColorId(me.tableColorId);
      setDraftTableColorId(clampTableColorId(me.tableColorId));
    } catch (err) {
      setDraftTableColorId(previous);
      setError(err instanceof Error ? err.message : 'Could not update table color');
    } finally {
      setSavingTableColor(false);
    }
  };

  const saveLook = async (next: UiTheme) => {
    if (!token || !profile || savingUiTheme) return;
    const clamped = clampUiTheme(next);
    if (clamped === clampUiTheme(profile.uiTheme)) {
      setDraftUiTheme(clamped);
      saveUiTheme(clamped);
      return;
    }
    const previous = draftUiTheme;
    setDraftUiTheme(clamped);
    saveUiTheme(clamped);
    setSavingUiTheme(true);
    setError(null);
    try {
      const me = await updateMe(token, { uiTheme: clamped });
      setProfile(me);
      setChipBalance(me.chipBalance);
      setWhuffieBalance(me.whuffieBalance);
      setFriendCount(me.friendCount ?? 0);
      saveUiTheme(me.uiTheme);
      setDraftUiTheme(clampUiTheme(me.uiTheme));
    } catch (err) {
      setDraftUiTheme(previous);
      saveUiTheme(previous);
      setError(err instanceof Error ? err.message : 'Could not update look');
    } finally {
      setSavingUiTheme(false);
    }
  };

  const saveLayout = async (next: TableLayout) => {
    if (!token || !profile || savingTableLayout) return;
    const clamped = clampTableLayout(next);
    if (clamped === clampTableLayout(profile.tableLayout)) {
      setDraftTableLayout(clamped);
      saveTableLayout(clamped);
      return;
    }
    const previous = draftTableLayout;
    setDraftTableLayout(clamped);
    saveTableLayout(clamped);
    setSavingTableLayout(true);
    setError(null);
    try {
      const me = await updateMe(token, { tableLayout: clamped });
      setProfile(me);
      setChipBalance(me.chipBalance);
      setWhuffieBalance(me.whuffieBalance);
      setFriendCount(me.friendCount ?? 0);
      saveTableLayout(me.tableLayout);
      setDraftTableLayout(clampTableLayout(me.tableLayout));
    } catch (err) {
      setDraftTableLayout(previous);
      saveTableLayout(previous);
      setError(err instanceof Error ? err.message : 'Could not update table layout');
    } finally {
      setSavingTableLayout(false);
    }
  };

  const saveSounds = async (nextMuted: boolean) => {
    if (!token || !profile || savingSfxMuted) return;
    if (nextMuted === profile.sfxMuted) {
      setDraftSfxMuted(nextMuted);
      setSfxMuted(nextMuted);
      return;
    }
    const previous = draftSfxMuted;
    setDraftSfxMuted(nextMuted);
    setSfxMuted(nextMuted);
    setSavingSfxMuted(true);
    setError(null);
    try {
      const me = await updateMe(token, { sfxMuted: nextMuted });
      setProfile(me);
      setChipBalance(me.chipBalance);
      setWhuffieBalance(me.whuffieBalance);
      setFriendCount(me.friendCount ?? 0);
      setSfxMuted(me.sfxMuted);
      setDraftSfxMuted(me.sfxMuted);
    } catch (err) {
      setDraftSfxMuted(previous);
      setSfxMuted(previous);
      setError(err instanceof Error ? err.message : 'Could not update sounds');
    } finally {
      setSavingSfxMuted(false);
    }
  };

  const handleSignOut = async () => {
    if (signingOut) return;
    setSigningOut(true);
    try {
      if (token) {
        try {
          await logout(token);
        } catch {
          /* ignore */
        }
      }
      clearStoredSession();
      clearSession();
      router.push('/');
    } finally {
      setSigningOut(false);
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
      signedIn={signedIn}
      requireAuth
    >
      {loading && !profile ? (
        <p className="text-sm text-ink-strong-muted">Loading profile…</p>
      ) : null}

      {error ? (
        <StatusChip tone="danger" role="alert" className="mb-4 text-xs">
          {error}
        </StatusChip>
      ) : null}

      {profile ? (
        <div className="flex w-full flex-col gap-5 sm:gap-6">
          <section className={cn('surface-card overflow-hidden border-sidebar/12 p-0 shadow-[0_14px_36px_rgb(29_4_50_/_0.08)]')}>
            <div className="flex flex-col gap-6 p-5 sm:p-7 md:flex-row md:items-start md:gap-8">
              <div className="flex shrink-0 flex-col items-center md:items-start">
                <button
                  type="button"
                  onClick={openAvatarEditor}
                  className="group relative rounded-full bg-white p-1 shadow-[0_0_0_1px_rgb(29_4_50_/_0.08)] outline-none transition focus-visible:ring-2 focus-visible:ring-sidebar/40 focus-visible:ring-offset-2"
                  aria-label="Edit avatar"
                >
                  <PlayerAvatar
                    avatarId={profile.avatarId}
                    avatarUrl={profile.avatarUrl}
                    userId={profile.id}
                    size={128}
                    title={profile.username}
                    className="ring-1 ring-sidebar/10"
                  />
                  <span
                    className="pointer-events-none absolute inset-1 flex items-center justify-center rounded-full bg-sidebar/70 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
                    aria-hidden
                  >
                    <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-mushroom">
                      <svg
                        className="h-4 w-4 shrink-0"
                        viewBox="0 0 16 16"
                        fill="none"
                        aria-hidden
                      >
                        <path
                          d="M11.5 2.5a1.4 1.4 0 0 1 2 2L5.75 12.25 2.5 13l.75-3.25L11.5 2.5Z"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                      Edit
                    </span>
                  </span>
                </button>
              </div>

              <div className="min-w-0 flex-1">
                <div className="min-w-0">
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
                    <button
                      type="button"
                      onClick={() => selectTab('friends')}
                      className="link-sidebar"
                    >
                      {friendCount} {friendCount === 1 ? 'friend' : 'friends'}
                    </button>
                  </p>
                </div>

                {editingAvatar ? (
                  <div className="mt-5 rounded-xl border border-sidebar/12 bg-mushroom/40 p-4">
                    <AvatarPicker
                      value={draftAvatarId}
                      onChange={setDraftAvatarId}
                      onUpload={(file) => void uploadAvatar(file)}
                      uploading={savingAvatar}
                    />
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Button
                        type="button"
                        onClick={() => void saveAvatar()}
                        disabled={savingAvatar}
                        className="text-xs"
                      >
                        {savingAvatar ? 'Saving…' : 'Save avatar'}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => {
                          setEditingAvatar(false);
                          setDraftAvatarId(profile.avatarId);
                        }}
                        className="text-xs"
                        disabled={savingAvatar}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>

            <Tabs
              label="Profile sections"
              variant="underline"
              idPrefix="profile-tab"
              selected={tab}
              onSelect={selectTab}
              className="px-5 sm:px-7"
              options={[
                { id: 'overview', label: 'Overview', panelId: 'profile-panel-overview' },
                { id: 'hands', label: 'Hands', panelId: 'profile-panel-hands' },
                { id: 'theme', label: 'Theme', panelId: 'profile-panel-theme' },
                { id: 'contests', label: 'Contests', panelId: 'profile-panel-contests' },
                {
                  id: 'friends',
                  label: 'Friends',
                  panelId: 'profile-panel-friends',
                  badge:
                    pendingCount > 0 ? (
                      <PendingCountBadge count={pendingCount} tone="light" />
                    ) : null,
                },
              ]}
            />
          </section>

          {tab === 'overview' ? (
            <section
              role="tabpanel"
              id="profile-panel-overview"
              aria-labelledby="profile-tab-overview"
              className="surface-card-lg"
            >
              <h3 className="font-heading-section">
                Quick links
              </h3>
              <p className="mt-2 max-w-xl font-prose-muted">
                Same bankroll for public, private, and contest tables — shown above.
              </p>
              <div className="mt-6 flex flex-wrap gap-2.5">
                <Link href="/host" className="btn-pill">
                  Host a table
                </Link>
                <button type="button" onClick={() => selectTab('hands')} className="btn-pill">
                  Hands map
                </button>
                <button type="button" onClick={() => selectTab('contests')} className="btn-pill">
                  Contest history
                </button>
                <button type="button" onClick={() => selectTab('friends')} className="btn-pill">
                  Find friends
                </button>
                <button
                  type="button"
                  onClick={() => void handleSignOut()}
                  disabled={signingOut}
                  className={cn('btn-pill bg-danger')}
                >
                  {signingOut ? 'Signing out…' : 'Sign out'}
                </button>
              </div>
            </section>
          ) : tab === 'hands' ? (
            <section
              role="tabpanel"
              id="profile-panel-hands"
              aria-labelledby="profile-tab-hands"
              className={cn('surface-card-lg overflow-hidden bg-transparent p-0')}
            >
              {token ? (
                <HandsMap
                  handsPlayed={profile.handsPlayed ?? 0}
                  onSettings={() => selectTab('theme')}
                  sessionToken={token}
                  userId={profile.id}
                  tableColorId={profile.tableColorId}
                />
              ) : null}
            </section>
          ) : tab === 'theme' ? (
            <section
              role="tabpanel"
              id="profile-panel-theme"
              aria-labelledby="profile-tab-theme"
              className="surface-card-lg"
            >
              <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
                <div className="min-w-0">
                  <h3 className="font-heading-section">App look</h3>
                  <p className="mt-1.5 max-w-lg font-prose-muted">
                    Classic, Arcade, or Glass. Only you see this. Gameplay stays the same.
                  </p>
                </div>
                {savingUiTheme ? (
                  <p className="text-xs font-medium text-ink-strong-muted" role="status">
                    Saving…
                  </p>
                ) : null}
              </div>

              <ThemeRadioGroup
                label="App look"
                className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3"
                options={['v1', 'v2', 'v3'] as const}
                selected={draftUiTheme}
                onSelect={(id) => void saveLook(id)}
                disabled={savingUiTheme}
              >
                {({ tabIndexFor }) =>
                (
                  [
                    {
                      id: 'v1' as const,
                      label: 'Classic',
                      hint: 'Purple / mushroom',
                      swatchClass: 'bg-[#E6D9D7]',
                      accentClass: 'bg-[#1D0432]',
                    },
                    {
                      id: 'v2' as const,
                      label: 'Arcade',
                      hint: 'Go Old School',
                      swatchClass: 'bg-[#FDE93D]',
                      accentClass: 'bg-[#5B21B6]',
                    },
                    {
                      id: 'v3' as const,
                      label: 'Glass',
                      hint: 'Dusk aurora',
                      swatchClass: 'bg-[#2A1848]',
                      accentClass: 'bg-white/70',
                    },
                  ] as const
                ).map((look) => {
                  const selected = draftUiTheme === look.id;
                  return (
                    <button
                      key={look.id}
                      type="button"
                      role="radio"
                      data-radio-value={look.id}
                      tabIndex={tabIndexFor(look.id)}
                      aria-checked={selected}
                      aria-label={`${look.label}, ${look.hint}`}
                      disabled={savingUiTheme}
                      onClick={() => void saveLook(look.id)}
                      className={`flex flex-col overflow-hidden rounded-2xl border-2 text-left transition disabled:opacity-60 ${
                        selected
                          ? 'border-sidebar bg-sidebar/[0.06] shadow-[0_0_0_1px_rgb(29_4_50_/_0.1)]'
                          : 'border-sidebar/10 bg-mushroom/30 hover:border-sidebar/22'
                      }`}
                    >
                      <span
                        className={`relative block h-16 w-full ${look.swatchClass} ${look.id === 'v2' ? 'border-b-2 border-black' : ''}`}
                        aria-hidden
                      >
                        {look.id === 'v2' ? (
                          <span
                            className="absolute inset-0 opacity-40"
                            style={{
                              backgroundImage:
                                'linear-gradient(to right, rgb(0 0 0 / 0.12) 1px, transparent 1px), linear-gradient(to bottom, rgb(0 0 0 / 0.12) 1px, transparent 1px)',
                              backgroundSize: '10px 10px',
                            }}
                          />
                        ) : null}
                        {look.id === 'v3' ? (
                          <span
                            className="absolute inset-0"
                            style={{
                              backgroundImage:
                                'radial-gradient(ellipse at 16% -8%, rgb(168 100 255 / 0.55), transparent 52%), radial-gradient(ellipse at 92% 10%, rgb(80 200 220 / 0.32), transparent 46%), radial-gradient(ellipse at 50% 120%, rgb(200 80 180 / 0.28), transparent 52%)',
                            }}
                          />
                        ) : null}
                        <span
                          className={`absolute bottom-2 left-2 h-7 w-12 rounded-md ${look.accentClass} ${
                            look.id === 'v2' ? 'border-2 border-black shadow-[2px_2px_0_0_#000]' : ''
                          } ${look.id === 'v3' ? 'border border-white/50 shadow-[0_0_14px_rgb(80_200_220_/_0.45),0_1px_0_rgb(210_236_255_/_0.7)_inset] backdrop-blur-[2px]' : ''}`}
                        />
                      </span>
                      <span className="flex items-center justify-between gap-2 px-3 py-2.5">
                        <span>
                          <span className="block text-sm font-semibold text-sidebar">
                            {look.label}
                          </span>
                          <span className="block text-xs text-ink-strong-muted">
                            {look.hint}
                          </span>
                        </span>
                        {selected ? <SelectedCheck /> : null}
                      </span>
                    </button>
                  );
                })
                }
              </ThemeRadioGroup>

              <div className="mt-8 flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
                <div className="min-w-0">
                  <h3 className="font-heading-section">Table layout</h3>
                  <p className="mt-1.5 max-w-lg font-prose-muted">
                    Classic oval or stacked HUD on portrait phones. Larger screens stay oval. Only
                    you see this.
                  </p>
                </div>
                {savingTableLayout ? (
                  <p className="text-xs font-medium text-ink-strong-muted" role="status">
                    Saving…
                  </p>
                ) : null}
              </div>

              <ThemeRadioGroup
                label="Table layout"
                className="mt-5 grid grid-cols-2 gap-3"
                options={['v1', 'v2'] as const}
                selected={draftTableLayout}
                onSelect={(id) => void saveLayout(id)}
                disabled={savingTableLayout}
              >
                {({ tabIndexFor }) =>
                (
                  [
                    {
                      id: 'v1' as const,
                      label: 'Classic',
                      hint: 'Oval table',
                    },
                    {
                      id: 'v2' as const,
                      label: 'Table v2',
                      hint: 'Stacked HUD',
                    },
                  ] as const
                ).map((layout) => {
                  const selected = draftTableLayout === layout.id;
                  return (
                    <button
                      key={layout.id}
                      type="button"
                      role="radio"
                      data-radio-value={layout.id}
                      tabIndex={tabIndexFor(layout.id)}
                      aria-checked={selected}
                      aria-label={`${layout.label}, ${layout.hint}`}
                      disabled={savingTableLayout}
                      onClick={() => void saveLayout(layout.id)}
                      className={`flex flex-col overflow-hidden rounded-2xl border-2 text-left transition disabled:opacity-60 ${
                        selected
                          ? 'border-sidebar bg-sidebar/[0.06] shadow-[0_0_0_1px_rgb(29_4_50_/_0.1)]'
                          : 'border-sidebar/10 bg-mushroom/30 hover:border-sidebar/22'
                      }`}
                    >
                      <span
                        className="table-theme relative block h-16 w-full"
                        data-table-color={draftTableColorId}
                        aria-hidden
                      >
                        <span className="felt-surface absolute inset-0" />
                        {layout.id === 'v1' ? (
                          <span className="felt-surface table-rim absolute inset-x-6 inset-y-3 rounded-[42%] border-[5px]" />
                        ) : (
                          <span className="absolute inset-x-3 inset-y-2 flex flex-col items-center justify-between py-1">
                            <span className="flex w-full justify-center gap-1">
                              <span className="h-3 w-3 rounded-full bg-white/80" />
                              <span className="h-3 w-3 rounded-full bg-white/80" />
                              <span className="h-3 w-3 rounded-full bg-white/80" />
                            </span>
                            <span className="h-2 w-16 rounded-sm bg-white/70" />
                            <span className="h-3 w-10 rounded-sm bg-white/85" />
                          </span>
                        )}
                      </span>
                      <span className="flex items-center justify-between gap-2 px-3 py-2.5">
                        <span>
                          <span className="block text-sm font-semibold text-sidebar">
                            {layout.label}
                          </span>
                          <span className="block text-xs text-ink-strong-muted">
                            {layout.hint}
                          </span>
                        </span>
                        {selected ? <SelectedCheck /> : null}
                      </span>
                    </button>
                  );
                })
                }
              </ThemeRadioGroup>

              <div className="mt-8 flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
                <div className="min-w-0">
                  <h3 className="font-heading-section">Felt color</h3>
                  <p className="mt-1.5 max-w-lg font-prose-muted">
                    Only you see this. Status colors stay the same.
                  </p>
                </div>
                {savingTableColor ? (
                  <p className="text-xs font-medium text-ink-strong-muted" role="status">
                    Saving…
                  </p>
                ) : null}
              </div>

              <div
                className="table-theme relative mt-5 overflow-hidden rounded-2xl border border-sidebar/10 bg-mushroom/50 px-5 py-6 sm:px-8 sm:py-8"
                data-table-color={draftTableColorId}
              >
                <div
                  className="pointer-events-none absolute inset-0 opacity-60"
                  style={{
                    background:
                      'radial-gradient(ellipse 70% 55% at 50% 45%, rgb(var(--felt-mid) / 0.14), transparent 70%)',
                  }}
                  aria-hidden
                />
                <div className="relative flex flex-col items-center gap-4">
                  {draftTableLayout === 'v2' ? (
                    <div
                      className="felt-surface relative flex h-[7.5rem] w-full max-w-md flex-col items-center justify-between px-4 py-3 sm:h-36"
                      aria-hidden
                    >
                      <div className="flex w-full justify-center gap-2">
                        <span className="h-6 w-6 rounded-full bg-white/85" />
                        <span className="h-6 w-6 rounded-full bg-white/85" />
                        <span className="h-6 w-6 rounded-full bg-white/85" />
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="h-7 w-5 rounded-sm bg-white" />
                        <span className="h-7 w-5 rounded-sm bg-white" />
                        <span className="h-7 w-5 rounded-sm bg-white" />
                        <span className="h-7 w-5 rounded-sm bg-mushroom" />
                        <span className="h-7 w-5 rounded-sm bg-mushroom" />
                      </div>
                      <span className="font-display text-lg font-extrabold tabular-nums text-white">
                        72
                      </span>
                    </div>
                  ) : (
                    <div
                      className="felt-surface table-rim shadow-felt relative h-[7.5rem] w-full max-w-md rounded-[42%] border-[10px] sm:h-36 sm:border-[12px]"
                      aria-hidden
                    >
                      <div className="absolute inset-0 flex items-center justify-center gap-2">
                        <span
                          className="table-chrome-disc flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-extrabold"
                          aria-hidden
                        >
                          D
                        </span>
                        <span
                          className="inline-flex h-6 w-6 items-center justify-center rounded-full border-2 text-[9px] font-bold"
                          style={{
                            backgroundColor: 'rgb(var(--table-chip-face))',
                            borderColor: 'rgb(var(--table-chip-rim))',
                            color: 'rgb(var(--table-chip-ink))',
                          }}
                          aria-hidden
                        >
                          25
                        </span>
                      </div>
                    </div>
                  )}
                  <div className="flex flex-wrap items-center justify-center gap-2">
                    <span
                      className="table-stack-fill rounded-md px-3 py-1 text-center text-xs font-extrabold tabular-nums"
                      aria-hidden
                    >
                      1,200
                    </span>
                    <span
                      className="table-stack-winner rounded-md px-3 py-1 text-center text-xs font-extrabold"
                      aria-hidden
                    >
                      Winner
                    </span>
                  </div>
                  <p className="font-display text-sm font-bold tracking-tight text-sidebar">
                    {tableColorPreset(draftTableColorId).label}
                    {draftTableLayout === 'v2' ? ' · Table v2' : ''}
                  </p>
                </div>
              </div>

              <ThemeRadioGroup
                label="Felt color"
                className="mt-5 grid grid-cols-3 gap-2.5 sm:grid-cols-3 sm:gap-3"
                options={TABLE_COLOR_PRESETS.map((p) => p.id)}
                selected={draftTableColorId}
                onSelect={(id) => void saveTableColor(id)}
                disabled={savingTableColor}
              >
                {({ tabIndexFor }) =>
                  TABLE_COLOR_PRESETS.map((preset) => {
                  const selected = draftTableColorId === preset.id;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      role="radio"
                      data-radio-value={preset.id}
                      tabIndex={tabIndexFor(preset.id)}
                      aria-checked={selected}
                      aria-label={preset.label}
                      disabled={savingTableColor}
                      onClick={() => void saveTableColor(preset.id)}
                      className={`group relative flex flex-col items-center gap-2 rounded-xl border px-2 py-3 transition disabled:opacity-60 sm:px-3 sm:py-3.5 ${
                        selected
                          ? 'border-sidebar bg-sidebar/[0.06] shadow-[0_0_0_1px_rgb(29_4_50_/_0.1)]'
                          : 'border-sidebar/10 bg-mushroom/30 hover:border-sidebar/22 hover:bg-mushroom/55'
                      }`}
                    >
                      <span
                        className={`table-theme relative block w-full max-w-[5.5rem] transition-transform duration-200 group-hover:scale-[1.03] ${
                          selected ? 'scale-[1.03]' : ''
                        }`}
                        data-table-color={preset.id}
                        aria-hidden
                      >
                        <span className="felt-surface table-rim block h-10 w-full rounded-[42%] border-[5px] shadow-[inset_0_0_0_1.5px_rgb(var(--felt-rim-edge)/0.55),0_2px_8px_rgb(29_4_50/0.18)] sm:h-11 sm:border-[6px]" />
                        {selected ? (
                          <SelectedCheck className="absolute -right-1 -top-1" />
                        ) : null}
                      </span>
                      <span
                        className={`text-center text-xs font-semibold leading-tight ${
                          selected ? 'text-sidebar' : 'text-sidebar'
                        }`}
                      >
                        {preset.label}
                      </span>
                    </button>
                  );
                })
                }
              </ThemeRadioGroup>

              <div className="mt-8 flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
                <div className="min-w-0">
                  <h3 className="font-heading-section">Table sounds</h3>
                  <p className="mt-1.5 max-w-lg font-prose-muted">
                    Mute deal, action, and win audio. Only you hear this.
                  </p>
                </div>
                {savingSfxMuted ? (
                  <p className="text-xs font-medium text-ink-strong-muted" role="status">
                    Saving…
                  </p>
                ) : null}
              </div>

              <ThemeRadioGroup
                label="Table sounds"
                className="mt-5 grid grid-cols-2 gap-3"
                options={[false, true]}
                selected={draftSfxMuted}
                onSelect={(muted) => void saveSounds(muted)}
                disabled={savingSfxMuted}
              >
                {({ tabIndexFor }) =>
                (
                  [
                    {
                      muted: false,
                      label: 'On',
                      hint: 'Play table audio',
                    },
                    {
                      muted: true,
                      label: 'Muted',
                      hint: 'Silence table audio',
                    },
                  ] as const
                ).map((option) => {
                  const selected = draftSfxMuted === option.muted;
                  return (
                    <button
                      key={option.label}
                      type="button"
                      role="radio"
                      data-radio-value={String(option.muted)}
                      tabIndex={tabIndexFor(option.muted)}
                      aria-checked={selected}
                      aria-label={`${option.label}, ${option.hint}`}
                      disabled={savingSfxMuted}
                      onClick={() => void saveSounds(option.muted)}
                      className={`flex items-center justify-between gap-2 rounded-2xl border-2 px-3 py-3 text-left transition disabled:opacity-60 ${
                        selected
                          ? 'border-sidebar bg-sidebar/[0.06] shadow-[0_0_0_1px_rgb(29_4_50_/_0.1)]'
                          : 'border-sidebar/10 bg-mushroom/30 hover:border-sidebar/22'
                      }`}
                    >
                      <span>
                        <span className="block text-sm font-semibold text-sidebar">
                          {option.label}
                        </span>
                        <span className="block text-xs text-ink-strong-muted">
                          {option.hint}
                        </span>
                      </span>
                      {selected ? <SelectedCheck /> : null}
                    </button>
                  );
                })
                }
              </ThemeRadioGroup>
            </section>
          ) : tab === 'contests' ? (
            <section
              role="tabpanel"
              id="profile-panel-contests"
              aria-labelledby="profile-tab-contests"
              className="surface-card-lg"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                <div className="min-w-0">
                  <h3 className="font-heading-section">
                    Contest matches
                  </h3>
                  <p className="mt-1.5 font-prose-muted">
                    Completed contests you played, with place and ranking prizes.
                  </p>
                </div>
              </div>

              {contestHistory.length === 0 ? (
                <p className="mt-5 text-sm text-ink-strong-muted">
                  No completed contests yet.{' '}
                  <Link
                    href="/contests"
                    className="link-sidebar"
                  >
                    Join or host one
                  </Link>
                  .
                </p>
              ) : (
                <ul className="surface-list mt-5">
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
                              {when} · {contestModeLabel(row.contest.mode)} ·{' '}
                              {row.contest.entrants.length} players
                            </span>
                          </span>
                          <span className="flex shrink-0 flex-col items-end gap-0.5">
                            <span className="font-mono text-sm font-semibold text-sidebar">
                              {placeLabel(row.place)}
                            </span>
                            {row.prizeWhuffies > 0 ? (
                              <MoneyAmount
                                amount={row.prizeWhuffies}
                                showWhuffies
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
              className="surface-card-lg"
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
