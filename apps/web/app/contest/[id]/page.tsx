'use client';

import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  type ContestView,
  getContest,
  registerContest,
  startContest,
  unregisterContest,
  WS_URL,
} from '@/lib/api';
import { useSession } from '@/lib/store';

function nameOf(contest: ContestView, userId: string | null): string {
  if (!userId) return '—';
  return contest.entrants.find((e) => e.userId === userId)?.name ?? userId.slice(0, 6);
}

export default function ContestPage() {
  const params = useParams();
  const contestId = String(params.id ?? '');
  const router = useRouter();
  const userId = useSession((s) => s.userId);
  const ticket = useSession((s) => s.ticket);
  const [contest, setContest] = useState<ContestView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const navigatedTable = useRef<string | null>(null);

  const load = useCallback(async () => {
    try {
      const { contest: c } = await getContest(contestId);
      setContest(c);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Not found');
    }
  }, [contestId]);

  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), 3000);
    return () => clearInterval(t);
  }, [load]);

  // Live contest_sync over websocket
  useEffect(() => {
    if (!ticket || !contestId) return;
    let ws: WebSocket | null = null;
    let ping: ReturnType<typeof setInterval> | null = null;
    let closed = false;

    const connect = () => {
      if (closed) return;
      ws = new WebSocket(WS_URL);
      ws.onopen = () => ws!.send(JSON.stringify({ type: 'auth', ticket }));
      ws.onmessage = (ev) => {
        const msg = JSON.parse(String(ev.data)) as {
          type: string;
          contest?: ContestView;
          event?: string;
          tableId?: string;
        };
        if (msg.type === 'auth_ok') {
          ws!.send(JSON.stringify({ type: 'join_contest', contestId }));
        } else if (msg.type === 'contest_sync' && msg.contest) {
          setContest(msg.contest as ContestView);
        } else if (msg.type === 'contest_event' && msg.event === 'match_assigned' && msg.tableId) {
          if (navigatedTable.current !== msg.tableId) {
            navigatedTable.current = msg.tableId;
            router.push(`/table/${msg.tableId}?contest=${contestId}`);
          }
        }
      };
      ws.onclose = () => {
        if (!closed) setTimeout(connect, 2000);
      };
      ping = setInterval(() => {
        if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'ping' }));
      }, 20000);
    };
    connect();
    return () => {
      closed = true;
      if (ping) clearInterval(ping);
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'leave_contest', contestId }));
        ws.close();
      }
    };
  }, [ticket, contestId, router]);

  // Auto-navigate when assignment appears via poll
  useEffect(() => {
    if (!contest || !userId) return;
    const a = contest.assignments.find((x) => x.userId === userId);
    if (a?.tableId && navigatedTable.current !== a.tableId) {
      navigatedTable.current = a.tableId;
      router.push(`/table/${a.tableId}?contest=${contestId}`);
    }
  }, [contest, userId, contestId, router]);

  const isHost = contest?.hostUserId === userId;
  const isRegistered = contest?.entrants.some((e) => e.userId === userId);
  const myAssignment = contest?.assignments.find((a) => a.userId === userId);

  const bracketByRound = useMemo(() => {
    if (!contest) return [];
    const maxRound = Math.max(0, ...contest.matches.map((m) => m.round));
    const rounds: ContestView['matches'][] = [];
    for (let r = 0; r <= maxRound; r++) {
      rounds.push(contest.matches.filter((m) => m.round === r).sort((a, b) => a.index - b.index));
    }
    return rounds;
  }, [contest]);

  async function onRegister() {
    if (!userId) {
      setError('Register a callsign from the lobby first');
      return;
    }
    setBusy(true);
    try {
      const { contest: c } = await registerContest(contestId, { userId });
      setContest(c);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    } finally {
      setBusy(false);
    }
  }

  async function onUnregister() {
    if (!userId) return;
    setBusy(true);
    try {
      const { contest: c } = await unregisterContest(contestId, { userId });
      setContest(c);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    } finally {
      setBusy(false);
    }
  }

  async function onStart() {
    if (!userId) return;
    setBusy(true);
    try {
      const { contest: c } = await startContest(contestId, { userId });
      setContest(c);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    } finally {
      setBusy(false);
    }
  }

  if (error && !contest) {
    return (
      <div className="mx-auto max-w-lg px-4 py-12 text-center">
        <p className="text-red-300">{error}</p>
        <button type="button" className="btn-ghost mt-4" onClick={() => router.push('/')}>
          Back to lobby
        </button>
      </div>
    );
  }

  if (!contest) {
    return (
      <div className="mx-auto max-w-lg px-4 py-12 text-center text-cream/50">Loading contest…</div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-3 py-6 sm:px-4 sm:py-10">
      <button
        type="button"
        onClick={() => router.push('/')}
        className="text-xs font-display uppercase tracking-wider text-cyan/70 hover:text-cyan"
      >
        ← Lobby
      </button>

      <header className="mt-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="status-chip border-gold/30 bg-gold/10 text-gold w-fit">
            {contest.mode === 'knockout' ? 'Knockout' : 'Table match'} · {contest.status}
          </p>
          <h1 className="mt-2 font-display text-3xl font-bold text-gold uppercase tracking-wide">
            {contest.name}
          </h1>
          <p className="mt-1 text-sm text-cream/50">
            Code <span className="font-mono text-cream/80 tracking-widest">{contest.inviteCode}</span>
            {' · '}
            {contest.entrants.length}/{contest.fieldSize} · stack {contest.startingStack} · blinds{' '}
            {contest.blinds
              ? `${contest.blinds.smallBlind}/${contest.blinds.bigBlind}`
              : `${contest.smallBlind}/${contest.bigBlind}`}
          </p>
        </div>
        {myAssignment?.tableId && contest.status === 'running' && (
          <button
            type="button"
            className="btn-primary"
            onClick={() => router.push(`/table/${myAssignment.tableId}?contest=${contestId}`)}
          >
            Go to table
          </button>
        )}
      </header>

      {contest.status === 'registering' && (
        <div className="mt-6 flex flex-wrap gap-2">
          {!isRegistered && (
            <button disabled={busy} type="button" className="btn-primary" onClick={onRegister}>
              Register
            </button>
          )}
          {isRegistered && !isHost && (
            <button disabled={busy} type="button" className="btn-ghost" onClick={onUnregister}>
              Unregister
            </button>
          )}
          {isHost && (
            <button disabled={busy} type="button" className="btn-primary" onClick={onStart}>
              Start now
            </button>
          )}
        </div>
      )}

      <section className="hud-panel mt-6 p-4 sm:p-5">
        <h2 className="font-display text-sm font-bold uppercase tracking-wider text-cream/70">
          Entrants
        </h2>
        <ul className="mt-3 grid gap-1.5 sm:grid-cols-2">
          {contest.entrants.map((e) => (
            <li
              key={e.userId}
              className="flex items-center justify-between rounded-md border border-cream/10 px-3 py-2 text-sm"
            >
              <span>
                {e.name}
                {e.isBot ? (
                  <span className="ml-1.5 text-[10px] uppercase text-cyan/60">bot</span>
                ) : null}
                {e.userId === contest.hostUserId ? (
                  <span className="ml-1.5 text-[10px] uppercase text-gold/70">host</span>
                ) : null}
              </span>
              {contest.placements.find((p) => p.userId === e.userId) && (
                <span className="text-xs text-gold">
                  #{contest.placements.find((p) => p.userId === e.userId)!.place}
                </span>
              )}
            </li>
          ))}
        </ul>
      </section>

      {contest.mode === 'knockout' && contest.matches.length > 0 && (
        <section className="hud-panel mt-4 p-4 sm:p-5">
          <h2 className="font-display text-sm font-bold uppercase tracking-wider text-cream/70">
            Bracket
          </h2>
          <div className="mt-3 space-y-4">
            {bracketByRound.map((round, ri) => (
              <div key={ri}>
                <p className="text-[10px] font-display uppercase tracking-widest text-cream/40">
                  Round {ri + 1}
                </p>
                <ul className="mt-1.5 space-y-1.5">
                  {round.map((m) => (
                    <li
                      key={m.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-cream/10 px-3 py-2 text-sm"
                    >
                      <span>
                        {nameOf(contest, m.playerA)} vs {nameOf(contest, m.playerB)}
                      </span>
                      <span className="text-xs text-cream/45">
                        {m.status}
                        {m.winnerId ? ` · ${nameOf(contest, m.winnerId)} wins` : ''}
                        {m.tableId && m.status === 'active' ? (
                          <button
                            type="button"
                            className="ml-2 text-cyan underline"
                            onClick={() =>
                              router.push(`/table/${m.tableId}?contest=${contestId}`)
                            }
                          >
                            Table
                          </button>
                        ) : null}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      )}

      {contest.placements.length > 0 && (
        <section className="hud-panel mt-4 p-4 sm:p-5">
          <h2 className="font-display text-sm font-bold uppercase tracking-wider text-cream/70">
            Standings
          </h2>
          <ol className="mt-3 space-y-1">
            {[...contest.placements]
              .sort((a, b) => a.place - b.place)
              .map((p) => (
                <li key={p.userId} className="flex justify-between text-sm">
                  <span>
                    <span className="text-gold font-mono mr-2">#{p.place}</span>
                    {p.name}
                  </span>
                </li>
              ))}
          </ol>
        </section>
      )}

      {error && (
        <p role="alert" className="mt-4 text-sm text-red-300">
          {error}
        </p>
      )}
    </div>
  );
}
