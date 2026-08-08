'use client';

import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  type ContestView,
  getContest,
  inviteContestFriends,
  registerContest,
  startContest,
  unregisterContest,
  WS_URL,
} from '@/lib/api';
import { FriendInvitePicker } from '@/components/FriendInvitePicker';
import { enterMobileFullscreen } from '@/lib/mobileFullscreen';
import { useSession } from '@/lib/store';

function modeLabel(mode: ContestView['mode']): string {
  return mode === 'rounds' ? 'Rounds' : 'Chips';
}

function modeDescription(contest: ContestView): string {
  if (contest.mode === 'rounds') {
    const limit = contest.handLimit ?? 20;
    return `Play ${limit} hands with top-ups. Highest stack when the session ends wins.`;
  }
  return 'Equal stacks, no top-ups. Last player with chips wins.';
}

export default function ContestPage() {
  const params = useParams();
  const contestId = String(params.id ?? '');
  const router = useRouter();
  const userId = useSession((s) => s.userId);
  const ticket = useSession((s) => s.ticket);
  const sessionToken = useSession((s) => s.sessionToken);
  const setSession = useSession((s) => s.setSession);
  const [contest, setContest] = useState<ContestView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [inviteFriendIds, setInviteFriendIds] = useState<string[]>([]);
  const [inviteToast, setInviteToast] = useState<string | null>(null);
  const navigatedTable = useRef<string | null>(null);

  useEffect(() => {
    if (sessionToken && ticket) return;
    const raw = localStorage.getItem('felt-session');
    if (!raw) return;
    try {
      const s = JSON.parse(raw) as {
        userId: string;
        name: string;
        ticket: string;
        sessionToken?: string;
        username?: string;
      };
      if (s.userId && s.ticket) {
        setSession({
          userId: s.userId,
          name: s.name,
          ticket: s.ticket,
          sessionToken: s.sessionToken,
          username: s.username,
        });
      }
    } catch {
      /* ignore */
    }
  }, [sessionToken, ticket, setSession]);

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
            enterMobileFullscreen();
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
      enterMobileFullscreen();
      router.push(`/table/${a.tableId}?contest=${contestId}`);
    }
  }, [contest, userId, contestId, router]);

  const isHost = contest?.hostUserId === userId;
  const isRegistered = contest?.entrants.some((e) => e.userId === userId);
  const myAssignment = contest?.assignments.find((a) => a.userId === userId);

  async function onRegister() {
    if (!sessionToken) {
      setError('Sign in from the lobby first');
      return;
    }
    setBusy(true);
    try {
      const { contest: c } = await registerContest(contestId, { sessionToken });
      setContest(c);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    } finally {
      setBusy(false);
    }
  }

  async function onUnregister() {
    if (!sessionToken) return;
    setBusy(true);
    try {
      const { contest: c } = await unregisterContest(contestId, { sessionToken });
      setContest(c);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    } finally {
      setBusy(false);
    }
  }

  async function onStart() {
    if (!sessionToken) return;
    setBusy(true);
    try {
      const { contest: c } = await startContest(contestId, { sessionToken });
      setContest(c);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    } finally {
      setBusy(false);
    }
  }

  async function onInviteFriends() {
    if (!sessionToken || inviteFriendIds.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      const result = await inviteContestFriends(contestId, inviteFriendIds, { sessionToken });
      setInviteFriendIds([]);
      setInviteToast(
        result.inviteCount > 0
          ? `Invited ${result.inviteCount} friend${result.inviteCount === 1 ? '' : 's'}`
          : 'No friends were invited',
      );
      window.setTimeout(() => setInviteToast(null), 3200);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invite failed');
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
      <div className="mx-auto max-w-lg px-4 py-12 text-center text-ink-strong-muted">Loading contest…</div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-3 py-6 sm:px-4 sm:py-10">
      <button
        type="button"
        onClick={() => router.push('/')}
        className="text-xs font-display uppercase tracking-wider text-sidebar/70 hover:text-sidebar"
      >
        ← Lobby
      </button>

      <header className="mt-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="status-chip border-sidebar/25 bg-sidebar/8 text-sidebar w-fit">
            {modeLabel(contest.mode)} · {contest.status}
          </p>
          <h1 className="mt-2 font-display text-3xl font-bold text-sidebar uppercase tracking-wide">
            {contest.name}
          </h1>
          <p className="mt-1 text-sm text-ink-strong-muted">
            Code <span className="font-mono text-ink-strong tracking-widest">{contest.inviteCode}</span>
            {' · '}
            {contest.entrants.length}/{contest.fieldSize} · stack {contest.startingStack} · blinds{' '}
            {contest.blinds
              ? `${contest.blinds.smallBlind}/${contest.blinds.bigBlind}`
              : `${contest.smallBlind}/${contest.bigBlind}`}
            {contest.mode === 'rounds' && contest.handLimit
              ? ` · hand ${Math.min(contest.handsPlayed, contest.handLimit)}/${contest.handLimit}`
              : ''}
          </p>
          <p className="mt-2 max-w-lg text-sm text-ink-strong-muted">{modeDescription(contest)}</p>
        </div>
        {myAssignment?.tableId && contest.status === 'running' && (
          <button
            type="button"
            className="btn-primary"
            onClick={() => {
              enterMobileFullscreen();
              router.push(`/table/${myAssignment.tableId}?contest=${contestId}`);
            }}
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

      {contest.status === 'registering' && isHost && sessionToken && (
        <section className="hud-panel mt-6 p-4 sm:p-5">
          <FriendInvitePicker
            sessionToken={sessionToken}
            selectedIds={inviteFriendIds}
            onChange={setInviteFriendIds}
            disabled={busy}
            maxSelect={Math.min(
              8,
              Math.max(0, contest.fieldSize - contest.entrants.length),
            )}
            title="Invite friends"
            help="Send a contest invite. Friends can accept from Friends → Invites."
          />
          {inviteToast && (
            <p className="mt-2 text-sm text-sidebar" role="status">
              {inviteToast}
            </p>
          )}
          <button
            type="button"
            disabled={busy || inviteFriendIds.length === 0}
            onClick={() => void onInviteFriends()}
            className="btn-primary mt-3 min-h-10 w-full sm:w-auto"
          >
            {busy
              ? 'Sending…'
              : inviteFriendIds.length > 0
                ? `Send ${inviteFriendIds.length} invite${inviteFriendIds.length === 1 ? '' : 's'}`
                : 'Select friends to invite'}
          </button>
        </section>
      )}

      {contest.status === 'running' && contest.mode === 'rounds' && contest.handLimit && (
        <div className="hud-panel mt-6 p-4 sm:p-5">
          <h2 className="font-display text-sm font-bold uppercase tracking-wider text-sidebar">
            Progress
          </h2>
          <p className="mt-2 text-sm text-ink-strong">
            Hand {Math.min(contest.handsPlayed, contest.handLimit)} of {contest.handLimit}
          </p>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-sidebar/10">
            <div
              className="h-full rounded-full bg-sidebar transition-all duration-500"
              style={{
                width: `${Math.min(100, (contest.handsPlayed / contest.handLimit) * 100)}%`,
              }}
            />
          </div>
        </div>
      )}

      <section className="hud-panel mt-6 p-4 sm:p-5">
        <h2 className="font-display text-sm font-bold uppercase tracking-wider text-sidebar">
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
                  <span className="ml-1.5 text-[10px] uppercase text-ink-strong-muted">bot</span>
                ) : null}
                {e.userId === contest.hostUserId ? (
                  <span className="ml-1.5 text-[10px] uppercase text-brass-light/80">host</span>
                ) : null}
              </span>
              {contest.placements.find((p) => p.userId === e.userId) && (
                <span className="text-xs text-brass-light">
                  #{contest.placements.find((p) => p.userId === e.userId)!.place}
                </span>
              )}
            </li>
          ))}
        </ul>
      </section>

      {contest.placements.length > 0 && (
        <section className="hud-panel mt-4 p-4 sm:p-5">
          <h2 className="font-display text-sm font-bold uppercase tracking-wider text-sidebar">
            Standings
          </h2>
          <ol className="mt-3 space-y-1">
            {[...contest.placements]
              .sort((a, b) => a.place - b.place)
              .map((p) => (
                <li key={p.userId} className="flex justify-between text-sm">
                  <span>
                    <span className="text-brass-light font-mono mr-2">#{p.place}</span>
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
