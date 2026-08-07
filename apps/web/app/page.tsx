'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ChoiceRow } from '@/components/ChoiceRow';
import { FriendsPanel } from '@/components/FriendsPanel';
import { PublicTablesPanel } from '@/components/PublicTablesPanel';
import { ContestsPanel } from '@/components/ContestsPanel';
import {
  createTable,
  logout as apiLogout,
  refreshTicket,
  resolveContestInvite,
  resolveInvite,
} from '@/lib/api';
import { loadSavedAvatarId, saveAvatarId } from '@/lib/avatars';
import {
  clearStoredSession,
  readStoredSession,
  writeStoredSession,
  type StoredSession,
} from '@/lib/session';
import { useSession } from '@/lib/store';
import { DEFAULT_STAKE_ID, STAKE_PRESETS, stakeById } from '@poker/protocol';

const SEAT_OPTIONS = [2, 3, 4, 5, 6, 7, 8, 9] as const;

type LobbyTab = 'host' | 'join' | 'contests' | 'offline';

export default function HomePage() {
  const router = useRouter();
  const setSession = useSession((s) => s.setSession);
  const clearSession = useSession((s) => s.clearSession);
  const sessionName = useSession((s) => s.name);
  const sessionToken = useSession((s) => s.sessionToken);
  const [authReady, setAuthReady] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [name, setName] = useState(sessionName ?? '');
  const [invite, setInvite] = useState('');
  const [maxSeats, setMaxSeats] = useState(6);
  const [botCount, setBotCount] = useState(2);
  const [hostStakeId, setHostStakeId] = useState(DEFAULT_STAKE_ID);
  const [customRoomCode, setCustomRoomCode] = useState('');
  const [offlineSeats, setOfflineSeats] = useState(6);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<LobbyTab>('host');

  useEffect(() => {
    let cancelled = false;
    async function hydrate() {
      const stored = readStoredSession();
      if (!stored) {
        if (!cancelled) {
          setAuthReady(true);
          setSignedIn(false);
        }
        return;
      }
      try {
        const refreshed = await refreshTicket(stored.sessionToken);
        if (cancelled) return;
        const next: StoredSession = {
          userId: refreshed.userId,
          username: refreshed.username ?? stored.username,
          name: refreshed.name,
          ticket: refreshed.ticket,
          sessionToken: stored.sessionToken,
          avatarId: refreshed.avatarId ?? stored.avatarId ?? loadSavedAvatarId(),
        };
        setSession(next);
        writeStoredSession(next);
        if (typeof next.avatarId === 'number') saveAvatarId(next.avatarId);
        setName(next.name);
        setSignedIn(true);
      } catch {
        if (cancelled) return;
        clearStoredSession();
        clearSession();
        setSignedIn(false);
      } finally {
        if (!cancelled) setAuthReady(true);
      }
    }
    void hydrate();
    return () => {
      cancelled = true;
    };
  }, [setSession, clearSession]);

  useEffect(() => {
    const maxBots = Math.max(0, maxSeats - 1);
    if (botCount > maxBots) setBotCount(maxBots);
  }, [maxSeats, botCount]);

  async function ensureSession(): Promise<StoredSession> {
    const stored = readStoredSession();
    if (!stored) {
      router.push('/sign-in');
      throw new Error('Sign in required');
    }
    try {
      const refreshed = await refreshTicket(stored.sessionToken);
      const next: StoredSession = {
        userId: refreshed.userId,
        username: refreshed.username ?? stored.username,
        name: refreshed.name,
        ticket: refreshed.ticket,
        sessionToken: stored.sessionToken,
        avatarId: refreshed.avatarId ?? stored.avatarId,
      };
      setSession(next);
      writeStoredSession(next);
      setName(next.name);
      setSignedIn(true);
      return next;
    } catch {
      clearStoredSession();
      clearSession();
      setSignedIn(false);
      router.push('/sign-in');
      throw new Error('Session expired — sign in again');
    }
  }

  async function onLogout() {
    const token = sessionToken ?? readStoredSession()?.sessionToken;
    if (token) {
      try {
        await apiLogout(token);
      } catch {
        /* ignore */
      }
    }
    clearStoredSession();
    clearSession();
    setSignedIn(false);
    setName('');
  }

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const session = await ensureSession();
      const stake = stakeById(hostStakeId) ?? STAKE_PRESETS[1]!;
      const code = customRoomCode.trim();
      if (code && !/^\d{4,8}$/.test(code)) {
        setError('Room code must be 4–8 digits');
        setBusy(false);
        return;
      }
      const table = await createTable(
        {
          name: `${session.name}'s Table`,
          smallBlind: stake.smallBlind,
          bigBlind: stake.bigBlind,
          buyIn: stake.buyIn,
          turnTimeMs: 20000,
          maxSeats,
          botCount,
          isPrivate: true,
          ...(code ? { inviteCode: code } : {}),
        },
        session.sessionToken,
      );
      router.push(`/table/${table.tableId}?invite=${table.inviteCode}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    } finally {
      setBusy(false);
    }
  }

  async function enterContestCode(code: string) {
    const session = await ensureSession();
    const { contest } = await resolveContestInvite(code);
    const { registerContest } = await import('@/lib/api');
    await registerContest(contest.id, { sessionToken: session.sessionToken });
    router.push(`/contest/${contest.id}`);
  }

  async function enterInvite(mode: 'play' | 'spectate') {
    setBusy(true);
    setError(null);
    try {
      await ensureSession();
      try {
        const t = await resolveInvite(invite.trim());
        const spectate = mode === 'spectate' ? '&mode=spectate' : '';
        router.push(`/table/${t.tableId}?invite=${t.inviteCode}${spectate}`);
      } catch {
        await enterContestCode(invite.trim());
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    } finally {
      setBusy(false);
    }
  }

  async function onJoin(e: React.FormEvent) {
    e.preventDefault();
    await enterInvite('play');
  }

  async function onSpectate(e: React.FormEvent) {
    e.preventDefault();
    await enterInvite('spectate');
  }

  async function joinPublicTable(tableId: string, inviteCode: string) {
    setBusy(true);
    setError(null);
    try {
      await ensureSession();
      router.push(`/table/${tableId}?invite=${inviteCode}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    } finally {
      setBusy(false);
    }
  }

  const maxBots = Math.max(0, maxSeats - 1);

  function onOffline(e: React.FormEvent) {
    e.preventDefault();
    const display = encodeURIComponent(name.trim() || 'Player');
    router.push(`/offline?name=${display}&seats=${offlineSeats}`);
  }

  if (!authReady) {
    return <p className="pt-16 text-center text-cream/60">Loading…</p>;
  }

  if (!signedIn) {
    return (
      <div className="relative mx-auto w-full max-w-lg px-1 pt-10 pb-8 text-center">
        <div className="pointer-events-none absolute -top-6 left-1/2 h-40 w-[24rem] -translate-x-1/2 rounded-full bg-gold/10 blur-3xl" />
        <h1 className="font-display text-5xl sm:text-6xl font-extrabold tracking-[0.06em] text-transparent bg-clip-text bg-gradient-to-br from-gold-light via-gold to-gold-dim uppercase leading-none">
          Felt
        </h1>
        <p className="mt-3 text-cream/65 text-sm sm:text-base">
          Sign in to host private tables, join with a code, or play contests.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link href="/sign-in" className="btn-primary min-h-11 px-8">
            Sign in
          </Link>
          <Link href="/sign-up" className="btn-ghost min-h-11 px-8">
            Create account
          </Link>
        </div>
        <p className="mt-6 text-sm text-cream/45">
          Offline vs bots needs no account —{' '}
          <Link href="/offline?name=Player&seats=6" className="text-gold hover:underline">
            play offline
          </Link>
        </p>
      </div>
    );
  }

  const identityBlock = (
    <div className="hud-panel mx-auto max-w-xl space-y-2 p-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <span className="hud-label">Signed in as</span>
          <p className="font-display text-lg text-gold">{name}</p>
        </div>
        <button type="button" onClick={() => void onLogout()} className="btn-ghost text-xs px-3 py-2">
          Sign out
        </button>
      </div>
    </div>
  );

  const hostForm = (
    <form onSubmit={onCreate} className="hud-panel flex h-full flex-col gap-3 p-4 sm:gap-3.5 sm:p-6">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-display text-xl font-bold uppercase tracking-wider text-gold">Host</h2>
        <span className="text-[10px] font-display uppercase tracking-[0.2em] text-cyan/70">Online</span>
      </div>
      <ChoiceRow
        label="Stakes"
        name="host-stakes"
        selected={hostStakeId}
        options={STAKE_PRESETS.map((s) => s.id)}
        onSelect={setHostStakeId}
        format={(id) => {
          const s = stakeById(id)!;
          return (
            <span className="inline-flex flex-col items-start leading-tight">
              <span>{s.label}</span>
              <span className="text-[10px] font-medium opacity-70">
                ${s.buyIn} · {s.smallBlind}/{s.bigBlind}
              </span>
            </span>
          );
        }}
      />
      <ChoiceRow
        label="Seats"
        name="host-seats"
        selected={maxSeats}
        options={SEAT_OPTIONS}
        onSelect={setMaxSeats}
      />
      <ChoiceRow
        label="Starting bots"
        name="host-bots"
        selected={botCount}
        options={Array.from({ length: maxBots + 1 }, (_, n) => n)}
        onSelect={setBotCount}
        format={(n) => (n === 0 ? 'None' : String(n))}
      />
      <label className="block">
        <span className="hud-label">Room code (optional)</span>
        <input
          value={customRoomCode}
          onChange={(e) => setCustomRoomCode(e.target.value.replace(/\D/g, '').slice(0, 8))}
          className="hud-input font-mono tracking-[0.2em]"
          inputMode="numeric"
          pattern="\d{4,8}"
          maxLength={8}
          placeholder="Auto · or 4–8 digits"
          autoComplete="off"
        />
      </label>
      <button disabled={busy} type="submit" className="btn-primary mt-auto min-h-11 w-full">
        Create private table
      </button>
    </form>
  );

  const joinForm = (
    <form onSubmit={onJoin} className="hud-panel flex h-full flex-col gap-3 p-4 sm:gap-3.5 sm:p-6">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-display text-xl font-bold uppercase tracking-wider text-gold">Join</h2>
        <span className="text-[10px] font-display uppercase tracking-[0.2em] text-cyan/70">Invite</span>
      </div>
      <label className="block">
        <span className="hud-label">Invite code</span>
        <input
          value={invite}
          onChange={(e) => setInvite(e.target.value.trim())}
          className="hud-input font-mono tracking-[0.2em]"
          inputMode="numeric"
          maxLength={8}
          required
          placeholder="Room code"
          autoComplete="off"
        />
      </label>
      <div className="mt-auto grid grid-cols-2 gap-2.5 pt-1">
        <button disabled={busy} type="submit" className="btn-ghost min-h-11 w-full">
          Enter table
        </button>
        <button
          disabled={busy || !invite.trim()}
          type="button"
          onClick={onSpectate}
          className="min-h-11 rounded border border-cyan/35 bg-cyan/10 px-4 py-2.5 text-sm font-display font-semibold uppercase tracking-wider text-cyan transition hover:bg-cyan/20 disabled:opacity-40"
        >
          Spectate
        </button>
      </div>
    </form>
  );

  const offlineForm = (
    <form onSubmit={onOffline} className="hud-panel flex flex-col gap-3 p-4 sm:col-span-2 sm:gap-3.5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-display text-xl font-bold uppercase tracking-wider text-gold">
            Offline arena
          </h2>
          <p className="mt-1 text-sm text-cream/45 font-medium">
            Local bots · no server · same engine
          </p>
        </div>
        <span className="status-chip border-felt-neon/30 bg-felt-neon/10 text-felt-neon shrink-0">
          Solo mode
        </span>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 sm:gap-4">
        <label className="min-w-0 block">
          <span className="hud-label">Display name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="hud-input"
            maxLength={32}
          />
        </label>
        <ChoiceRow
          label="Seats"
          name="offline-seats"
          selected={offlineSeats}
          options={SEAT_OPTIONS}
          onSelect={setOfflineSeats}
          format={(n) => `${n} · ${n - 1} bots`}
        />
      </div>
      <button type="submit" className="btn-ghost min-h-11 w-full sm:w-auto sm:self-start">
        Launch offline game
      </button>
    </form>
  );

  const tabs: { id: LobbyTab; label: string }[] = [
    { id: 'host', label: 'Host' },
    { id: 'join', label: 'Join' },
    { id: 'contests', label: 'Contests' },
    { id: 'offline', label: 'Offline' },
  ];

  const contestsPanel = (
    <ContestsPanel
      disabled={busy}
      sessionToken={sessionToken}
      displayName={name}
      onEnsureSession={ensureSession}
      onOpenContest={(id) => router.push(`/contest/${id}`)}
      onJoinCode={async (code) => {
        setBusy(true);
        setError(null);
        try {
          await enterContestCode(code);
        } finally {
          setBusy(false);
        }
      }}
    />
  );

  return (
    <div className="relative mx-auto w-full max-w-5xl px-1 sm:px-0 pt-3 sm:pt-8 pb-8">
      <div className="pointer-events-none absolute -top-6 left-1/2 h-40 w-[24rem] -translate-x-1/2 rounded-full bg-gold/10 blur-3xl" />

      <div className="relative text-center">
        <p className="status-chip border-gold/30 bg-gold/10 text-gold mx-auto w-fit mb-2 sm:mb-3">
          Casino night · private tables
        </p>
        <h1 className="font-display text-5xl sm:text-6xl font-extrabold tracking-[0.06em] text-transparent bg-clip-text bg-gradient-to-br from-gold-light via-gold to-gold-dim uppercase leading-none">
          Felt
        </h1>
        <p className="mt-2 sm:mt-3 mx-auto max-w-xl text-cream/65 text-sm sm:text-lg font-medium tracking-wide leading-relaxed">
          Host a table, join with a code, or grind offline vs bots.
        </p>
      </div>

      <div className="sticky top-0 z-30 mt-4 bg-ink/90 pb-2 pt-1 backdrop-blur-md sm:static sm:bg-transparent sm:backdrop-blur-none">
        {identityBlock}
        <div
          role="tablist"
          aria-label="Lobby mode"
          className="mt-2 flex rounded-xl border border-cream/15 bg-ink-panel/90 p-1 sm:hidden"
        >
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={`min-h-11 flex-1 rounded-lg text-xs font-display font-bold uppercase tracking-wider transition ${
                tab === t.id
                  ? 'bg-gold/20 text-gold shadow-sm'
                  : 'text-cream/50 hover:text-cream/80'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-3 space-y-3 sm:hidden">
        {tab === 'host' && hostForm}
        {tab === 'join' && (
          <>
            {joinForm}
            <PublicTablesPanel disabled={busy} onJoin={joinPublicTable} />
            <FriendsPanel
              disabled={busy}
              onNavigateTable={(tableId, inviteCode) => {
                void (async () => {
                  setBusy(true);
                  setError(null);
                  try {
                    await ensureSession();
                    router.push(`/table/${tableId}?invite=${inviteCode}`);
                  } catch (err) {
                    setError(err instanceof Error ? err.message : 'Failed');
                  } finally {
                    setBusy(false);
                  }
                })();
              }}
            />
          </>
        )}
        {tab === 'contests' && contestsPanel}
        {tab === 'offline' && offlineForm}
      </div>

      <div className="mt-6 hidden gap-4 sm:grid sm:grid-cols-2 sm:gap-5 sm:items-stretch">
        {hostForm}
        {joinForm}
        <PublicTablesPanel disabled={busy} onJoin={joinPublicTable} />
        {contestsPanel}
        {offlineForm}
        <FriendsPanel
          disabled={busy}
          onNavigateTable={(tableId, inviteCode) => {
            void (async () => {
              setBusy(true);
              setError(null);
              try {
                await ensureSession();
                router.push(`/table/${tableId}?invite=${inviteCode}`);
              } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed');
              } finally {
                setBusy(false);
              }
            })();
          }}
        />
      </div>

      {error && (
        <p
          role="alert"
          className="mt-4 status-chip border-red-500/40 bg-red-950/50 text-red-300"
        >
          {error}
        </p>
      )}
    </div>
  );
}
