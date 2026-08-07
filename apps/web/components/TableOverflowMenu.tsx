'use client';

import { useEffect, useId, useRef, useState, type ReactNode } from 'react';

export type OverflowItem = {
  id: string;
  label: string;
  onClick: () => void;
  tone?: 'default' | 'danger' | 'accent' | 'gold';
  disabled?: boolean;
};

/** Compact ⋯ menu for mobile table chrome. */
export function TableOverflowMenu({
  items,
  footer,
}: {
  items: OverflowItem[];
  footer?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    const onPointer = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('pointerdown', onPointer);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('pointerdown', onPointer);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
        className="flex h-11 w-11 items-center justify-center rounded-full border border-mushroom/25 bg-ink/80 text-lg font-bold text-cream/80 hover:border-mushroom/50 hover:text-mushroom"
        title="More"
      >
        ⋯
      </button>
      {open && (
        <div
          id={panelId}
          role="menu"
          className="absolute right-0 top-[calc(100%+0.35rem)] z-50 min-w-[12.5rem] overflow-hidden rounded-xl border border-mushroom/15 bg-ink-panel/95 py-1 shadow-[0_12px_40px_rgba(14,6,24,0.55)] backdrop-blur-md"
        >
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              role="menuitem"
              disabled={item.disabled}
              onClick={() => {
                item.onClick();
                setOpen(false);
              }}
              className={`flex w-full items-center px-3.5 py-2.5 text-left text-sm font-medium disabled:opacity-40 ${
                item.tone === 'danger'
                  ? 'text-red-300 hover:bg-red-950/40'
                  : item.tone === 'accent'
                    ? 'text-mushroom hover:bg-mushroom/10'
                    : item.tone === 'gold'
                      ? 'text-brass-light hover:bg-brass/10'
                      : 'text-cream/85 hover:bg-mushroom/10'
              }`}
            >
              {item.label}
            </button>
          ))}
          {footer ? <div className="border-t border-mushroom/12 px-3 py-2">{footer}</div> : null}
        </div>
      )}
    </div>
  );
}
