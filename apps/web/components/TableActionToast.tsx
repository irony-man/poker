'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';
import { PlayerAvatar } from './PlayerAvatar';
import { useSession } from '@/lib/store';

/** How long seat-action notifications stay visible before auto-dismiss. */
export const TABLE_ACTION_TOAST_MS = 5_000;

const EXIT_MS = 280;

function toneForLabel(label: string): {
  ring: string;
  bar: string;
  badge: string;
  accent: string;
} {
  const t = label.toLowerCase();
  if (t.startsWith('fold')) {
    return {
      ring: 'border-danger/40',
      bar: 'bg-danger',
      badge: 'text-danger',
      accent: 'bg-danger/12',
    };
  }
  if (t.startsWith('all-in') || t.startsWith('allin')) {
    return {
      ring: 'border-brass/55',
      bar: 'bg-brass',
      badge: 'text-brass-dim',
      accent: 'bg-brass/15',
    };
  }
  if (t.startsWith('raise') || t.startsWith('bet') || t.startsWith('call')) {
    return {
      ring: 'border-sidebar/35',
      bar: 'bg-sidebar',
      badge: 'text-sidebar',
      accent: 'bg-sidebar/10',
    };
  }
  return {
    ring: 'border-sidebar/20',
    bar: 'bg-sidebar/75',
    badge: 'text-ink-strong',
    accent: 'bg-sidebar/8',
  };
}

/**
 * Heads-up system-style notification for the last table action.
 * Slides in from the top and auto-clears after {@link TABLE_ACTION_TOAST_MS}.
 */
export function TableActionToast() {
  const burst = useSession((s) => s.actionBurst);
  const players = useSession((s) => s.table?.players);
  const setActionBurst = useSession((s) => s.setActionBurst);
  const [leaving, setLeaving] = useState(false);

  const player = burst
    ? players?.find((p) => p.seat === burst.seat) ?? null
    : null;
  const playerName = player?.name?.trim() || (burst ? `Seat ${burst.seat + 1}` : '');

  useEffect(() => {
    if (!burst) {
      setLeaving(false);
      return;
    }
    setLeaving(false);

    const elapsed = Math.max(0, Date.now() - burst.at);
    const remaining = Math.max(0, TABLE_ACTION_TOAST_MS - elapsed);
    if (remaining === 0) {
      setActionBurst(null);
      return;
    }

    const fadeMs = Math.min(EXIT_MS, remaining);
    const fadeTimer = window.setTimeout(() => setLeaving(true), remaining - fadeMs);
    const clearTimer = window.setTimeout(() => setActionBurst(null), remaining);

    return () => {
      window.clearTimeout(fadeTimer);
      window.clearTimeout(clearTimer);
    };
  }, [burst, setActionBurst]);

  if (!burst) return null;

  const tone = toneForLabel(burst.label);
  const progressDuration = Math.max(
    0,
    TABLE_ACTION_TOAST_MS - Math.max(0, Date.now() - burst.at),
  );

  function dismiss() {
    setLeaving(true);
    window.setTimeout(() => setActionBurst(null), EXIT_MS);
  }

  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-0 z-[55] flex justify-center px-3 pt-[max(0.65rem,env(safe-area-inset-top))] sm:px-4 sm:pt-3"
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <div
        key={burst.at}
        className={`table-action-toast pointer-events-auto w-full max-w-[22rem] overflow-hidden rounded-[1.15rem] border bg-[rgb(255_252_250_/0.97)] shadow-[0_10px_36px_rgb(29_4_50/0.28),0_1px_0_rgb(255_255_255/0.7)_inset] backdrop-blur-xl ${tone.ring} ${
          leaving ? 'table-action-toast-out' : 'table-action-toast-in'
        }`}
      >
        {/* App chrome — reads like a push banner */}
        <div className="flex items-center gap-2 border-b border-sidebar/8 px-3 py-1.5">
          <span className="flex h-5 w-5 shrink-0 items-center justify-center overflow-hidden rounded-[5px] bg-sidebar shadow-sm">
            <Image
              src="/icon-192.png"
              alt=""
              width={20}
              height={20}
              className="h-full w-full object-cover"
            />
          </span>
          <p className="min-w-0 flex-1 text-[11px] font-display font-bold uppercase tracking-[0.14em] text-ink-strong">
            POKR
          </p>
          <p className="shrink-0 text-[10px] font-medium tabular-nums text-ink-strong-muted">
            now
          </p>
          <button
            type="button"
            onClick={dismiss}
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-base leading-none text-ink-strong-muted transition hover:bg-sidebar/10 hover:text-sidebar"
            aria-label="Dismiss notification"
          >
            ×
          </button>
        </div>

        <div className={`flex items-center gap-3 px-3 py-2.5 ${tone.accent}`}>
          <div className="shrink-0 rounded-full ring-2 ring-white shadow-sm">
            <PlayerAvatar
              userId={player?.userId ?? `seat-${burst.seat}`}
              avatarId={player?.avatarId}
              size={40}
              title={playerName}
            />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold leading-snug text-ink-strong">
              {playerName}
            </p>
            <p
              className={`mt-0.5 font-display text-[15px] font-bold uppercase leading-tight tracking-wide ${tone.badge}`}
            >
              {burst.label}
            </p>
          </div>
        </div>

        {/* Auto-dismiss countdown */}
        <div className="h-0.5 w-full bg-sidebar/10">
          <div
            key={`bar-${burst.at}`}
            className={`table-action-toast-bar h-full origin-left ${tone.bar}`}
            style={{ animationDuration: `${progressDuration}ms` }}
          />
        </div>
      </div>
    </div>
  );
}
