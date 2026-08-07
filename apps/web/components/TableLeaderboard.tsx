'use client';

import { useMemo } from 'react';
import { formatChips } from './ChipStack';
import { PlayerAvatar } from './PlayerAvatar';
import type { PublicPlayer } from '@/lib/store';

const LB_KEY = 'felt-show-leaderboard';

export function loadShowLeaderboard(): boolean {
  try {
    return localStorage.getItem(LB_KEY) === '1';
  } catch {
    return false;
  }
}

export function saveShowLeaderboard(on: boolean) {
  try {
    localStorage.setItem(LB_KEY, on ? '1' : '0');
  } catch {
    /* ignore */
  }
}

type Row = {
  rank: number;
  seat: number;
  name: string;
  stack: number;
  userId: string;
  avatarId?: number | null;
  isSelf: boolean;
  isBot: boolean;
  sittingOut: boolean;
  busted: boolean;
};

function rowsFromPlayers(players: PublicPlayer[], userId: string | null): Row[] {
  const seated = players.filter((p) => p.userId && p.status !== 'empty');
  const sorted = [...seated].sort((a, b) => {
    if (b.stack !== a.stack) return b.stack - a.stack;
    return a.seat - b.seat;
  });
  return sorted.map((p, i) => ({
    rank: i + 1,
    seat: p.seat,
    name: p.name?.trim() || `Seat ${p.seat + 1}`,
    stack: p.stack,
    userId: p.userId!,
    avatarId: p.avatarId,
    isSelf: !!userId && p.userId === userId,
    isBot: !!p.userId?.startsWith('bot:'),
    sittingOut: p.status === 'sittingOut',
    busted: p.stack === 0,
  }));
}

/**
 * Compact stack rankings overlay for the table HUD.
 */
export function TableLeaderboard({
  players,
  userId,
  open,
  onClose,
  compact = false,
}: {
  players: PublicPlayer[];
  userId: string | null;
  open: boolean;
  onClose: () => void;
  compact?: boolean;
}) {
  const rows = useMemo(() => rowsFromPlayers(players, userId), [players, userId]);

  if (!open) return null;

  return (
    <div
      className={`pointer-events-auto absolute z-40 flex flex-col overflow-hidden rounded-xl border border-sidebar/15 bg-mushroom/95 shadow-[0_12px_36px_rgb(29_4_50/0.18)] backdrop-blur-md ${
        compact
          ? 'left-1.5 top-1.5 w-[min(14.5rem,calc(100%-0.75rem))]'
          : 'left-3 top-3 w-[min(16rem,calc(100%-1.5rem))]'
      }`}
      role="dialog"
      aria-label="Stack leaderboard"
    >
      <div className="flex items-center justify-between gap-2 border-b border-sidebar/10 px-2.5 py-1.5">
        <h2 className="font-display text-[10px] font-bold uppercase tracking-[0.14em] text-sidebar">
          Leaderboard
        </h2>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-sidebar/70 hover:bg-sidebar/8 hover:text-sidebar"
          aria-label="Hide leaderboard"
        >
          Hide
        </button>
      </div>

      {rows.length === 0 ? (
        <p className="px-3 py-4 text-center text-xs text-ink-strong-muted">No players seated</p>
      ) : (
        <ol className="max-h-[min(14rem,42vh)] overflow-y-auto py-1">
          {rows.map((row) => (
            <li
              key={row.userId}
              className={`flex items-center gap-2 px-2.5 py-1.5 ${
                row.isSelf ? 'bg-sidebar/10' : ''
              } ${row.busted ? 'opacity-55' : ''}`}
            >
              <span
                className={`w-5 shrink-0 text-center font-mono text-[11px] font-bold tabular-nums ${
                  row.rank === 1
                    ? 'text-sidebar'
                    : row.rank === 2
                      ? 'text-sidebar/75'
                      : row.rank === 3
                        ? 'text-sidebar/55'
                        : 'text-ink-strong-muted'
                }`}
              >
                {row.rank}
              </span>
              <PlayerAvatar avatarId={row.avatarId} userId={row.userId} size={compact ? 22 : 24} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold text-ink-strong">
                  {row.name}
                  {row.isSelf ? (
                    <span className="ml-1 text-[9px] font-display font-bold uppercase tracking-wide text-sidebar">
                      you
                    </span>
                  ) : null}
                  {row.isBot ? (
                    <span className="ml-1 text-[9px] font-display uppercase tracking-wide text-ink-strong-muted">
                      bot
                    </span>
                  ) : null}
                </p>
                {row.sittingOut || row.busted ? (
                  <p className="text-[9px] uppercase tracking-wide text-ink-strong-muted">
                    {row.busted ? 'Busted' : 'Sitting out'}
                  </p>
                ) : null}
              </div>
              <span className="shrink-0 font-mono text-xs font-bold tabular-nums text-sidebar">
                ${formatChips(row.stack)}
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

/** Toggle control for desktop/mobile chrome. */
export function LeaderboardToggle({
  open,
  onToggle,
  compact = false,
}: {
  open: boolean;
  onToggle: () => void;
  compact?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={open}
      title={open ? 'Hide leaderboard' : 'Show leaderboard'}
      className={
        compact
          ? `flex h-11 items-center rounded-full border px-3 text-[11px] font-display font-bold uppercase tracking-wide ${
              open
                ? 'border-sidebar/40 bg-sidebar/10 text-sidebar'
                : 'border-sidebar/20 bg-white/80 text-ink-strong hover:border-sidebar/40 hover:text-sidebar'
            }`
          : `status-chip ${
              open
                ? 'border-sidebar/40 bg-sidebar/10 text-sidebar'
                : 'border-sidebar/20 bg-white/80 text-ink-strong hover:border-sidebar/35'
            }`
      }
    >
      {open ? 'Ranks · on' : 'Ranks'}
    </button>
  );
}
