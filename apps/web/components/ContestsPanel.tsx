'use client';

import { useEffect, useState } from 'react';
import {
  type ContestMode,
  type ContestView,
  createContest,
  listMyContests,
  listPublicContests,
} from '@/lib/api';
import { useSession } from '@/lib/store';
import { LobbySplitCard } from './LobbySplitCard';
import { ChoiceRow } from './ChoiceRow';
import { FriendInvitePicker } from './FriendInvitePicker';

const TABLE_SIZES = [2, 3, 4, 5, 6, 7, 8, 9] as const;
const HAND_LIMITS = [10, 15, 20, 30, 50] as const;

const FORMAT_TABS: {
  id: ContestMode;
  label: string;
  title: string;
  body: string;
  points: string[];
}[] = [
  {
    id: 'chips',
    label: 'Wuffies',
    title: 'Wuffies freezeout',
    body: 'Equal start stack for everyone. No top-ups once play begins.',
    points: [
      'Same Wuffies for every seat at the start',
      "Bust out and you're eliminated",
      'Last player with Wuffies wins ranking prizes',
    ],
  },
  {
    id: 'rounds',
    label: 'Rounds',
    title: 'Fixed-hand session',
    body: 'Play a set number of hands. Top-ups allowed if you go broke.',
    points: [
      'Top ups between hands when stack is zero',
      'Session ends after the hand limit',
      'Stack rank decides place — win ranking Wuffies',
    ],
  },
];

function sizeBlurb(fieldSize: number): string {
  if (fieldSize === 2) return 'Max 2 seats — heads-up when the contest starts';
  return `Up to ${fieldSize} seats; start with fewer if you fill gaps with bots`;
}

function botsBlurb(botCount: number, fieldSize: number): string {
  if (botCount === 0) {
    return 'Only human players — wait for friends or start when enough have joined';
  }
  if (botCount === 1) {
    return 'If a seat is open when you start, 1 bot joins';
  }
  return `If seats are open when you start, up to ${botCount} bots fill them (max ${fieldSize})`;
}

function handsBlurb(handLimit: number): string {
  return `${handLimit} hands, then standings by stack`;
}

function modeLabel(mode: ContestMode): string {
  return mode === 'rounds' ? 'Rounds' : 'Wuffies';
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

export function ContestsPanel({
  disabled,
  sessionToken,
  displayName,
  onEnsureSession,
  onOpenContest,
  onJoinCode,
}: {
  disabled?: boolean;
  sessionToken: string | null;
  displayName: string;
  onEnsureSession: () => Promise<{ userId: string; name: string; sessionToken: string }>;
  onOpenContest: (contestId: string) => void;
  onJoinCode: (code: string) => Promise<void>;
}) {
  const userId = useSession((s) => s.userId);
  const [mode, setMode] = useState<ContestMode>('chips');
  const [fieldSize, setFieldSize] = useState(6);
  const [botCount, setBotCount] = useState(0);
  const [handLimit, setHandLimit] = useState(20);
  const [inviteFriendIds, setInviteFriendIds] = useState<string[]>([]);
  const [invite, setInvite] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<ContestView[]>([]);
  const [joined, setJoined] = useState<ContestView[]>([]);

  const maxBots = Math.max(0, fieldSize - 1);
  const maxFriendInvites = Math.min(8, Math.max(0, fieldSize - 1));
  const moreSummary =
    `${botCount === 0 ? 'No fill bots' : `Up to ${botCount} fill bot${botCount === 1 ? '' : 's'}`}` +
    ` · ${
      inviteFriendIds.length === 0
        ? 'no invites'
        : `${inviteFriendIds.length} invite${inviteFriendIds.length === 1 ? '' : 's'}`
    }`;

  useEffect(() => {
    if (botCount > maxBots) setBotCount(maxBots);
  }, [fieldSize, botCount, maxBots]);

  useEffect(() => {
    if (inviteFriendIds.length > maxFriendInvites) {
      setInviteFriendIds((ids) => ids.slice(0, maxFriendInvites));
    }
  }, [maxFriendInvites, inviteFriendIds.length]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const { contests } = await listPublicContests();
        if (!cancelled) setOpen(contests);
      } catch {
        /* ignore list errors */
      }
    };
    void load();
    const t = setInterval(load, 8000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, []);

  useEffect(() => {
    if (!sessionToken) {
      setJoined([]);
      return;
    }
    let cancelled = false;
    const load = async () => {
      try {
        const { contests } = await listMyContests({ sessionToken });
        if (!cancelled) setJoined(contests);
      } catch {
        if (!cancelled) setJoined([]);
      }
    };
    void load();
    const t = setInterval(load, 8000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [sessionToken]);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!sessionToken && !displayName.trim()) {
      setError('Sign in to host a contest');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const session = await onEnsureSession();
      const { contest } = await createContest(
        {
          name: `${session.name}'s ${modeLabel(mode)} Contest`,
          mode,
          fieldSize,
          startingStack: 1000,
          smallBlind: 5,
          bigBlind: 10,
          botCount,
          isPrivate: true,
          autoStart: true,
          handLimit: mode === 'rounds' ? handLimit : undefined,
          inviteFriendIds,
        },
        session.sessionToken,
      );
      onOpenContest(contest.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    } finally {
      setBusy(false);
    }
  }

  async function onJoin(e: React.FormEvent) {
    e.preventDefault();
    if (!invite.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await onJoinCode(invite.trim());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    } finally {
      setBusy(false);
    }
  }

  const ctaLabel =
    mode === 'rounds'
      ? `Create · max ${fieldSize} · ${handLimit} hands`
      : `Create · max ${fieldSize} freezeout`;
  const submitLabel =
    inviteFriendIds.length > 0
      ? `${ctaLabel} · invite ${inviteFriendIds.length}`
      : ctaLabel;

  return (
    <LobbySplitCard
      imageSrc="/home-knockout.png"
      imageAlt="Multi-seat tournament table ready to fill"
      alignTop
    >
      {joined.length > 0 && (
        <div className="rounded-xl border border-sidebar/12 bg-mushroom/45 p-3.5 sm:p-4">
          <div className="mb-2.5 flex items-baseline justify-between gap-2">
            <p className="font-display text-[0.68rem] font-bold uppercase tracking-[0.18em] text-ink-strong/45">
              Your contests
            </p>
            <span className="text-xs tabular-nums text-ink-strong-muted">{joined.length}</span>
          </div>
          <ul className="max-h-48 space-y-1.5 overflow-y-auto pr-0.5">
            {joined.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  disabled={disabled || busy}
                  onClick={() => onOpenContest(c.id)}
                  className="flex w-full items-center justify-between gap-3 rounded-lg border border-sidebar/10 bg-mushroom/60 px-3 py-2.5 text-left transition hover:border-sidebar/25 hover:bg-sidebar/[0.04] disabled:opacity-50"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-ink-strong">{c.name}</span>
                    <span className="mt-0.5 block text-[11px] text-ink-strong-muted">
                      {statusLabel(c.status)}
                      {userId && c.hostUserId === userId ? ' · host' : ' · joined'}
                    </span>
                  </span>
                  <span className="shrink-0 text-xs tabular-nums text-ink-strong-muted">
                    {modeLabel(c.mode)} · {c.entrants.length}/{c.fieldSize}
                    {c.mode === 'rounds' && c.handLimit ? ` · ${c.handLimit}h` : ''}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <form onSubmit={onCreate} className="flex flex-col gap-5">
        <div className="min-w-0">
          <div
            role="tablist"
            aria-label="Contest format"
            className="flex rounded-xl border border-sidebar/15 bg-mushroom/50 p-1"
          >
            {FORMAT_TABS.map((tab) => {
              const selected = mode === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  id={`contest-format-tab-${tab.id}`}
                  aria-selected={selected}
                  aria-controls={`contest-format-panel-${tab.id}`}
                  disabled={disabled || busy}
                  onClick={() => setMode(tab.id)}
                  className={[
                    'relative min-h-10 flex-1 rounded-lg px-3 py-2 text-center font-display text-xs font-bold uppercase tracking-[0.14em] transition',
                    selected
                      ? 'bg-sidebar text-mushroom shadow-[0_4px_14px_rgb(29_4_50/0.18)]'
                      : 'text-ink-strong-muted hover:bg-sidebar/[0.06] hover:text-sidebar',
                  ].join(' ')}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          {FORMAT_TABS.map((tab) => {
            if (tab.id !== mode) return null;
            return (
              <div
                key={tab.id}
                role="tabpanel"
                id={`contest-format-panel-${tab.id}`}
                aria-labelledby={`contest-format-tab-${tab.id}`}
                className="mt-3 rounded-xl border border-sidebar/10 bg-gradient-to-b from-mushroom/70 to-mushroom/35 px-3.5 py-3.5 sm:px-4"
              >
                <p className="font-display text-sm font-semibold tracking-tight text-ink-strong">
                  {tab.title}
                </p>
                <p className="mt-1 text-sm leading-relaxed text-ink-strong-muted">{tab.body}</p>
                <ul className="mt-3 space-y-1.5">
                  {tab.points.map((point) => (
                    <li
                      key={point}
                      className="flex gap-2 text-xs leading-snug text-ink-strong-muted"
                    >
                      <span
                        className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-sidebar/55"
                        aria-hidden
                      />
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>

        <div className="min-w-0">
          <ChoiceRow
            label="Max table size"
            name="contest-size"
            selected={fieldSize}
            options={[...TABLE_SIZES]}
            onSelect={setFieldSize}
            format={(n) => String(n)}
          />
          <p className="field-help mt-2.5">{sizeBlurb(fieldSize)}</p>
        </div>

        {mode === 'rounds' && (
          <div className="min-w-0">
            <ChoiceRow
              label="Hands"
              name="contest-hands"
              selected={handLimit}
              options={[...HAND_LIMITS]}
              onSelect={setHandLimit}
              format={(n) => String(n)}
            />
            <p className="field-help mt-2.5">{handsBlurb(handLimit)}</p>
          </div>
        )}

        <details className="group rounded-xl border border-sidebar/12 bg-mushroom/40 open:bg-mushroom/55">
          <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2.5 text-sm outline-none marker:content-none [&::-webkit-details-marker]:hidden focus-visible:ring-2 focus-visible:ring-sidebar/30">
            <span className="min-w-0 flex-1">
              <span className="hud-label block">Bots & friends</span>
              <span className="mt-0.5 block text-xs text-ink-strong-muted">{moreSummary}</span>
            </span>
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-4 w-4 shrink-0 text-ink-strong-muted transition-transform duration-200 group-open:rotate-180"
              aria-hidden
            >
              <path d="m6 9 6 6 6-6" />
            </svg>
          </summary>
          <div className="space-y-4 border-t border-sidebar/10 px-3 py-3.5">
            <div className="min-w-0">
              <ChoiceRow
                label="Fill bots if empty"
                name="contest-bots"
                selected={botCount}
                options={Array.from({ length: maxBots + 1 }, (_, n) => n)}
                onSelect={setBotCount}
                format={(n) => (n === 0 ? 'None' : String(n))}
              />
              <p className="field-help mt-2.5">{botsBlurb(botCount, fieldSize)}</p>
            </div>
            <FriendInvitePicker
              sessionToken={sessionToken}
              selectedIds={inviteFriendIds}
              onChange={setInviteFriendIds}
              disabled={disabled || busy}
              maxSelect={Math.max(0, maxFriendInvites)}
              title="Invite friends"
              help="They get a contest invite in Friends. Start later and empty seats can fill with bots."
            />
          </div>
        </details>

        <div>
          <button
            disabled={disabled || busy}
            type="submit"
            className="btn-primary min-h-11 w-full sm:w-auto sm:min-w-[14rem]"
          >
            {busy ? 'Starting…' : submitLabel}
          </button>
          <p className="field-help mt-2.5">
            Share the contest code after you create it. Bots only join when you press Start.
          </p>
        </div>
      </form>


      {open.length > 0 && (
        <div className="border-t border-sidebar/10 pt-5">
          <div className="mb-3 flex items-baseline justify-between gap-2">
            <p className="font-display text-[0.68rem] font-bold uppercase tracking-[0.18em] text-ink-strong/45">
              Open now
            </p>
            <span className="text-xs tabular-nums text-ink-strong-muted">{open.length}</span>
          </div>
          <ul className="max-h-44 space-y-1.5 overflow-y-auto pr-0.5">
            {open.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  disabled={disabled || busy}
                  onClick={() => onOpenContest(c.id)}
                  className="flex w-full items-center justify-between gap-3 rounded-lg border border-sidebar/10 bg-mushroom/40 px-3 py-2.5 text-left transition hover:border-sidebar/25 hover:bg-sidebar/[0.04] disabled:opacity-50"
                >
                  <span className="min-w-0 truncate font-medium text-ink-strong">{c.name}</span>
                  <span className="shrink-0 text-xs tabular-nums text-ink-strong-muted">
                    {modeLabel(c.mode)} · {c.entrants.length}/{c.fieldSize}
                    {c.mode === 'rounds' && c.handLimit ? ` · ${c.handLimit}h` : ''}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {error && (
        <p
          role="alert"
          className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm leading-snug text-danger"
        >
          {error}
        </p>
      )}
    </LobbySplitCard>
  );
}
