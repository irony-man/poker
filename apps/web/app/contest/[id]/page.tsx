'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import {
  type ContestView,
  getContest,
  inviteContestFriends,
  registerContest,
  startContest,
  unregisterContest,
} from '@/lib/api';
import { FriendInvitePicker } from '@/components/FriendInvitePicker';
import { MoneyAmount } from '@/components/CurrencyIcon';
import { LoadingScreen } from '@/components/LoadingScreen';
import { enterMobileFullscreen } from '@/lib/mobileFullscreen';
import { contestModeLabel } from '@/lib/contestLabels';
import { useSession } from '@/lib/store';
import { useContestSocket } from '@/lib/ws';

function modeDescription(contest: ContestView): string {
  if (contest.mode === 'rounds') {
    const limit = contest.handLimit ?? 20;
    return `Play ${limit} hands with top-ups. Highest stack when the session ends wins.`;
  }
  return 'Equal stacks, no top-ups. Last player standing wins.';
}

function statusLabel(status: ContestView['status']): string {
  switch (status) {
    case 'registering':
      return 'Registering';
    case 'running':
      return 'Running';
    case 'completed':
      return 'Completed';
    case 'cancelled':
      return 'Cancelled';
    default:
      return status;
  }
}

export default function ContestPage() {
  const params = useParams();
  const contestId = String(params.id ?? '');
  const router = useRouter();
  const userId = useSession((s) => s.userId);
  const ticket = useSession((s) => s.ticket);
  const sessionToken = useSession((s) => s.sessionToken);
  const setSession = useSession((s) => s.setSession);
  const liveContest = useSession((s) => s.contestById[contestId] ?? null);
  const contestEvent = useSession((s) => s.contestEvent);
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

  // One-shot REST bootstrap before/while WS connects (cold load + unauth).
  useEffect(() => {
    let cancelled = false;
    void getContest(contestId)
      .then(({ contest: c }) => {
        if (!cancelled) {
          setContest(c);
          setError(null);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Not found');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [contestId]);

  useContestSocket(ticket ? contestId : null);

  useEffect(() => {
    if (liveContest) setContest(liveContest);
  }, [liveContest]);

  useEffect(() => {
    if (!contestEvent || contestEvent.contestId !== contestId) return;
    if (contestEvent.event === 'match_assigned' && contestEvent.tableId) {
      if (navigatedTable.current !== contestEvent.tableId) {
        navigatedTable.current = contestEvent.tableId;
        enterMobileFullscreen();
        router.push(`/table/${contestEvent.tableId}?contest=${contestId}`);
      }
    } else if (contestEvent.event === 'contest_completed') {
      navigatedTable.current = null;
    }
  }, [contestEvent, contestId, router]);

  // Auto-navigate when assignment appears via sync (only while contest is live)
  useEffect(() => {
    if (!contest || !userId || contest.status !== 'running') return;
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
      <div className="lobby-fade-up mx-auto max-w-lg py-12 text-center">
        <p className="text-danger">{error}</p>
        <Link
          href="/contests"
          className="btn-ghost mt-4 inline-flex min-h-10 items-center justify-center px-5 text-xs"
        >
          Back to contests
        </Link>
      </div>
    );
  }

  if (!contest) {
    return <LoadingScreen label="Loading contest…" />;
  }

  const seatsLabel = `${contest.entrants.length}/${contest.fieldSize} max`;
  const blinds = contest.blinds
    ? `${contest.blinds.smallBlind}/${contest.blinds.bigBlind}`
    : `${contest.smallBlind}/${contest.bigBlind}`;
  const handMeta =
    contest.mode === 'rounds' && contest.handLimit
      ? ` · hand ${Math.min(contest.handsPlayed, contest.handLimit)}/${contest.handLimit}`
      : '';

  return (
    <div className="lobby-fade-up mx-auto w-full max-w-3xl">
      <Link
        href="/contests"
        className="inline-flex items-center gap-1.5 text-xs font-display font-semibold uppercase tracking-[0.14em] text-ink-strong-muted transition hover:text-sidebar"
      >
        <span aria-hidden>←</span> Contests
      </Link>

      <header className="mt-4 w-full sm:mt-5">
        <p className="status-chip w-fit border-sidebar/18 bg-sidebar/6 text-sidebar">
          {contestModeLabel(contest.mode)} · {statusLabel(contest.status)}
        </p>
        <h1 className="mt-3 font-display text-3xl font-bold tracking-tight text-ink-strong sm:text-4xl">
          {contest.name}
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-strong-muted sm:text-base">
          Code{' '}
          <span className="font-mono font-semibold tracking-widest text-ink-strong">
            {contest.inviteCode}
          </span>
          {' · '}
          {seatsLabel} · stack {contest.startingStack} · blinds {blinds}
          {handMeta}
        </p>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-strong-muted sm:text-base">
          {modeDescription(contest)}
        </p>
      </header>

      {error && (
        <p
          role="alert"
          className="mt-4 status-chip border-danger/30 bg-danger/10 text-danger text-xs"
        >
          {error}
        </p>
      )}

      {(contest.status === 'registering' ||
        (myAssignment?.tableId && contest.status === 'running')) && (
        <div className="mt-5 flex flex-wrap gap-2.5">
          {contest.status === 'registering' && !isRegistered && (
            <button
              disabled={busy}
              type="button"
              className="btn-primary min-h-11 px-6"
              onClick={onRegister}
            >
              Register
            </button>
          )}
          {contest.status === 'registering' && isRegistered && !isHost && (
            <button
              disabled={busy}
              type="button"
              className="btn-ghost min-h-11 px-6"
              onClick={onUnregister}
            >
              Unregister
            </button>
          )}
          {contest.status === 'registering' && isHost && (
            <button
              disabled={busy}
              type="button"
              className="btn-primary min-h-11 px-6"
              onClick={onStart}
            >
              Start now
            </button>
          )}
          {myAssignment?.tableId && contest.status === 'running' && (
            <button
              type="button"
              className="btn-primary min-h-11 px-6"
              onClick={() => {
                enterMobileFullscreen();
                router.push(`/table/${myAssignment.tableId}?contest=${contestId}`);
              }}
            >
              Go to table
            </button>
          )}
        </div>
      )}

      <section className="hud-panel mt-6 p-5 sm:p-6">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="hud-label">Entrants</h2>
          <span className="text-xs font-medium tabular text-ink-strong-muted">{seatsLabel}</span>
        </div>
        {contest.entrants.length === 0 ? (
          <p className="mt-3 text-sm text-ink-strong-muted">No one registered yet.</p>
        ) : (
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {contest.entrants.map((e) => {
              const place = contest.placements.find((p) => p.userId === e.userId)?.place;
              return (
                <li
                  key={e.userId}
                  className="flex items-center justify-between gap-2 rounded-xl border border-sidebar/12 bg-mushroom/55 px-3 py-2.5"
                >
                  <span className="min-w-0 truncate text-sm font-medium text-ink-strong">
                    {e.name}
                    {e.isBot ? (
                      <span className="ml-1.5 text-[10px] font-display font-semibold uppercase tracking-wide text-ink-strong-muted">
                        bot
                      </span>
                    ) : null}
                    {e.userId === contest.hostUserId ? (
                      <span className="ml-1.5 text-[10px] font-display font-semibold uppercase tracking-wide text-sidebar/70">
                        host
                      </span>
                    ) : null}
                  </span>
                  {place != null && (
                    <span className="shrink-0 font-mono text-xs font-semibold text-sidebar">
                      #{place}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {contest.status === 'registering' && isHost && sessionToken && (
        <section className="hud-panel mt-4 flex flex-col gap-3 p-5 sm:p-6">
          <FriendInvitePicker
            sessionToken={sessionToken}
            selectedIds={inviteFriendIds}
            onChange={setInviteFriendIds}
            disabled={busy}
            excludeUserIds={contest.entrants.map((e) => e.userId)}
            maxSelect={Math.min(8, Math.max(0, contest.fieldSize - contest.entrants.length))}
            title="Invite friends"
            help="Send a contest invite. Friends already seated are hidden. Empty seats can fill with bots when you start."
          />
          {inviteToast && (
            <p className="text-sm font-medium text-sidebar" role="status">
              {inviteToast}
            </p>
          )}
          <button
            type="button"
            disabled={busy || inviteFriendIds.length === 0}
            onClick={() => void onInviteFriends()}
            className="btn-primary min-h-10 w-full sm:w-auto sm:min-w-[12rem]"
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
        <section className="hud-panel mt-6 p-5 sm:p-6">
          <h2 className="hud-label">Progress</h2>
          <p className="mt-2 text-sm font-medium text-ink-strong">
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
        </section>
      )}

      {contest.placements.length > 0 && (
        <section className="hud-panel mt-4 p-5 sm:p-6">
          <h2 className="hud-label">Standings</h2>
          <ol className="mt-3 space-y-1.5">
            {[...contest.placements]
              .sort((a, b) => a.place - b.place)
              .map((p) => (
                <li
                  key={p.userId}
                  className="flex items-center justify-between gap-2 rounded-xl border border-sidebar/12 bg-mushroom/55 px-3 py-2 text-sm"
                >
                  <span className="min-w-0 truncate font-medium text-ink-strong">{p.name}</span>
                  <span className="flex shrink-0 items-center gap-2 font-mono text-xs font-semibold text-sidebar">
                    {(p.prizeWhuffies ?? 0) > 0 ? (
                      <span className="text-brass-dim">
                        +{(p.prizeWhuffies ?? 0).toLocaleString()} Whuffies
                      </span>
                    ) : null}
                    <span>#{p.place}</span>
                  </span>
                </li>
              ))}
          </ol>
        </section>
      )}
    </div>
  );
}
