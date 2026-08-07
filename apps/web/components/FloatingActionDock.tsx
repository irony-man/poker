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

/**
 * Mobile portrait: dual-height dock.
 * Mobile landscape: slim single-row strip.
 * Desktop: undocked floating / draggable popup.
 */
export function FloatingActionDock({
  children,
  expanded,
  label = 'Actions',
}: {
  children: ReactNode;
  /** When true, it's your turn. */
  expanded: boolean;
  label?: string;
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
      const height = expanded ? 'h-[7.25rem]' : 'h-[2.35rem]';
      return (
        <div className="relative z-40 shrink-0 border-t border-black/80 bg-black/95 px-1 pb-[max(0.15rem,env(safe-area-inset-bottom))] pt-0.5 shadow-[0_-8px_24px_rgba(0,0,0,0.55)]">
          <div
            className={`mx-auto flex w-full max-w-5xl flex-col overflow-hidden transition-[height] duration-200 ${height}`}
          >
            <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
          </div>
        </div>
      );
    }

    const height = expanded ? 'h-[10.75rem]' : 'h-[3.75rem]';

    return (
      <div
        className={`relative z-40 shrink-0 border-t px-1.5 pb-[max(0.25rem,env(safe-area-inset-bottom))] pt-1 ${
          expanded
            ? 'border-mushroom/35 bg-ink/98 shadow-[0_-6px_20px_rgba(14,6,24,0.4)]'
            : 'border-mushroom/12 bg-ink/95'
        }`}
      >
        <div
          className={`mx-auto flex w-full max-w-4xl flex-col overflow-hidden rounded-xl border transition-[height] duration-200 ${height} ${
            expanded
              ? 'border-mushroom/40 bg-ink-panel/95 ring-1 ring-mushroom/20'
              : 'border-mushroom/15 bg-ink-panel/80'
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
          className={`rounded-full border px-5 py-3 text-xs font-display font-bold uppercase tracking-[0.18em] shadow-hud backdrop-blur ${
            expanded
              ? 'border-mushroom/50 bg-ink/95 text-mushroom animate-hud-pulse'
              : 'border-mushroom/25 bg-ink/90 text-cream/70'
          }`}
        >
          {expanded ? 'Your move' : label}
        </button>
      ) : (
        <div
          className={`overflow-hidden rounded-2xl border bg-ink/95 shadow-[0_12px_40px_rgba(14,6,24,0.55)] backdrop-blur-md ${
            expanded ? 'border-mushroom/45 ring-1 ring-mushroom/20' : 'border-mushroom/30'
          }`}
        >
          <div className="flex cursor-grab items-center justify-between gap-3 border-b border-mushroom/12 bg-ink-panel/80 px-3 py-2 active:cursor-grabbing">
            <span
              className={`text-[10px] font-display uppercase tracking-[0.22em] ${
                expanded ? 'text-mushroom' : 'text-cream/45'
              }`}
            >
              Drag · {expanded ? 'your move' : 'actions'}
            </span>
            <button
              type="button"
              data-no-drag
              onClick={() => setOpen(false)}
              className="rounded border border-mushroom/20 px-2 py-0.5 text-[10px] uppercase tracking-wider text-cream/50 hover:text-cream"
            >
              Min
            </button>
          </div>
          <div
            data-no-drag
            className="flex max-h-[min(50vh,24rem)] min-h-[11rem] w-[min(100vw-2rem,28rem)] flex-col overflow-y-auto"
          >
            <div className="flex min-h-[11rem] w-full flex-1 flex-col">{children}</div>
          </div>
        </div>
      )}
    </div>
  );
}
