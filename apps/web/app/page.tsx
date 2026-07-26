'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { createTable, register, resolveInvite } from '@/lib/api';
import { useSession } from '@/lib/store';

export default function HomePage() {
  const router = useRouter();
  const setSession = useSession((s) => s.setSession);
  const sessionName = useSession((s) => s.name);
  const [name, setName] = useState(sessionName ?? '');
  const [invite, setInvite] = useState('');
  const [maxSeats, setMaxSeats] = useState(6);
  const [botCount, setBotCount] = useState(2);
  const [offlineSeats, setOfflineSeats] = useState(6);
  const [offlineBots, setOfflineBots] = useState(3);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const raw = localStorage.getItem('felt-session');
    if (raw) {
      try {
        const s = JSON.parse(raw) as { userId: string; name: string; ticket: string };
        setSession(s);
        setName(s.name);
      } catch {
        /* ignore */
      }
    }
  }, [setSession]);

  useEffect(() => {
    const maxBots = Math.max(0, maxSeats - 1);
    if (botCount > maxBots) setBotCount(maxBots);
  }, [maxSeats, botCount]);

  useEffect(() => {
    const maxBots = Math.max(1, offlineSeats - 1);
    if (offlineBots > maxBots) setOfflineBots(maxBots);
    if (offlineBots < 1) setOfflineBots(1);
  }, [offlineSeats, offlineBots]);

  async function ensureSession(displayName: string) {
    const s = await register(displayName.trim() || 'Player');
    setSession(s);
    localStorage.setItem('felt-session', JSON.stringify(s));
    return s;
  }

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const session = await ensureSession(name.trim() || 'Player');
      const table = await createTable({
        userId: session.userId,
        name: `${session.name}'s Table`,
        smallBlind: 5,
        bigBlind: 10,
        minBuyIn: 200,
        maxBuyIn: 1000,
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

  async function onJoin(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await ensureSession(name.trim() || 'Player');
      const t = await resolveInvite(invite.trim());
      router.push(`/table/${t.tableId}?invite=${t.inviteCode}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    } finally {
      setBusy(false);
    }
  }

  const maxBots = Math.max(0, maxSeats - 1);
  const maxOfflineBots = Math.max(1, offlineSeats - 1);

  function onOffline(e: React.FormEvent) {
    e.preventDefault();
    const display = encodeURIComponent(name.trim() || 'Player');
    router.push(`/offline?name=${display}&seats=${offlineSeats}&bots=${offlineBots}`);
  }

  return (
    <div className="relative mx-auto max-w-4xl pt-6 sm:pt-12 pb-10">
      <div className="pointer-events-none absolute -top-8 left-1/2 h-48 w-[28rem] -translate-x-1/2 rounded-full bg-gold/10 blur-3xl" />

      <div className="relative text-center sm:text-left">
        <p className="status-chip border-gold/30 bg-gold/10 text-gold mx-auto sm:mx-0 w-fit mb-4">
          Casino night · private tables
        </p>
        <h1 className="font-display text-5xl sm:text-7xl font-extrabold tracking-[0.06em] text-transparent bg-clip-text bg-gradient-to-br from-gold-light via-gold to-gold-dim uppercase leading-none">
          Felt
        </h1>
        <p className="mt-4 max-w-lg text-cream/65 text-lg sm:text-xl font-medium tracking-wide mx-auto sm:mx-0">
          Drop into No-Limit Texas Hold&apos;em. Host a private table, join with a code, or grind offline
          vs bots.
        </p>
      </div>

      <div className="mt-10 grid gap-5 sm:grid-cols-2">
        <form onSubmit={onCreate} className="hud-panel space-y-4 p-5">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-display text-xl font-bold uppercase tracking-wider text-gold">Host</h2>
            <span className="text-[10px] font-display uppercase tracking-[0.2em] text-cyan/70">Online</span>
          </div>
          <label>
            <span className="hud-label">Callsign</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="hud-input"
              required
              maxLength={32}
            />
          </label>
          <label>
            <span className="hud-label">Seats</span>
            <select
              value={maxSeats}
              onChange={(e) => setMaxSeats(Number(e.target.value))}
              className="field-select mt-1"
            >
              {[2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                <option key={n} value={n}>
                  {n} seats
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="hud-label">Starting bots</span>
            <select
              value={botCount}
              onChange={(e) => setBotCount(Number(e.target.value))}
              className="field-select mt-1"
            >
              {Array.from({ length: maxBots + 1 }, (_, n) => (
                <option key={n} value={n}>
                  {n === 0 ? 'None' : `${n} bot${n === 1 ? '' : 's'}`}
                </option>
              ))}
            </select>
          </label>
          <button disabled={busy} type="submit" className="btn-primary w-full">
            Create private table
          </button>
        </form>

        <form onSubmit={onJoin} className="hud-panel space-y-4 p-5">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-display text-xl font-bold uppercase tracking-wider text-gold">Join</h2>
            <span className="text-[10px] font-display uppercase tracking-[0.2em] text-cyan/70">Invite</span>
          </div>
          <label>
            <span className="hud-label">Callsign</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="hud-input"
              required
              maxLength={32}
            />
          </label>
          <label>
            <span className="hud-label">Invite code</span>
            <input
              value={invite}
              onChange={(e) => setInvite(e.target.value)}
              className="hud-input font-mono tracking-widest uppercase"
              required
            />
          </label>
          <button disabled={busy} type="submit" className="btn-ghost w-full">
            Enter table
          </button>
        </form>
      </div>

      <form onSubmit={onOffline} className="hud-panel mt-5 space-y-4 p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-display text-xl font-bold uppercase tracking-wider text-gold">
              Offline arena
            </h2>
            <p className="mt-1 text-sm text-cream/45 font-medium">
              Local bots · no server · same engine
            </p>
          </div>
          <span className="status-chip border-felt-neon/30 bg-felt-neon/10 text-felt-neon">Solo mode</span>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <label>
            <span className="hud-label">Callsign</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="hud-input"
              required
              maxLength={32}
            />
          </label>
          <label>
            <span className="hud-label">Seats</span>
            <select
              value={offlineSeats}
              onChange={(e) => setOfflineSeats(Number(e.target.value))}
              className="field-select mt-1"
            >
              {[2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                <option key={n} value={n}>
                  {n} seats
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="hud-label">Bots</span>
            <select
              value={offlineBots}
              onChange={(e) => setOfflineBots(Number(e.target.value))}
              className="field-select mt-1"
            >
              {Array.from({ length: maxOfflineBots }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>
                  {n} bot{n === 1 ? '' : 's'}
                </option>
              ))}
            </select>
          </label>
        </div>
        <button type="submit" className="btn-ghost">
          Launch offline game
        </button>
      </form>

      {error && (
        <p className="mt-4 status-chip border-red-500/40 bg-red-950/50 text-red-300">{error}</p>
      )}
    </div>
  );
}
