'use client';

import { useEffect, useState } from 'react';
import {
  type ContestMode,
  type ContestView,
  createContest,
  listPublicContests,
} from '@/lib/api';
import { ChoiceRow } from './ChoiceRow';

const KNOCKOUT_SIZES = [4, 8, 16] as const;
const TABLE_MATCH_SIZES = [2, 3, 4, 5, 6, 7, 8, 9] as const;

export function ContestsPanel({
  disabled,
  displayName,
  onEnsureSession,
  onOpenContest,
  onJoinCode,
}: {
  disabled?: boolean;
  displayName: string;
  onEnsureSession: (name: string) => Promise<{ userId: string; name: string }>;
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

  const sizes = mode === 'knockout' ? KNOCKOUT_SIZES : TABLE_MATCH_SIZES;
  const maxBots = Math.max(0, fieldSize - 1);

  useEffect(() => {
    if (!sizes.includes(fieldSize as (typeof sizes)[number])) {
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
    if (!displayName.trim()) {
      setError('Enter a callsign to play');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const session = await onEnsureSession(displayName);
      const { contest } = await createContest({
        userId: session.userId,
        name: `${session.name}'s ${mode === 'knockout' ? 'Knockout' : 'Table Match'}`,
        mode,
        fieldSize,
        startingStack: 1000,
        smallBlind: 5,
        bigBlind: 10,
        botCount,
        isPrivate: true,
        autoStart: true,
      });
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

  return (
    <div className="hud-panel flex h-full flex-col gap-3 p-4 sm:gap-3.5 sm:p-6 sm:col-span-2">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="font-display text-xl font-bold uppercase tracking-wider text-gold">
            Contests
          </h2>
          <p className="mt-1 text-sm text-cream/45 font-medium">
            Knockout brackets · table match (chip elimination)
          </p>
        </div>
        <span className="status-chip border-cyan/30 bg-cyan/10 text-cyan shrink-0">Tournament</span>
      </div>

      <form onSubmit={onCreate} className="grid gap-3 sm:grid-cols-2 sm:gap-4">
        <ChoiceRow
          label="Mode"
          name="contest-mode"
          selected={mode}
          options={['table_match', 'knockout'] as const}
          onSelect={(m) => setMode(m)}
          format={(m) => (m === 'knockout' ? 'Knockout' : 'Table match')}
        />
        <ChoiceRow
          label={mode === 'knockout' ? 'Field' : 'Players'}
          name="contest-size"
          selected={fieldSize}
          options={[...sizes]}
          onSelect={setFieldSize}
        />
        <ChoiceRow
          label="Fill bots"
          name="contest-bots"
          selected={botCount}
          options={Array.from({ length: maxBots + 1 }, (_, n) => n)}
          onSelect={setBotCount}
          format={(n) => (n === 0 ? 'None' : String(n))}
        />
        <div className="flex items-end">
          <button
            disabled={disabled || busy}
            type="submit"
            className="btn-primary min-h-11 w-full"
          >
            Create contest
          </button>
        </div>
      </form>

      <form onSubmit={onJoin} className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <label className="block min-w-0 flex-1">
          <span className="hud-label">Contest code</span>
          <input
            value={invite}
            onChange={(e) => setInvite(e.target.value.replace(/\D/g, '').slice(0, 8))}
            className="hud-input font-mono tracking-[0.2em]"
            inputMode="numeric"
            maxLength={8}
            placeholder="4–8 digit code"
            autoComplete="off"
          />
        </label>
        <button
          disabled={disabled || busy || !invite.trim()}
          type="submit"
          className="btn-ghost min-h-11 shrink-0"
        >
          Join contest
        </button>
      </form>

      {open.length > 0 && (
        <div className="space-y-2">
          <p className="hud-label">Open contests</p>
          <ul className="space-y-1.5">
            {open.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  disabled={disabled || busy}
                  onClick={() => onOpenContest(c.id)}
                  className="flex w-full items-center justify-between gap-2 rounded-lg border border-cream/10 bg-ink/40 px-3 py-2.5 text-left text-sm transition hover:border-gold/30 hover:bg-gold/5"
                >
                  <span className="font-medium text-cream/90">{c.name}</span>
                  <span className="text-xs text-cream/45">
                    {c.mode === 'knockout' ? 'KO' : 'TM'} · {c.entrants.length}/{c.fieldSize}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {error && (
        <p role="alert" className="text-sm text-red-300">
          {error}
        </p>
      )}
    </div>
  );
}
