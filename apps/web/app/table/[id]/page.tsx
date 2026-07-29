'use client';

import { useParams, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useRef, useState } from 'react';
import { TableView } from '@/components/TableView';
import { register } from '@/lib/api';
import { loadSavedAvatarId, saveAvatarId } from '@/lib/avatars';
import { useSession } from '@/lib/store';

function TablePageInner() {
  const params = useParams<{ id: string }>();
  const search = useSearchParams();
  const invite = search.get('invite');
  const spectate = search.get('mode') === 'spectate';
  const setSession = useSession((s) => s.setSession);
  const clearTable = useSession((s) => s.clearTable);
  const sessionUserId = useSession((s) => s.userId);
  const tableId = params.id;
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [callsign, setCallsign] = useState('');
  /** null = checking storage; true = show form; false = have name */
  const [needsCallsign, setNeedsCallsign] = useState<boolean | null>(null);
  const [booting, setBooting] = useState(false);
  const bootedFor = useRef<string | null>(null);

  useEffect(() => {
    clearTable();
    bootedFor.current = null;
  }, [tableId, clearTable]);

  useEffect(() => {
    const raw = localStorage.getItem('felt-session');
    if (raw) {
      try {
        const prev = JSON.parse(raw) as { name?: string };
        if (prev.name?.trim()) {
          setCallsign(prev.name.trim());
          setNeedsCallsign(false);
          return;
        }
      } catch {
        /* ignore */
      }
    }
    setNeedsCallsign(true);
  }, []);

  async function bootWithName(displayName: string) {
    const key = `${tableId}:${displayName}`;
    if (bootedFor.current === key) return;
    bootedFor.current = key;

    setBooting(true);
    setReady(false);
    setError(null);
    try {
      const raw = localStorage.getItem('felt-session');
      let existingUserId: string | undefined;
      let avatarId = loadSavedAvatarId();
      if (raw) {
        try {
          const prev = JSON.parse(raw) as { userId?: string; avatarId?: number };
          if (prev.userId) existingUserId = prev.userId;
          if (typeof prev.avatarId === 'number') avatarId = prev.avatarId;
        } catch {
          /* ignore */
        }
      }

      const s = await register(displayName.slice(0, 32), avatarId, { userId: existingUserId });
      const session = { ...s, avatarId: s.avatarId ?? avatarId };
      setSession(session);
      localStorage.setItem('felt-session', JSON.stringify(session));
      saveAvatarId(session.avatarId);
      setNeedsCallsign(false);
      setReady(true);
    } catch (err) {
      bootedFor.current = null;
      setReady(false);
      setError(err instanceof Error ? err.message : 'Failed to connect');
    } finally {
      setBooting(false);
    }
  }

  useEffect(() => {
    if (needsCallsign !== false) return;
    const trimmed = callsign.trim();
    if (!trimmed) {
      setNeedsCallsign(true);
      return;
    }
    void bootWithName(trimmed);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tableId, needsCallsign, callsign]);

  if (needsCallsign === null) {
    return <p className="text-cream/60">Loading…</p>;
  }

  if (needsCallsign) {
    return (
      <form
        className="hud-panel mx-auto max-w-md space-y-4 p-6"
        onSubmit={(e) => {
          e.preventDefault();
          const trimmed = callsign.trim();
          if (!trimmed) {
            setError('Enter a callsign to join');
            return;
          }
          void bootWithName(trimmed);
        }}
      >
        <h2 className="font-display text-xl uppercase tracking-wider text-gold">Join table</h2>
        <p className="text-sm text-cream/60">Pick a callsign — no account needed.</p>
        <label className="block">
          <span className="hud-label">Callsign</span>
          <input
            value={callsign}
            onChange={(e) => setCallsign(e.target.value)}
            className="hud-input"
            required
            maxLength={32}
            autoFocus
            placeholder="Your name at the table"
          />
        </label>
        {error && (
          <p className="status-chip border-red-500/40 bg-red-950/50 text-red-300">{error}</p>
        )}
        <button type="submit" disabled={booting} className="btn-primary w-full">
          {booting ? 'Connecting…' : 'Sit down'}
        </button>
      </form>
    );
  }

  if (error) {
    return <p className="status-chip border-red-500/40 bg-red-950/50 text-red-300">{error}</p>;
  }

  if (!ready || !sessionUserId || booting) {
    return <p className="text-cream/60">Connecting…</p>;
  }

  return <TableView tableId={tableId} inviteCode={invite} initialSpectate={spectate} />;
}

export default function TablePage() {
  return (
    <Suspense fallback={<p className="text-cream/60">Loading table…</p>}>
      <TablePageInner />
    </Suspense>
  );
}
