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
        className="play-chrome-control-icon text-base leading-none"
        title="More"
      >
        ⋯
      </button>
      {open && (
        <div
          id={panelId}
          role="menu"
          className="absolute right-0 top-[calc(100%+0.4rem)] z-50 min-w-[12.5rem] overflow-hidden rounded-xl border border-sidebar/12 bg-white py-1 shadow-[0_14px_40px_rgba(29,4,50,0.14)]"
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
                  ? 'bg-danger font-semibold text-cream hover:brightness-110'
                  : item.tone === 'accent'
                    ? 'text-sidebar hover:bg-sidebar/8'
                    : item.tone === 'gold'
                      ? 'text-sidebar hover:bg-sidebar/8'
                      : 'text-ink-strong hover:bg-sidebar/8'
              }`}
            >
              {item.label}
            </button>
          ))}
          {footer ? <div className="border-t border-sidebar/10 px-3 py-2">{footer}</div> : null}
        </div>
      )}
    </div>
  );
}
