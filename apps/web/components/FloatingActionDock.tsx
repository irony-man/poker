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

function clampPos(p: Pos): Pos {
  if (typeof window === 'undefined') return p;
  const maxX = Math.max(8, window.innerWidth - 80);
  const maxY = Math.max(8, window.innerHeight - 80);
  return {
    x: Math.min(maxX, Math.max(8, p.x)),
    y: Math.min(maxY, Math.max(8, p.y)),
  };
}

/** True if the stored corner sits mostly outside the viewport. */
function isPosOffscreen(p: Pos): boolean {
  if (typeof window === 'undefined') return false;
  return p.x < -20 || p.y < -20 || p.x > window.innerWidth - 40 || p.y > window.innerHeight - 40;
}

function loadPos(): Pos | null {
  try {
    const raw = localStorage.getItem(POS_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as Pos;
    if (typeof p.x === 'number' && typeof p.y === 'number') {
      if (isPosOffscreen(p)) return null;
      return clampPos(p);
    }
  } catch {
    /* ignore */
  }
  return null;
}

function savePos(p: Pos) {
  try {
    localStorage.setItem(POS_KEY, JSON.stringify(clampPos(p)));
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

/** Action body used by float, mobile, and chat docks. */
export function ActionDockBody({
  children,
  className = '',
  /** Mobile bottom dock: no forced min height; outer shell can grow with content. */
  fillMinHeight = true,
  maxHeightClass = 'max-h-[min(50dvh,22rem)]',
}: {
  children: ReactNode;
  className?: string;
  fillMinHeight?: boolean;
  maxHeightClass?: string;
}) {
  return (
    <div
      className={`glass-sheet flex w-full flex-col overflow-y-auto overscroll-contain ${maxHeightClass} ${
        fillMinHeight ? 'min-h-[9.5rem]' : 'min-h-0'
      } ${className}`}
    >
      <div className="flex w-full min-h-0 flex-1 flex-col">{children}</div>
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
      className={`glass-sheet shrink-0 border-t ${
        expanded ? 'border-sidebar/25' : 'border-sidebar/12'
      }`}
    >
      <div className="glass-sheet flex shrink-0 items-center justify-between gap-2 border-b border-sidebar/10 px-3 py-1.5">
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

  // Keep floating panel usable after resize / monitor changes.
  useEffect(() => {
    if (narrow) return;
    const onResize = () => {
      setPos((cur) => {
        if (!cur) return cur;
        if (isPosOffscreen(cur)) return null;
        return clampPos(cur);
      });
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [narrow]);

  useEffect(() => {
    if (expanded) {
      setOpen(true);
      // When it's your turn, never leave the panel off-screen.
      setPos((cur) => {
        if (!cur) return cur;
        if (isPosOffscreen(cur)) return null;
        return clampPos(cur);
      });
    }
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
    const next = clampPos({
      x: origin.current.x + dx,
      y: origin.current.y + dy,
    });
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
        <div className="glass-sheet relative z-40 shrink-0 border-t border-sidebar/15 shadow-[0_-8px_24px_rgb(29_4_50/0.1)]">
          <div className="mx-auto w-full max-w-5xl">
            <ActionDockBody
              fillMinHeight={false}
              maxHeightClass="max-h-[min(38dvh,12rem)]"
              className="min-h-[6.5rem]"
            >
              {children}
            </ActionDockBody>
          </div>
        </div>
      );
    }

    return (
      <div
        className={`glass-sheet relative z-40 shrink-0 border-t ${
          expanded
            ? 'border-sidebar/20 shadow-[0_-6px_20px_rgb(29_4_50/0.1)]'
            : 'border-sidebar/12'
        }`}
      >
        <div
          className={`glass-sheet mx-auto w-full max-w-4xl border ${
            expanded ? 'border-sidebar/25 ring-1 ring-sidebar/10' : 'border-sidebar/15'
          }`}
        >
          <ActionDockBody
            fillMinHeight={false}
            maxHeightClass="max-h-[min(48dvh,22rem)]"
            className="min-h-[9.5rem]"
          >
            {children}
          </ActionDockBody>
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
          className={`glass-sheet rounded-full border px-5 py-3 text-xs font-display font-bold uppercase tracking-[0.18em] shadow-[0_8px_24px_rgb(29_4_50/0.12)] ${
            expanded
              ? 'border-sidebar/40 text-sidebar animate-hud-pulse'
              : 'border-sidebar/20 text-ink-strong-muted'
          }`}
        >
          {expanded ? 'Your move' : label}
        </button>
      ) : (
        <div
          className={`glass-sheet flex w-[min(100vw-2rem,28rem)] flex-col overflow-hidden rounded-xl border shadow-[0_16px_48px_rgb(29_4_50/0.14)] ${
            expanded ? 'border-sidebar/30 ring-1 ring-sidebar/10' : 'border-sidebar/18'
          }`}
        >
          <div className="flex shrink-0 cursor-grab items-center justify-between gap-2 border-b border-sidebar/12 bg-mushroom/30 px-3 py-1.5 active:cursor-grabbing">
            <span
              className={`min-w-0 truncate text-[10px] font-display font-semibold uppercase tracking-[0.18em] ${
                expanded ? 'text-sidebar' : 'text-sidebar/70'
              }`}
            >
              Drag · {expanded ? 'your move' : 'actions'}
            </span>
            <div className="flex shrink-0 items-center gap-1" data-no-drag>
              {onDockToChat ? (
                <button
                  type="button"
                  onClick={onDockToChat}
                  className="hud-tag-chip"
                  title="Dock actions in chat panel"
                >
                  In chat
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="hud-tag-chip"
              >
                Min
              </button>
            </div>
          </div>
          <div data-no-drag className="min-h-0">
            <ActionDockBody>{children}</ActionDockBody>
          </div>
        </div>
      )}
    </div>
  );
}
