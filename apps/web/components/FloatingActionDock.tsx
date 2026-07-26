'use client';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react';

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

/** Draggable floating dock for action CTAs — pops open on your turn. */
export function FloatingActionDock({
  children,
  expanded,
  label = 'Actions',
}: {
  children: ReactNode;
  /** When true, panel is expanded (your turn). */
  expanded: boolean;
  label?: string;
}) {
  const [pos, setPos] = useState<Pos | null>(null);
  const [open, setOpen] = useState(expanded);
  const dragging = useRef(false);
  const origin = useRef({ px: 0, py: 0, x: 0, y: 0 });
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setPos(loadPos());
  }, []);

  useEffect(() => {
    if (expanded) setOpen(true);
  }, [expanded]);

  const onPointerDown = useCallback((e: ReactPointerEvent) => {
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
  }, [pos]);

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
              ? 'border-felt-neon/50 bg-ink/95 text-felt-neon animate-hud-pulse'
              : 'border-cream/25 bg-ink/90 text-cream/70'
          }`}
        >
          {expanded ? 'Your move' : label}
        </button>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-gold/35 bg-ink/95 shadow-[0_12px_40px_rgba(0,0,0,0.55)] backdrop-blur-md animate-in fade-in zoom-in-95 duration-200">
          <div className="flex cursor-grab items-center justify-between gap-3 border-b border-cream/10 bg-ink-panel/80 px-3 py-2 active:cursor-grabbing">
            <span className="text-[10px] font-display uppercase tracking-[0.22em] text-cream/45">
              Drag · actions
            </span>
            <button
              type="button"
              data-no-drag
              onClick={() => setOpen(false)}
              className="rounded border border-cream/15 px-2 py-0.5 text-[10px] uppercase tracking-wider text-cream/50 hover:text-cream"
            >
              Min
            </button>
          </div>
          <div data-no-drag className="max-h-[min(55vh,28rem)] overflow-y-auto">
            {children}
          </div>
        </div>
      )}
    </div>
  );
}
