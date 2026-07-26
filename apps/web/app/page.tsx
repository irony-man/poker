'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { createTable, register, resolveInvite } from '@/lib/api';
import { useSession } from '@/lib/store';

export default function HomePage() {
  const router = useRouter();
  const setSession = useSession((s) => s.setSession);
  const userId = useSession((s) => s.userId);
  const sessionName = useSession((s) => s.name);
  const ticket = useSession((s) => s.ticket);
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
    // Always hit the API so returning users get a fresh ticket after
    // expiry or a Render free-tier cold start (in-memory auth resets).
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
    <div className="mx-auto max-w-3xl pt-8 sm:pt-16">
      <h1 className="font-display text-4xl sm:text-5xl text-gold leading-tight">Felt</h1>
      <p className="mt-3 max-w-md text-cream/70 text-lg">
        Private No-Limit Texas Hold&apos;em for home games. Authoritative server, invite links, real-time
        table sync — or practice offline vs bots.
      </p>

      <div className="mt-10 grid gap-6 sm:grid-cols-2">
        <form onSubmit={onCreate} className="space-y-4 rounded-2xl border border-cream/10 bg-ink/40 p-5">
          <h2 className="font-display text-xl">Host a table</h2>
          <label className="block text-sm text-cream/60">
            Your name
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-md bg-cream/5 border border-cream/15 px-3 py-2 text-cream"
              required
              maxLength={32}
            />
          </label>
          <label className="block text-sm text-cream/60">
            Seats at table
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
          <label className="block text-sm text-cream/60">
            Starting bots
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
          <button
            disabled={busy}
            type="submit"
            className="w-full rounded-lg bg-gold py-2.5 font-semibold text-ink hover:bg-gold-light disabled:opacity-50"
          >
            Create private table
          </button>
        </form>

        <form onSubmit={onJoin} className="space-y-4 rounded-2xl border border-cream/10 bg-ink/40 p-5">
          <h2 className="font-display text-xl">Join with invite</h2>
          <label className="block text-sm text-cream/60">
            Your name
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-md bg-cream/5 border border-cream/15 px-3 py-2 text-cream"
              required
              maxLength={32}
            />
          </label>
          <label className="block text-sm text-cream/60">
            Invite code
            <input
              value={invite}
              onChange={(e) => setInvite(e.target.value)}
              className="mt-1 w-full rounded-md bg-cream/5 border border-cream/15 px-3 py-2 text-cream"
              required
            />
          </label>
          <button
            disabled={busy}
            type="submit"
            className="w-full rounded-lg border border-gold/50 py-2.5 font-semibold text-gold hover:bg-gold/10 disabled:opacity-50"
          >
            Join table
          </button>
        </form>
      </div>

      <form
        onSubmit={onOffline}
        className="mt-6 space-y-4 rounded-2xl border border-cream/10 bg-ink/40 p-5"
      >
        <div>
          <h2 className="font-display text-xl">Play offline vs bots</h2>
          <p className="mt-1 text-sm text-cream/50">
            No server needed — same rules engine runs in your browser.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="block text-sm text-cream/60">
            Your name
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-md bg-cream/5 border border-cream/15 px-3 py-2 text-cream"
              required
              maxLength={32}
            />
          </label>
          <label className="block text-sm text-cream/60">
            Seats
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
          <label className="block text-sm text-cream/60">
            Bots
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
        <button
          type="submit"
          className="w-full sm:w-auto rounded-lg border border-cream/25 px-5 py-2.5 font-semibold text-cream hover:bg-cream/10"
        >
          Start offline game
        </button>
      </form>

      {error && <p className="mt-4 text-sm text-red-400">{error}</p>}
    </div>
  );
}
