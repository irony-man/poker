'use client';

import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/Button';

export type OverflowItem = {
  id: string;
  label: string;
  onClick: () => void;
  tone?: 'default' | 'danger' | 'accent' | 'gold';
  disabled?: boolean;
};

function itemClass(tone: OverflowItem['tone']): string {
  const base =
    'flex w-full items-center gap-2 px-3.5 py-2.5 text-left text-sm font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-sidebar disabled:pointer-events-none disabled:opacity-40';
  if (tone === 'danger') {
    return `${base} font-semibold text-danger hover:bg-danger/10 focus-visible:bg-danger/10`;
  }
  if (tone === 'accent' || tone === 'gold') {
    return `${base} text-sidebar hover:bg-sidebar/8 focus-visible:bg-sidebar/8`;
  }
  return `${base} text-ink-strong hover:bg-sidebar/8 focus-visible:bg-sidebar/8`;
}

/** Compact ⋯ menu for table / play chrome. */
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

  if (items.length === 0 && !footer) return null;

  // Split non-destructive vs destructive so danger actions sit in a separate band.
  const primary = items.filter((i) => i.tone !== 'danger');
  const destructive = items.filter((i) => i.tone === 'danger');

  return (
    <div ref={rootRef} className="relative">
      <Button
        type="button"
        variant="chrome"
        size="icon"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
        className="text-base leading-none"
        title="More"
      >
        ⋯
      </Button>
      {open && (
        <div
          id={panelId}
          role="menu"
          className="glass-sheet absolute right-0 top-[calc(100%+0.4rem)] z-50 min-w-[13rem] overflow-hidden rounded-xl border border-sidebar/12 py-1 shadow-[0_14px_40px_rgba(29,4,50,0.14)]"
        >
          {primary.map((item) => (
            <button
              key={item.id}
              type="button"
              role="menuitem"
              disabled={item.disabled}
              onClick={() => {
                item.onClick();
                setOpen(false);
              }}
              className={itemClass(item.tone)}
            >
              {item.label}
            </button>
          ))}
          {destructive.length > 0 && primary.length > 0 ? (
            <div className="my-1 border-t border-sidebar/10" role="separator" />
          ) : null}
          {destructive.map((item) => (
            <button
              key={item.id}
              type="button"
              role="menuitem"
              disabled={item.disabled}
              onClick={() => {
                item.onClick();
                setOpen(false);
              }}
              className={itemClass('danger')}
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
