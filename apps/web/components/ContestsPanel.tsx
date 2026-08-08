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

const KNOCKOUT_SIZES = [4, 8, 16] as const;
const TABLE_MATCH_SIZES = [2, 3, 4, 5, 6, 7, 8, 9] as const;

function modeBlurb(mode: ContestMode): string {
  return mode === 'knockout'
    ? "Bracket play — lose a table and you're out."
    : 'One table — last stack standing takes it.';
}

function fieldBlurb(mode: ContestMode, fieldSize: number): string {
  if (mode === 'knockout') {
    return `${fieldSize}-player field · fixed bracket`;
  }
  if (fieldSize === 2) return 'Heads-up table match';
  return `${fieldSize}-handed · chip-elimination match`;
}

function botsBlurb(botCount: number, fieldSize: number): string {
  if (botCount === 0) return 'All seats open for humans';
  const humanSlots = fieldSize - botCount;
  if (humanSlots <= 1) return `${botCount} bots · just you + filler`;
  return `${botCount} bots · ${humanSlots} open seats for people`;
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
  const [mode, setMode] = useState<ContestMode>('table_match');
  const [fieldSize, setFieldSize] = useState(6);
  const [botCount, setBotCount] = useState(3);
  const [invite, setInvite] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<ContestView[]>([]);

  const sizes: readonly number[] = mode === 'knockout' ? KNOCKOUT_SIZES : TABLE_MATCH_SIZES;
  const maxBots = Math.max(0, fieldSize - 1);

  useEffect(() => {
    if (!sizes.includes(fieldSize)) {
      setFieldSize(sizes[0]!);
    }
  }, [mode, fieldSize, sizes]);

  useEffect(() => {
    if (botCount > maxBots) setBotCount(maxBots);
  }, [maxBots, botCount]);

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
          name: `${session.name}'s ${mode === 'knockout' ? 'Knockout' : 'Table Match'}`,
          mode,
          fieldSize,
          startingStack: 1000,
          smallBlind: 5,
          bigBlind: 10,
          botCount,
          isPrivate: true,
          autoStart: true,
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
    mode === 'knockout' ? `Start ${fieldSize}-player knockout` : `Start ${fieldSize}-handed match`;

  return (
    <LobbySplitCard imageSrc="/home-knockout.png" imageAlt="Multi-seat tournament table ready to fill">
      <header className="min-w-0">
        <p className="font-display text-[0.68rem] font-bold uppercase tracking-[0.18em] text-ink-strong/45">
          Competitive play
        </p>
        <h2 className="mt-1.5 font-display text-2xl font-bold leading-tight tracking-tight text-ink-strong sm:text-[1.7rem]">
          Host a contest
        </h2>
        <p className="mt-2 max-w-sm text-sm leading-relaxed text-ink-strong-muted">
          Invite friends with a code, or fill empty seats with bots and start when you&apos;re ready.
        </p>
      </header>

      <form onSubmit={onCreate} className="flex flex-col gap-5">
        <div className="min-w-0">
          <ChoiceRow
            label="Format"
            name="contest-mode"
            selected={mode}
            options={['table_match', 'knockout'] as const}
            onSelect={(m) => setMode(m)}
            format={(m) => (m === 'knockout' ? 'Knockout' : 'Table match')}
          />
          <p className="field-help mt-2.5">{modeBlurb(mode)}</p>
        </div>

        <div className="min-w-0">
          <ChoiceRow
            label={mode === 'knockout' ? 'Field size' : 'Table size'}
            name="contest-size"
            selected={fieldSize}
            options={[...sizes]}
            onSelect={setFieldSize}
            format={(n) => String(n)}
          />
          <p className="field-help mt-2.5">{fieldBlurb(mode, fieldSize)}</p>
        </div>

        <div className="min-w-0">
          <ChoiceRow
            label="Seat bots"
            name="contest-bots"
            selected={botCount}
            options={Array.from({ length: maxBots + 1 }, (_, n) => n)}
            onSelect={setBotCount}
            format={(n) => (n === 0 ? 'None' : String(n))}
          />
          <p className="field-help mt-2.5">{botsBlurb(botCount, fieldSize)}</p>
        </div>

        <div>
          <button
            disabled={disabled || busy}
            type="submit"
            className="btn-primary min-h-11 w-full sm:w-auto sm:min-w-[14rem]"
          >
            {busy ? 'Starting…' : ctaLabel}
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
                    {c.mode === 'knockout' ? 'Knockout' : 'Match'} · {c.entrants.length}/{c.fieldSize}
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
          className="status-chip border-danger/30 bg-danger/10 text-danger text-xs"
        >
          {error}
        </p>
      )}
    </LobbySplitCard>
  );
}
