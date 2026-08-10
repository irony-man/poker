'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { respondFriendRequest, sendFriendRequest } from '@/lib/api';
import { useSession } from '@/lib/store';

/** Session-scoped outbound request targets until social_sync catches up. */
const outboundPending = new Set<string>();
const outboundListeners = new Set<() => void>();

function markOutbound(userId: string) {
  outboundPending.add(userId);
  for (const l of outboundListeners) l();
}

function useOutboundPending(userId: string | undefined): boolean {
  const [, tick] = useState(0);
  useEffect(() => {
    const bump = () => tick((n) => n + 1);
    outboundListeners.add(bump);
    return () => {
      outboundListeners.delete(bump);
    };
  }, []);
  if (!userId) return false;
  return outboundPending.has(userId);
}

/** Interactive hit target that only wraps as a button when friend actions apply. */
export function FriendableSeatHit({
  enabled,
  label,
  open,
  onToggle,
  children,
  className = '',
}: {
  enabled: boolean;
  label: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
  className?: string;
}) {
  if (!enabled) return <>{children}</>;
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      aria-label={`Player menu for ${label}`}
      aria-expanded={open}
      className={`rounded-full outline-none ring-offset-0 focus-visible:ring-1 focus-visible:ring-white/50 ${className}`.trim()}
    >
      {children}
    </button>
  );
}

/**
 * Seat-anchored friend menu: Friends / Add friend / Accept·Decline incoming.
 */
export function SeatFriendMenu({
  targetUserId,
  name,
  open,
  onClose,
}: {
  targetUserId: string;
  name: string;
  open: boolean;
  onClose: () => void;
}) {
  const sessionToken = useSession((s) => s.sessionToken);
  const social = useSession((s) => s.social);
  const panelRef = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const outbound = useOutboundPending(targetUserId);

  const isFriend = useMemo(
    () => Boolean(social?.friends.some((f) => f.userId === targetUserId)),
    [social?.friends, targetUserId],
  );

  const incoming = useMemo(
    () => social?.incoming.find((r) => r.from.userId === targetUserId) ?? null,
    [social?.incoming, targetUserId],
  );

  // Drop local outbound once friendship is confirmed via push.
  useEffect(() => {
    if (isFriend && outboundPending.has(targetUserId)) {
      outboundPending.delete(targetUserId);
    }
  }, [isFriend, targetUserId]);

  useEffect(() => {
    if (!open) {
      setError(null);
      return;
    }
    const onDown = (e: MouseEvent) => {
      if (!panelRef.current?.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    // Defer so the opening click doesn't instantly close.
    const t = window.setTimeout(() => {
      document.addEventListener('mousedown', onDown);
      document.addEventListener('keydown', onKey);
    }, 0);
    return () => {
      window.clearTimeout(t);
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  const onAdd = useCallback(async () => {
    if (!sessionToken || busy) return;
    setBusy(true);
    setError(null);
    try {
      await sendFriendRequest(targetUserId, { sessionToken });
      markOutbound(targetUserId);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not send request';
      if (/already friends/i.test(msg)) {
        setError(null);
      } else if (/already pending/i.test(msg)) {
        markOutbound(targetUserId);
        setError(null);
      } else {
        setError(msg);
      }
    } finally {
      setBusy(false);
    }
  }, [sessionToken, busy, targetUserId]);

  const onRespond = useCallback(
    async (accept: boolean) => {
      if (!sessionToken || !incoming || busy) return;
      setBusy(true);
      setError(null);
      try {
        await respondFriendRequest(incoming.id, accept, { sessionToken });
        if (!accept) onClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed');
      } finally {
        setBusy(false);
      }
    },
    [sessionToken, incoming, busy, onClose],
  );

  if (!open) return null;

  const sent = outbound && !isFriend && !incoming;

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-label={`Friend actions for ${name}`}
      onClick={(e) => e.stopPropagation()}
      className="absolute left-1/2 top-full z-50 mt-1 w-[7.5rem] -translate-x-1/2 rounded-lg border border-white/15 bg-sidebar/95 p-1.5 shadow-[0_8px_20px_rgba(0,0,0,0.55)] backdrop-blur-sm"
    >
      <p className="truncate px-1 pb-1 text-[10px] font-bold text-mushroom/90">{name}</p>

      {isFriend ? (
        <p className="rounded-md bg-mushroom/15 px-1.5 py-1 text-center text-[10px] font-semibold uppercase tracking-wide text-mushroom/70">
          Friends
        </p>
      ) : incoming ? (
        <div className="flex flex-col gap-1">
          <p className="px-0.5 text-[9px] leading-snug text-mushroom/60">Wants to be friends</p>
          <button
            type="button"
            disabled={busy}
            onClick={() => void onRespond(true)}
            className="rounded-md bg-gold/90 px-1.5 py-1 text-[10px] font-bold uppercase tracking-wide text-sidebar hover:bg-gold disabled:opacity-50"
          >
            Accept
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void onRespond(false)}
            className="rounded-md bg-black/40 px-1.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-mushroom/80 hover:bg-black/55 disabled:opacity-50"
          >
            Decline
          </button>
        </div>
      ) : sent ? (
        <p className="rounded-md bg-mushroom/15 px-1.5 py-1 text-center text-[10px] font-semibold uppercase tracking-wide text-mushroom/70">
          Request sent
        </p>
      ) : (
        <button
          type="button"
          disabled={busy || !sessionToken}
          onClick={() => void onAdd()}
          className="w-full rounded-md bg-gold/90 px-1.5 py-1 text-[10px] font-bold uppercase tracking-wide text-sidebar hover:bg-gold disabled:opacity-50"
        >
          {busy ? '…' : 'Add friend'}
        </button>
      )}

      {error ? (
        <p role="alert" className="mt-1 px-0.5 text-[9px] leading-snug text-red-300">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** Whether this seat can open a friend menu for the local signed-in user. */
export function canOpenSeatFriendMenu(opts: {
  sessionToken: string | null;
  isSelf: boolean;
  isBot: boolean;
  userId: string | null | undefined;
}): boolean {
  return Boolean(
    opts.sessionToken &&
      !opts.isSelf &&
      !opts.isBot &&
      opts.userId &&
      !opts.userId.startsWith('bot:'),
  );
}
