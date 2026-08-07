'use client';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react';
import { useIsLandscapePhone, useIsNarrow } from '@/lib/tableLayout';

const POS_KEY = 'felt-action-dock-pos';
export const ACTION_PLACEMENT_KEY = 'felt-action-placement';

export type ActionPlacement = 'float' | 'chat';

type Pos = { x: number; y: number };

function loadPos(): Pos | null {
  try {
    const raw = localStorage.getItem(POS_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as Pos;
    if (typeof p.x === 'number' && typeof p.y === 'number') return p;
  } catch {
    /* ignore */
  }
  return null;
}

function savePos(p: Pos) {
  try {
    localStorage.setItem(POS_KEY, JSON.stringify(p));
  } catch {
    /* ignore */
  }
}

export function loadActionPlacement(): ActionPlacement {
  try {
    const raw = localStorage.getItem(ACTION_PLACEMENT_KEY);
    if (raw === 'chat' || raw === 'float') return raw;
  } catch {
    /* ignore */
  }
  return 'float';
}

export function saveActionPlacement(p: ActionPlacement) {
  try {
    localStorage.setItem(ACTION_PLACEMENT_KEY, p);
  } catch {
    /* ignore */
  }
}

/** Fixed-height action body used by float, mobile, and chat docks. */
export function ActionDockBody({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`flex h-[160px] min-h-[160px] w-full flex-col overflow-hidden bg-mushroom ${className}`}
    >
      <div className="flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden">{children}</div>
    </div>
  );
}

/** Actions pinned under desktop chat. */
export function ChatActionDock({
  children,
  expanded,
  onFloat,
}: {
  children: ReactNode;
  expanded: boolean;
  onFloat: () => void;
}) {
  return (
    <div
      className={`shrink-0 border-t bg-mushroom ${
        expanded ? 'border-sidebar/25' : 'border-sidebar/12'
      }`}
    >
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-sidebar/10 bg-white/70 px-3 py-1.5">
        <span
          className={`text-[10px] font-display uppercase tracking-[0.18em] ${
            expanded ? 'text-sidebar' : 'text-ink-strong-muted'
          }`}
        >
          {expanded ? 'Your move' : 'Actions'}
        </span>
        <button
          type="button"
          onClick={onFloat}
          className="rounded border border-sidebar/20 px-2 py-0.5 text-[10px] font-display font-semibold uppercase tracking-wider text-ink-strong-muted hover:border-sidebar/40 hover:bg-sidebar/8 hover:text-sidebar"
          title="Float actions over the table"
        >
          Float
        </button>
      </div>
      <ActionDockBody>{children}</ActionDockBody>
    </div>
  );
}

/**
 * Mobile portrait/landscape: bottom dock.
 * Desktop: floating draggable popup (optional Dock-to-chat).
 */
export function FloatingActionDock({
  children,
  expanded,
  label = 'Actions',
  onDockToChat,
}: {
  children: ReactNode;
  /** When true, it's your turn. */
  expanded: boolean;
  label?: string;
  /** Desktop only — dock actions under chat. */
  onDockToChat?: () => void;
}) {
  const narrow = useIsNarrow();
  const landscape = useIsLandscapePhone();
  const [pos, setPos] = useState<Pos | null>(null);
  const [open, setOpen] = useState(true);
  const dragging = useRef(false);
  const origin = useRef({ px: 0, py: 0, x: 0, y: 0 });
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setPos(loadPos());
  }, []);

  useEffect(() => {
    if (expanded) setOpen(true);
  }, [expanded]);

  const onPointerDown = useCallback(
    (e: ReactPointerEvent) => {
      if ((e.target as HTMLElement).closest('[data-no-drag]')) return;
      const el = panelRef.current;
      if (!el) return;
      dragging.current = true;
      el.setPointerCapture(e.pointerId);
      const rect = el.getBoundingClientRect();
      origin.current = {
        px: e.clientX,
        py: e.clientY,
        x: pos?.x ?? rect.left,
        y: pos?.y ?? rect.top,
      };
    },
    [pos],
  );

  const onPointerMove = useCallback((e: ReactPointerEvent) => {
    if (!dragging.current) return;
    const dx = e.clientX - origin.current.px;
    const dy = e.clientY - origin.current.py;
    const next = {
      x: Math.min(window.innerWidth - 72, Math.max(8, origin.current.x + dx)),
      y: Math.min(window.innerHeight - 72, Math.max(8, origin.current.y + dy)),
    };
    setPos(next);
  }, []);

  const onPointerUp = useCallback((e: ReactPointerEvent) => {
    if (!dragging.current) return;
    dragging.current = false;
    try {
      panelRef.current?.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    setPos((cur) => {
      if (cur) savePos(cur);
      return cur;
    });
  }, []);

  /* —— Phone (portrait or landscape): docked —— */
  if (narrow) {
    if (landscape) {
      return (
        <div className="relative z-40 h-[160px] min-h-[160px] shrink-0 border-t border-sidebar/15 bg-mushroom px-1 pb-[max(0.15rem,env(safe-area-inset-bottom))] pt-0.5 shadow-[0_-8px_24px_rgb(29_4_50/0.1)]">
          <div className="mx-auto flex h-full w-full max-w-5xl flex-col overflow-hidden">
            <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
          </div>
        </div>
      );
    }

    return (
      <div
        className={`relative z-40 h-[160px] min-h-[160px] shrink-0 border-t px-1.5 pb-[max(0.25rem,env(safe-area-inset-bottom))] pt-1 ${
          expanded
            ? 'border-sidebar/20 bg-mushroom shadow-[0_-6px_20px_rgb(29_4_50/0.1)]'
            : 'border-sidebar/12 bg-mushroom/95'
        }`}
      >
        <div
          className={`mx-auto flex h-full w-full max-w-4xl flex-col overflow-hidden rounded-xl border bg-white ${
            expanded ? 'border-sidebar/25 ring-1 ring-sidebar/10' : 'border-sidebar/15'
          }`}
        >
          <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
        </div>
      </div>
    );
  }

  /* —— Desktop: floating undocked popup —— */
  const style =
    pos != null
      ? { left: pos.x, top: pos.y, right: 'auto', bottom: 'auto' as const }
      : { left: '50%', bottom: '1.25rem', transform: 'translateX(-50%)' };

  return (
    <div
      ref={panelRef}
      className="fixed z-50 max-w-[min(100vw-1rem,28rem)] touch-none"
      style={style}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      {!open ? (
        <button
          type="button"
          data-no-drag
          onClick={() => setOpen(true)}
          className={`rounded-full border px-5 py-3 text-xs font-display font-bold uppercase tracking-[0.18em] shadow-[0_8px_24px_rgb(29_4_50/0.12)] ${
            expanded
              ? 'border-sidebar/40 bg-mushroom text-sidebar animate-hud-pulse'
              : 'border-sidebar/20 bg-white text-ink-strong-muted'
          }`}
        >
          {expanded ? 'Your move' : label}
        </button>
      ) : (
        <div
          className={`flex w-[min(100vw-2rem,28rem)] flex-col overflow-hidden rounded-lg border bg-mushroom shadow-[0_16px_48px_rgb(29_4_50/0.14)] ${
            expanded ? 'border-sidebar/30 ring-1 ring-sidebar/10' : 'border-sidebar/18'
          }`}
        >
          <div className="flex shrink-0 cursor-grab items-center justify-between gap-2 border-b border-sidebar/12 bg-white/70 px-3 py-1.5 active:cursor-grabbing">
            <span
              className={`min-w-0 truncate text-[10px] font-display uppercase tracking-[0.22em] ${
                expanded ? 'text-sidebar' : 'text-ink-strong-muted'
              }`}
            >
              Drag · {expanded ? 'your move' : 'actions'}
            </span>
            <div className="flex shrink-0 items-center gap-1" data-no-drag>
              {onDockToChat ? (
                <button
                  type="button"
                  onClick={onDockToChat}
                  className="rounded border border-sidebar/20 px-2 py-0.5 text-[10px] font-display font-semibold uppercase tracking-wider text-ink-strong-muted hover:border-sidebar/40 hover:bg-sidebar/8 hover:text-sidebar"
                  title="Dock actions in chat panel"
                >
                  In chat
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded border border-sidebar/20 px-2 py-0.5 text-[10px] uppercase tracking-wider text-ink-strong-muted hover:border-sidebar/40 hover:bg-sidebar/8 hover:text-sidebar"
              >
                Min
              </button>
            </div>
          </div>
          <div data-no-drag>
            <ActionDockBody>{children}</ActionDockBody>
          </div>
        </div>
      )}
    </div>
  );
}
