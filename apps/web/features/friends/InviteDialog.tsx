'use client';

import { useEffect, useId, useRef, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { useModalFocus } from '@/lib/useModalFocus';
import { XIcon } from './icons';

/** Centered invite popup: close X, icon, title, one-line description, body. */
export function InviteDialog({
  open,
  onClose,
  icon,
  title,
  description,
  initialFocusRef,
  children,
}: {
  open: boolean;
  onClose: () => void;
  icon: ReactNode;
  title: string;
  description: string;
  /** Element to focus on open; defaults to the first focusable (the close button). */
  initialFocusRef?: RefObject<HTMLElement | null>;
  children: ReactNode;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descId = useId();
  useModalFocus({ open, containerRef: dialogRef, initialFocusRef, onClose });

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open || typeof document === 'undefined') return null;
  // Portal to <body>: a transformed/blurred ancestor would otherwise trap `fixed` inside the content column.
  return createPortal(
    <div
      className="lobby-paper fixed inset-0 z-[60] flex items-end justify-center bg-overlay/55 p-3 backdrop-blur-[3px] sm:items-center sm:p-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-[max(0.75rem,env(safe-area-inset-bottom))]"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        tabIndex={-1}
        className="surface-modal relative flex max-h-[min(85dvh,36rem)] w-full max-w-sm flex-col overflow-y-auto px-5 pb-5 pt-6"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-3 top-3 rounded-lg p-1.5 text-muted transition hover:bg-sidebar/10 hover:text-primary"
        >
          <XIcon className="h-5 w-5" />
        </button>
        <div className="flex flex-col items-center text-center">
          <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-sidebar/10 text-sidebar">
            {icon}
          </div>
          <h2 id={titleId} className="font-display text-xl font-bold text-sidebar">
            {title}
          </h2>
          <p id={descId} className="mt-1.5 text-sm leading-relaxed text-muted">
            {description}
          </p>
        </div>
        <div className="mt-5">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
