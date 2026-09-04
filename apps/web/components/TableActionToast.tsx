'use client';

import { useEffect, useState } from 'react';
import { isSeatActionLabel } from '@/lib/seatAction';
import { useSession } from '@/lib/store';

/** Info/error toasts (sitting out, seat taken, disconnect, …). */
export const TABLE_INFO_TOAST_MS = 5_000;

/** Seat Call/Fold/Bet bubbles stay on the player this long. */
export const SEAT_ACTION_POPUP_MS = 5_000;

const EXIT_MS = 280;

/** @deprecated use {@link isSeatActionLabel} from `@/lib/seatAction` */
export { isSeatActionLabel };

/**
 * Clears seat action bursts after the popup animation window so the next
 * action can fire cleanly.
 */
export function useSeatActionAutoClear() {
  const burst = useSession((s) => s.actionBurst);
  const setActionBurst = useSession((s) => s.setActionBurst);

  useEffect(() => {
    if (!burst) return;
    const t = window.setTimeout(() => setActionBurst(null), SEAT_ACTION_POPUP_MS);
    return () => window.clearTimeout(t);
  }, [burst, setActionBurst]);
}

/**
 * Top-right notification for table info/errors (from {@link useSession} lastError).
 * Poker Call/Fold labels stay on the seat — not here.
 */
export function TableActionToast() {
  const lastError = useSession((s) => s.lastError);
  const lastErrorCode = useSession((s) => s.lastErrorCode);
  const setError = useSession((s) => s.setError);
  const [leaving, setLeaving] = useState(false);
  const [shownAt, setShownAt] = useState<number | null>(null);

  // Critical codes are handled by leave/redirect flows — skip the toast.
  const suppress =
    lastErrorCode === 'not_found' || lastErrorCode === 'kicked' || !lastError;
  const message = suppress ? null : lastError;

  useEffect(() => {
    if (!message) {
      setLeaving(false);
      setShownAt(null);
      return;
    }
    setLeaving(false);
    setShownAt(Date.now());

    const fadeTimer = window.setTimeout(
      () => setLeaving(true),
      TABLE_INFO_TOAST_MS - EXIT_MS,
    );
    const clearTimer = window.setTimeout(() => setError(null), TABLE_INFO_TOAST_MS);

    return () => {
      window.clearTimeout(fadeTimer);
      window.clearTimeout(clearTimer);
    };
  }, [message, setError]);

  if (!message || shownAt == null) return null;

  function dismiss() {
    setLeaving(true);
    window.setTimeout(() => setError(null), EXIT_MS);
  }

  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-0 z-[55] flex justify-end px-3 pt-[max(0.65rem,env(safe-area-inset-top))] sm:px-4 sm:pt-3"
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <div
        key={shownAt}
        className={`glass-sheet table-action-toast pointer-events-auto w-full max-w-[17.5rem] overflow-hidden rounded-xl border border-danger/35 bg-[rgb(255_252_250_/0.97)] shadow-[0_10px_32px_rgb(29_4_50/0.24),0_1px_0_rgb(255_255_255/0.65)_inset] backdrop-blur-xl ${
          leaving ? 'table-action-toast-out' : 'table-action-toast-in'
        }`}
      >
        <div className="flex items-start gap-2.5 bg-danger/10 px-3 py-2.5">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-display font-bold uppercase tracking-[0.14em] text-danger">
              Notice
            </p>
            <p className="mt-0.5 text-sm font-semibold leading-snug text-ink-strong">{message}</p>
          </div>
          <button
            type="button"
            onClick={dismiss}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-base leading-none text-ink-strong-muted transition hover:bg-white/70 hover:text-sidebar"
            aria-label="Dismiss notification"
          >
            ×
          </button>
        </div>
        <div className="h-0.5 w-full bg-sidebar/10">
          <div
            key={`bar-${shownAt}`}
            className="table-action-toast-bar h-full origin-left bg-danger"
            style={{ animationDuration: `${TABLE_INFO_TOAST_MS}ms` }}
          />
        </div>
      </div>
    </div>
  );
}
