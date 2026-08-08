'use client';

import { useEffect, useState } from 'react';
import {
  type ContestMode,
  type ContestView,
  createContest,
  listPublicContests,
} from '@/lib/api';
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
    label: 'Chips',
    title: 'Chip freezeout',
    body: 'Equal start stack for everyone. No top-ups once play begins.',
    points: [
      'Same chips for every seat at the start',
      'Bust out and you\'re eliminated',
      'Last player with chips — the chip leader — wins',
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
      'Highest stack ranks first when hands finish',
    ],
  },
];

function fieldBlurb(fieldSize: number): string {
  if (fieldSize === 2) return 'Heads-up table';
  return `${fieldSize}-handed table`;
}

function handsBlurb(handLimit: number): string {
  return `${handLimit} hands, then standings by stack`;
}

function modeLabel(mode: ContestMode): string {
  return mode === 'rounds' ? 'Rounds' : 'Chips';
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
  const [mode, setMode] = useState<ContestMode>('chips');
  const [fieldSize, setFieldSize] = useState(6);
  const [handLimit, setHandLimit] = useState(20);
  const [inviteFriendIds, setInviteFriendIds] = useState<string[]>([]);
  const [invite, setInvite] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<ContestView[]>([]);

  const maxFriendInvites = Math.min(8, Math.max(0, fieldSize - 1));

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
          botCount: 0,
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
      ? `Start ${fieldSize}-handed · ${handLimit} hands`
      : `Start ${fieldSize}-handed freezeout`;
  const submitLabel =
    inviteFriendIds.length > 0
      ? `${ctaLabel} · invite ${inviteFriendIds.length}`
      : ctaLabel;

  return (
    <LobbySplitCard imageSrc="/home-knockout.png" imageAlt="Multi-seat tournament table ready to fill">
      <header className="min-w-0">
        <p className="font-display text-[0.68rem] font-bold uppercase tracking-[0.18em] text-ink-strong/45">
          Competitive play
        </p>
        <h2 className="mt-1.5 font-display text-2xl font-bold leading-tight tracking-tight text-ink-strong sm:text-[1.7rem]">
          Host a contest
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-ink-strong-muted">
          Invite friends with a code, fill seats, and start when you&apos;re ready.
        </p>
      </header>

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
            label="Table size"
            name="contest-size"
            selected={fieldSize}
            options={[...TABLE_SIZES]}
            onSelect={setFieldSize}
            format={(n) => String(n)}
          />
          <p className="field-help mt-2.5">{fieldBlurb(fieldSize)}</p>
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

        <FriendInvitePicker
          sessionToken={sessionToken}
          selectedIds={inviteFriendIds}
          onChange={setInviteFriendIds}
          disabled={disabled || busy}
          maxSelect={Math.max(0, maxFriendInvites)}
          title="Invite friends"
          help="They get a contest invite in Friends. You can also share the code."
        />

        <div>
          <button
            disabled={disabled || busy}
            type="submit"
            className="btn-primary min-h-11 w-full sm:w-auto sm:min-w-[14rem]"
          >
            {busy ? 'Starting…' : submitLabel}
          </button>
          <p className="field-help mt-2.5">
            Share the contest code after you create it
          </p>
        </div>
      </form>

      <div
        className="border-t border-sidebar/10 pt-5"
        role="group"
        aria-label="Join with a code"
      >
        <p className="font-display text-[0.68rem] font-bold uppercase tracking-[0.18em] text-ink-strong/45">
          Or join with a code
        </p>
        <form onSubmit={onJoin} className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="block min-w-0 flex-1">
            <span className="hud-label">Contest code</span>
            <input
              value={invite}
              onChange={(e) => setInvite(e.target.value.replace(/\D/g, '').slice(0, 8))}
              className="hud-input font-mono tracking-[0.2em]"
              inputMode="numeric"
              maxLength={8}
              placeholder="••••"
              autoComplete="off"
            />
            <span className="field-help">4–8 digits from the host</span>
          </label>
          <button
            disabled={disabled || busy || invite.trim().length < 4}
            type="submit"
            className="btn-ghost min-h-11 shrink-0 sm:min-w-[8.5rem]"
          >
            Join
          </button>
        </form>
      </div>

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
