'use client';

import { useEffect } from 'react';
import { isSeatActionLabel } from '@/lib/seatAction';
import { useSession } from '@/lib/store';
import { toast } from '@/lib/toast';

/** Info/error toasts (sitting out, seat taken, disconnect, …). */
export const TABLE_INFO_TOAST_MS = 5_000;

/** Seat Call/Fold/Bet bubbles stay on the player this long. */
export const SEAT_ACTION_POPUP_MS = 5_000;

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
 * Forwards table info/errors ({@link useSession} lastError) to the global toast,
 * then clears `lastError` once the toast window has elapsed.
 * Poker Call/Fold labels stay on the seat — not here.
 */
export function useTableNoticeToasts() {
  const lastError = useSession((s) => s.lastError);
  const lastErrorCode = useSession((s) => s.lastErrorCode);
  const setError = useSession((s) => s.setError);

  // Critical codes are handled by leave/redirect flows — skip the toast.
  const suppress =
    lastErrorCode === 'not_found' || lastErrorCode === 'kicked' || !lastError;
  const message = suppress ? null : lastError;

  useEffect(() => {
    if (!message) return;
    toast.error(message, { durationMs: TABLE_INFO_TOAST_MS });
    const t = window.setTimeout(() => setError(null), TABLE_INFO_TOAST_MS);
    return () => window.clearTimeout(t);
  }, [message, setError]);
}
