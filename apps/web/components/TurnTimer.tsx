'use client';

import { formatTurnSeconds, useTurnRemainingMs } from '@/lib/tableLayout';

/** Compact progress strip for the top of the action panel. */
export function MoveTimerStrip({
  endsAt,
  totalMs,
  compact = false,
}: {
  endsAt: number | null | undefined;
  totalMs: number;
  /** Tighter padding for landscape action strip. */
  compact?: boolean;
}) {
  const remaining = useTurnRemainingMs(endsAt);
  if (!endsAt || remaining <= 0 || totalMs <= 0) return null;

  const pct = Math.min(100, Math.max(0, (remaining / totalMs) * 100));
  const urgent = remaining <= 5000;
  const secs = formatTurnSeconds(remaining);

  return (
    <div
      className={compact ? 'w-full shrink-0 px-1.5 pt-0.5' : 'w-full shrink-0 px-2 pt-1'}
      aria-label={`Time left ${secs} seconds`}
    >
      <div className={`w-full overflow-hidden rounded-full ${compact ? 'h-1' : 'h-1.5'}`}>
        <div
          className={`h-full rounded-full transition-[width] duration-100 ease-linear ${
            urgent ? 'bg-danger' : 'bg-gradient-to-r from-sidebar to-[#5a2a7a]'
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export function useMoveTimerLabel(endsAt: number | null | undefined): {
  label: string | null;
  urgent: boolean;
} {
  const remaining = useTurnRemainingMs(endsAt);
  if (!endsAt || remaining <= 0) return { label: null, urgent: false };
  return {
    label: `${formatTurnSeconds(remaining)}s`,
    urgent: remaining <= 5000,
  };
}

/** Opponent / non-action turn clock (not shown on your move). */
export function TurnTimerBar({
  endsAt,
  totalMs,
}: {
  endsAt: number | null | undefined;
  totalMs: number;
  /** @deprecated ignored — bar is only for others' turns */
  isMyTurn?: boolean;
}) {
  const remaining = useTurnRemainingMs(endsAt);
  if (!endsAt || remaining <= 0 || totalMs <= 0) return null;

  const pct = Math.min(100, Math.max(0, (remaining / totalMs) * 100));
  const urgent = remaining <= 5000;

  return (
    <div className="hud-panel mx-auto w-full max-w-xl px-4 py-2.5 opacity-70">
      <div className="mb-1.5 flex items-center justify-between gap-3">
        <span
          className={`text-[10px] font-display uppercase tracking-[0.2em] ${
            urgent ? 'text-red-300' : 'text-cream/50'
          }`}
        >
          Turn clock
        </span>
        <span
          className={`font-mono text-sm font-bold tabular-nums ${
            urgent ? 'text-red-300' : 'text-cream/80'
          }`}
        >
          {formatTurnSeconds(remaining)}s
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-cream/10">
        <div
          className={`h-full rounded-full transition-[width] duration-100 ease-linear ${
            urgent ? 'bg-red-400' : 'bg-gradient-to-r from-positive to-mushroom'
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export function SeatTurnRing({
  endsAt,
  totalMs,
  active,
  size = 56,
}: {
  endsAt: number | null | undefined;
  totalMs: number;
  active: boolean;
  /** Outer box size in px (avatar + ring padding). */
  size?: number;
}) {
  const remaining = useTurnRemainingMs(active ? endsAt : null);
  if (!active || !endsAt || remaining <= 0 || totalMs <= 0) return null;
  const pct = Math.min(1, Math.max(0, remaining / totalMs));
  const urgent = remaining <= 5000;
  const r = 22;
  const c = 2 * Math.PI * r;
  const dash = c * pct;

  return (
    <svg
      className="pointer-events-none absolute inset-0"
      width={size}
      height={size}
      viewBox="0 0 56 56"
      aria-hidden
    >
      <circle
        cx="28"
        cy="28"
        r={r}
        fill="none"
        stroke="rgba(255,255,255,0.12)"
        strokeWidth="3.5"
      />
      <circle
        cx="28"
        cy="28"
        r={r}
        fill="none"
        stroke={urgent ? '#f87171' : 'rgb(var(--table-focus-ring))'}
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeDasharray={`${dash} ${c}`}
        transform="rotate(-90 28 28)"
        className="transition-[stroke-dasharray] duration-100 ease-linear"
      />
    </svg>
  );
}
