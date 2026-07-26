'use client';

import { formatTurnSeconds, useTurnRemainingMs } from '@/lib/tableLayout';

export function TurnTimerBar({
  endsAt,
  totalMs,
  isMyTurn,
}: {
  endsAt: number | null | undefined;
  totalMs: number;
  isMyTurn: boolean;
}) {
  const remaining = useTurnRemainingMs(endsAt);
  if (!endsAt || remaining <= 0 || totalMs <= 0) return null;

  const pct = Math.min(100, Math.max(0, (remaining / totalMs) * 100));
  const urgent = remaining <= 5000;

  return (
    <div
      className={`hud-panel w-full max-w-xl mx-auto px-4 py-2.5 ${
        isMyTurn ? '' : 'opacity-70'
      }`}
    >
      <div className="flex items-center justify-between gap-3 mb-1.5">
        <span
          className={`text-[10px] font-display uppercase tracking-[0.2em] ${
            urgent ? 'text-red-300' : isMyTurn ? 'text-felt-neon' : 'text-cream/50'
          }`}
        >
          {isMyTurn ? 'Your clock' : 'Turn clock'}
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
            urgent ? 'bg-red-400' : 'bg-gradient-to-r from-felt-neon to-gold'
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {isMyTurn && (
        <p className="mt-1.5 text-[10px] text-cream/40">
          Time out → fold
        </p>
      )}
    </div>
  );
}

export function SeatTurnRing({
  endsAt,
  totalMs,
  active,
}: {
  endsAt: number | null | undefined;
  totalMs: number;
  active: boolean;
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
      className="pointer-events-none absolute -inset-2 w-[calc(100%+1rem)] h-[calc(100%+1rem)]"
      viewBox="0 0 56 56"
      aria-hidden
    >
      <circle
        cx="28"
        cy="28"
        r={r}
        fill="none"
        stroke="rgba(255,255,255,0.08)"
        strokeWidth="3"
      />
      <circle
        cx="28"
        cy="28"
        r={r}
        fill="none"
        stroke={urgent ? '#f87171' : '#2AFF9A'}
        strokeWidth="3"
        strokeLinecap="round"
        strokeDasharray={`${dash} ${c}`}
        transform="rotate(-90 28 28)"
        className="transition-[stroke-dasharray] duration-100 ease-linear"
      />
    </svg>
  );
}
