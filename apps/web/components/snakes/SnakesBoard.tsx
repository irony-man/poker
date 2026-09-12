'use client';

import type { SnakesPlayerView } from '@poker/protocol';
import { SNAKES_TELEPORTS, snakesHexForSeat, snakesNumberAt } from '@/lib/snakesBoard';
import { cn } from '@/lib/cn';

export function SnakesBoard({
  seats,
  lastFrom,
  lastTo,
  lastTeleport,
  die,
  canRoll,
  rolling,
  onRoll,
}: {
  seats: SnakesPlayerView[];
  lastFrom?: number | null;
  lastTo?: number | null;
  lastTeleport?: number | null;
  die?: number | null;
  canRoll?: boolean;
  rolling?: boolean;
  onRoll?: () => void;
}) {
  const tokensByCell = new Map<number, SnakesPlayerView[]>();
  for (const p of seats) {
    if (!p.userId && !p.isBot) continue;
    if (p.position < 1) continue;
    const list = tokensByCell.get(p.position) ?? [];
    list.push(p);
    tokensByCell.set(p.position, list);
  }

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-3">
      <div
        className="grid aspect-square w-full gap-0.5 rounded-xl border border-on-chrome/15 bg-ink-raised p-1.5 sm:gap-1 sm:p-2"
        style={{ gridTemplateColumns: 'repeat(10, minmax(0, 1fr))' }}
        role="img"
        aria-label="Snakes and ladders board"
      >
        {Array.from({ length: 100 }, (_, i) => {
          const row = Math.floor(i / 10);
          const col = i % 10;
          const n = snakesNumberAt(row, col);
          const teleport = SNAKES_TELEPORTS[n];
          const isLadder = teleport != null && teleport > n;
          const isSnake = teleport != null && teleport < n;
          const highlight =
            n === lastFrom || n === lastTo || (lastTeleport != null && n === lastTeleport);
          const tokens = tokensByCell.get(n) ?? [];
          return (
            <div
              key={n}
              className={cn(
                'relative flex aspect-square flex-col items-center justify-center rounded-sm text-[8px] font-mono tabular-nums sm:text-[10px]',
                n % 2 === 0 ? 'bg-white/10' : 'bg-white/5',
                highlight && 'ring-1 ring-brass/70',
                isLadder && 'bg-emerald-500/15',
                isSnake && 'bg-rose-500/15',
              )}
            >
              <span className="leading-none text-on-chrome/55">{n}</span>
              {teleport != null ? (
                <span
                  className={cn(
                    'mt-0.5 leading-none text-[7px] font-display font-bold sm:text-[8px]',
                    isLadder ? 'text-emerald-300' : 'text-rose-300',
                  )}
                >
                  →{teleport}
                </span>
              ) : null}
              {tokens.length > 0 ? (
                <div className="absolute inset-x-0 bottom-0.5 flex justify-center gap-0.5">
                  {tokens.map((t) => (
                    <span
                      key={t.seat}
                      className="h-2 w-2 rounded-full border border-white/40 shadow-sm sm:h-2.5 sm:w-2.5"
                      style={{ backgroundColor: snakesHexForSeat(t.seat) }}
                      title={t.name ?? `Seat ${t.seat + 1}`}
                    />
                  ))}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-center gap-3">
        <div
          className={cn(
            'flex h-14 w-14 items-center justify-center rounded-xl border border-on-chrome/25 bg-ink-raised font-display text-2xl font-bold tabular-nums text-on-chrome',
            rolling && 'animate-pulse',
          )}
          aria-live="polite"
        >
          {rolling ? '…' : die != null ? die : '—'}
        </div>
        {canRoll ? (
          <button
            type="button"
            onClick={onRoll}
            disabled={rolling}
            className="min-h-11 rounded-lg bg-brass px-5 font-display text-sm font-bold uppercase tracking-wider text-ink hover:brightness-110 disabled:opacity-60"
          >
            {rolling ? 'Rolling…' : 'Roll'}
          </button>
        ) : null}
      </div>
    </div>
  );
}
