'use client';

import { SignInButton, SignUpButton, useAuth, useUser } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { AvatarPicker } from '@/components/PlayerAvatar';
import { FriendsPanel } from '@/components/FriendsPanel';
import { createTable, register, resolveInvite } from '@/lib/api';
import { loadSavedAvatarId, saveAvatarId } from '@/lib/avatars';
import { useSession } from '@/lib/store';

function clerkDisplayName(user: {
  fullName?: string | null;
  username?: string | null;
  firstName?: string | null;
  primaryEmailAddress?: { emailAddress: string } | null;
} | null | undefined): string {
  if (!user) return 'Player';
  const fromProfile =
    user.fullName?.trim() ||
    user.username?.trim() ||
    user.firstName?.trim() ||
    user.primaryEmailAddress?.emailAddress?.split('@')[0];
  return (fromProfile || 'Player').slice(0, 32);
}

export default function HomePage() {
  const router = useRouter();
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const { user } = useUser();
  const setSession = useSession((s) => s.setSession);
  const sessionUserId = useSession((s) => s.userId);
  const sessionName = useSession((s) => s.name);
  const [name, setName] = useState(sessionName ?? '');
  const [avatarId, setAvatarId] = useState(0);
  const [invite, setInvite] = useState('');
  const [maxSeats, setMaxSeats] = useState(6);
  const [botCount, setBotCount] = useState(2);
  const [offlineSeats, setOfflineSeats] = useState(6);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    if (!isLoaded || !isSignedIn || !user) return;
    setName((prev) => prev.trim() || clerkDisplayName(user));
  }, [isLoaded, isSignedIn, user]);

  useEffect(() => {
    if (!isLoaded || !isSignedIn || sessionUserId) return;
    const display = name.trim() || clerkDisplayName(user);
    void (async () => {
      try {
        const clerkToken = await getToken();
        if (!clerkToken) return;
        const s = await register(display || clerkDisplayName(user), avatarId, { clerkToken });
        const session = { ...s, avatarId: s.avatarId ?? avatarId };
        setSession(session);
        localStorage.setItem('felt-session', JSON.stringify(session));
        saveAvatarId(session.avatarId);
      } catch {
        /* friends panel stays hidden until register succeeds */
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- register once when signed in
  }, [isLoaded, isSignedIn, sessionUserId, user]);

  useEffect(() => {
    const maxBots = Math.max(0, maxSeats - 1);
    if (botCount > maxBots) setBotCount(maxBots);
  }, [maxSeats, botCount]);

  function pickAvatar(id: number) {
    setAvatarId(id);
    saveAvatarId(id);
  }

  async function ensureSession(displayName: string) {
    if (!isSignedIn) throw new Error('Sign in required for online play');
    const clerkToken = await getToken();
    if (!clerkToken) throw new Error('Sign in required for online play');
    const s = await register(displayName.trim() || clerkDisplayName(user), avatarId, {
      clerkToken,
    });
    const session = { ...s, avatarId: s.avatarId ?? avatarId };
    setSession(session);
    localStorage.setItem('felt-session', JSON.stringify(session));
    saveAvatarId(session.avatarId);
    return session;
  }

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!isSignedIn) {
      setError('Sign in to host an online table');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const session = await ensureSession(name.trim() || clerkDisplayName(user));
      const clerkToken = await getToken();
      const table = await createTable(
        {
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
        },
        { clerkToken },
      );
      router.push(`/table/${table.tableId}?invite=${table.inviteCode}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    } finally {
      setBusy(false);
    }
  }

  async function enterInvite(mode: 'play' | 'spectate') {
    if (!isSignedIn) {
      setError('Sign in to join an online table');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await ensureSession(name.trim() || clerkDisplayName(user));
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

  const maxBots = Math.max(0, maxSeats - 1);

  function onOffline(e: React.FormEvent) {
    e.preventDefault();
    const display = encodeURIComponent(name.trim() || clerkDisplayName(user) || 'Player');
    router.push(`/offline?name=${display}&seats=${offlineSeats}`);
  }

  const onlineLocked = isLoaded && !isSignedIn;

  return (
    <div className="relative mx-auto w-full max-w-5xl px-1 sm:px-0 pt-4 sm:pt-8 pb-8">
      <div className="pointer-events-none absolute -top-6 left-1/2 h-40 w-[24rem] -translate-x-1/2 rounded-full bg-gold/10 blur-3xl" />

      <div className="relative text-center">
        <p className="status-chip border-gold/30 bg-gold/10 text-gold mx-auto w-fit mb-3">
          Casino night · private tables
        </p>
        <h1 className="font-display text-5xl sm:text-6xl font-extrabold tracking-[0.06em] text-transparent bg-clip-text bg-gradient-to-br from-gold-light via-gold to-gold-dim uppercase leading-none">
          Felt
        </h1>
        <p className="mt-3 mx-auto max-w-xl text-cream/65 text-base sm:text-lg font-medium tracking-wide leading-relaxed">
          Drop into No-Limit Texas Hold&apos;em. Host a private table, join or spectate with a code, or
          grind offline vs bots.
        </p>
      </div>

      {onlineLocked && (
        <div className="mt-6 hud-panel mx-auto max-w-xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
          <p className="text-sm text-cream/70 font-medium">
            Sign in with Clerk to host or join online tables. Offline play stays open to everyone.
          </p>
          <div className="flex gap-2 shrink-0">
            <SignInButton mode="modal">
              <button type="button" className="btn-ghost text-xs py-1.5 px-3">
                Sign in
              </button>
            </SignInButton>
            <SignUpButton mode="modal">
              <button type="button" className="btn-primary text-xs py-1.5 px-3">
                Sign up
              </button>
            </SignUpButton>
          </div>
        </div>
      )}

      <div className="mt-6 hud-panel mx-auto max-w-xl p-4 sm:p-5">
        <AvatarPicker value={avatarId} onChange={pickAvatar} />
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 sm:gap-5 sm:items-stretch">
        <form
          onSubmit={onCreate}
          className="hud-panel flex h-full flex-col gap-3.5 p-5 sm:p-6"
        >
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-display text-xl font-bold uppercase tracking-wider text-gold">Host</h2>
            <span className="text-[10px] font-display uppercase tracking-[0.2em] text-cyan/70">Online</span>
          </div>
          <label className="block">
            <span className="hud-label">Callsign</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="hud-input"
              required
              maxLength={32}
              disabled={onlineLocked}
            />
          </label>
          <label className="block">
            <span className="hud-label">Seats</span>
            <select
              value={maxSeats}
              onChange={(e) => setMaxSeats(Number(e.target.value))}
              className="field-select mt-1"
              disabled={onlineLocked}
            >
              {[2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                <option key={n} value={n}>
                  {n} seats
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="hud-label">Starting bots</span>
            <select
              value={botCount}
              onChange={(e) => setBotCount(Number(e.target.value))}
              className="field-select mt-1"
              disabled={onlineLocked}
            >
              {Array.from({ length: maxBots + 1 }, (_, n) => (
                <option key={n} value={n}>
                  {n === 0 ? 'None' : `${n} bot${n === 1 ? '' : 's'}`}
                </option>
              ))}
            </select>
          </label>
          <button disabled={busy || onlineLocked} type="submit" className="btn-primary mt-auto w-full">
            Create private table
          </button>
        </form>

        <form onSubmit={onJoin} className="hud-panel flex h-full flex-col gap-3.5 p-5 sm:p-6">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-display text-xl font-bold uppercase tracking-wider text-gold">Join</h2>
            <span className="text-[10px] font-display uppercase tracking-[0.2em] text-cyan/70">Invite</span>
          </div>
          <label className="block">
            <span className="hud-label">Callsign</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="hud-input"
              required
              maxLength={32}
              disabled={onlineLocked}
            />
          </label>
          <label className="block">
            <span className="hud-label">Invite code</span>
            <input
              value={invite}
              onChange={(e) => setInvite(e.target.value)}
              className="hud-input font-mono tracking-widest uppercase"
              required
              disabled={onlineLocked}
            />
          </label>
          <div className="mt-auto grid grid-cols-2 gap-2.5 pt-1">
            <button disabled={busy || onlineLocked} type="submit" className="btn-ghost w-full">
              Enter table
            </button>
            <button
              disabled={busy || onlineLocked || !invite.trim()}
              type="button"
              onClick={onSpectate}
              className="rounded border border-cyan/35 bg-cyan/10 px-4 py-2.5 text-sm font-display font-semibold uppercase tracking-wider text-cyan transition hover:bg-cyan/20 disabled:opacity-40"
            >
              Spectate
            </button>
          </div>
        </form>

        {isSignedIn && sessionUserId && (
          <FriendsPanel
            disabled={onlineLocked}
            onNavigateTable={(tableId, inviteCode) => {
              router.push(`/table/${tableId}?invite=${inviteCode}`);
            }}
          />
        )}

        <form
          onSubmit={onOffline}
          className="hud-panel flex flex-col gap-3.5 p-5 sm:col-span-2 sm:p-6"
        >
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
          <div className="grid gap-3.5 sm:grid-cols-2 sm:gap-4">
            <label className="block min-w-0">
              <span className="hud-label">Callsign</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="hud-input"
                required
                maxLength={32}
              />
            </label>
            <label className="block min-w-0">
              <span className="hud-label">Seats</span>
              <select
                value={offlineSeats}
                onChange={(e) => setOfflineSeats(Number(e.target.value))}
                className="field-select mt-1"
              >
                {[2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                  <option key={n} value={n}>
                    {n} seats · {n - 1} bots
                  </option>
                ))}
              </select>
            </label>
          </div>
          <button type="submit" className="btn-ghost w-full sm:w-auto sm:self-start">
            Launch offline game
          </button>
        </form>
      </div>

      {error && (
        <p className="mt-4 status-chip border-red-500/40 bg-red-950/50 text-red-300">{error}</p>
      )}
    </div>
  );
}
