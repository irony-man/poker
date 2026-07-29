'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ChoiceRow } from '@/components/ChoiceRow';
import { AvatarPicker } from '@/components/PlayerAvatar';
import { PublicTablesPanel } from '@/components/PublicTablesPanel';
import { createTable, register, resolveInvite } from '@/lib/api';
import { loadSavedAvatarId, saveAvatarId } from '@/lib/avatars';
import { useSession } from '@/lib/store';
import { DEFAULT_STAKE_ID, STAKE_PRESETS, stakeById } from '@poker/protocol';

const SEAT_OPTIONS = [2, 3, 4, 5, 6, 7, 8, 9] as const;

type LobbyTab = 'host' | 'join' | 'offline';

export default function HomePage() {
  const router = useRouter();
  const setSession = useSession((s) => s.setSession);
  const sessionName = useSession((s) => s.name);
  const [name, setName] = useState(sessionName ?? '');
  const [avatarId, setAvatarId] = useState(0);
  const [invite, setInvite] = useState('');
  const [maxSeats, setMaxSeats] = useState(6);
  const [botCount, setBotCount] = useState(2);
  const [hostStakeId, setHostStakeId] = useState(DEFAULT_STAKE_ID);
  const [offlineSeats, setOfflineSeats] = useState(6);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<LobbyTab>('host');

  useEffect(() => {
    setAvatarId(loadSavedAvatarId());
    const raw = localStorage.getItem('felt-session');
    if (raw) {
      try {
        const s = JSON.parse(raw) as {
          userId: string;
          name: string;
          ticket: string;
          avatarId?: number;
        };
        setSession(s);
        if (!name) setName(s.name);
        if (typeof s.avatarId === 'number') {
          setAvatarId(s.avatarId);
          saveAvatarId(s.avatarId);
        }
      } catch {
        /* ignore */
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- hydrate once
  }, [setSession]);

  useEffect(() => {
    const maxBots = Math.max(0, maxSeats - 1);
    if (botCount > maxBots) setBotCount(maxBots);
  }, [maxSeats, botCount]);

  function pickAvatar(id: number) {
    setAvatarId(id);
    saveAvatarId(id);
  }

  async function ensureSession(displayName: string) {
    const trimmed = displayName.trim() || 'Player';
    const raw = localStorage.getItem('felt-session');
    let existingUserId: string | undefined;
    if (raw) {
      try {
        const prev = JSON.parse(raw) as { userId?: string };
        if (prev.userId) existingUserId = prev.userId;
      } catch {
        /* ignore */
      }
    }
    const s = await register(trimmed, avatarId, { userId: existingUserId });
    const session = { ...s, avatarId: s.avatarId ?? avatarId };
    setSession(session);
    localStorage.setItem('felt-session', JSON.stringify(session));
    saveAvatarId(session.avatarId);
    return session;
  }

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError('Enter a callsign to play');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const session = await ensureSession(name);
      const stake = stakeById(hostStakeId) ?? STAKE_PRESETS[1]!;
      const table = await createTable({
        userId: session.userId,
        name: `${session.name}'s Table`,
        smallBlind: stake.smallBlind,
        bigBlind: stake.bigBlind,
        buyIn: stake.buyIn,
        turnTimeMs: 20000,
        maxSeats,
        botCount,
        isPrivate: true,
      });
      router.push(`/table/${table.tableId}?invite=${table.inviteCode}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    } finally {
      setBusy(false);
    }
  }

  async function enterInvite(mode: 'play' | 'spectate') {
    if (!name.trim()) {
      setError('Enter a callsign to play');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await ensureSession(name);
      const t = await resolveInvite(invite.trim());
      const spectate = mode === 'spectate' ? '&mode=spectate' : '';
      router.push(`/table/${t.tableId}?invite=${t.inviteCode}${spectate}`);
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
    if (!name.trim()) {
      setError('Enter a callsign to play');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await ensureSession(name);
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

  const identityBlock = (
    <div className="hud-panel mx-auto max-w-xl space-y-3 p-3">
      <label className="block">
        <span className="hud-label">Callsign</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="hud-input"
          required
          maxLength={32}
          placeholder="Your name at the table"
        />
      </label>
      <AvatarPicker value={avatarId} onChange={pickAvatar} />
    </div>
  );

  const hostForm = (
    <form onSubmit={onCreate} className="hud-panel flex h-full flex-col gap-3 p-4 sm:gap-3.5 sm:p-6">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-display text-xl font-bold uppercase tracking-wider text-gold">Host</h2>
        <span className="text-[10px] font-display uppercase tracking-[0.2em] text-cyan/70">Online</span>
      </div>
      {/* Desktop still shows callsign in-panel; mobile uses sticky identity */}
      <label className="hidden sm:block">
        <span className="hud-label">Callsign</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="hud-input"
          required
          maxLength={32}
          placeholder="Your name at the table"
        />
      </label>
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
      <label className="hidden sm:block">
        <span className="hud-label">Callsign</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="hud-input"
          required
          maxLength={32}
          placeholder="Your name at the table"
        />
      </label>
      <label className="block">
        <span className="hud-label">Invite code</span>
        <input
          value={invite}
          onChange={(e) => setInvite(e.target.value)}
          className="hud-input font-mono tracking-widest uppercase"
          required
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
        <label className="hidden min-w-0 sm:block">
          <span className="hud-label">Callsign</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="hud-input"
            required
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
    { id: 'offline', label: 'Offline' },
  ];

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
          Drop into No-Limit Texas Hold&apos;em. Pick a callsign, host a table, join with a code, or
          grind offline vs bots.
        </p>
      </div>

      {/* Mobile: sticky identity once */}
      <div className="sticky top-0 z-30 mt-4 bg-ink/90 pb-2 pt-1 backdrop-blur-md sm:hidden">
        {identityBlock}
        <div
          role="tablist"
          aria-label="Lobby mode"
          className="mt-2 flex rounded-xl border border-cream/15 bg-ink-panel/90 p-1"
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

      {/* Desktop avatar (callsigns stay in each panel) */}
      <div className="mt-6 hidden sm:block">
        <div className="hud-panel mx-auto max-w-xl p-4 sm:p-5">
          <AvatarPicker value={avatarId} onChange={pickAvatar} />
        </div>
      </div>

      {/* Mobile: one panel */}
      <div className="mt-3 space-y-3 sm:hidden">
        {tab === 'host' && hostForm}
        {tab === 'join' && (
          <>
            {joinForm}
            <PublicTablesPanel disabled={busy} onJoin={joinPublicTable} />
          </>
        )}
        {tab === 'offline' && offlineForm}
      </div>

      {/* Desktop: grid */}
      <div className="mt-6 hidden gap-4 sm:grid sm:grid-cols-2 sm:gap-5 sm:items-stretch">
        {hostForm}
        {joinForm}
        <PublicTablesPanel disabled={busy} onJoin={joinPublicTable} />
        {offlineForm}
      </div>

      {error && (
        <p className="mt-4 status-chip border-red-500/40 bg-red-950/50 text-red-300">{error}</p>
      )}
    </div>
  );
}
