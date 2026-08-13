'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/Button';

export type ConfirmOptions = {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Destructive actions use danger styling. */
  tone?: 'default' | 'danger';
};

export type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

export function useConfirm(): ConfirmFn {
  const fn = useContext(ConfirmContext);
  if (!fn) {
    throw new Error('useConfirm must be used within ConfirmProvider');
  }
  return fn;
}

type Pending = {
  options: ConfirmOptions;
  resolve: (value: boolean) => void;
};

/** Presentational confirm surface (anchored language: “popover” panel over scrim). */
export function ConfirmPopover({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  tone = 'default',
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'default' | 'danger';
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const titleId = useId();
  const descId = useId();
  const cancelRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
      }
    };
    window.addEventListener('keydown', onKey);
    const focusTarget = tone === 'danger' ? cancelRef.current : confirmRef.current;
    queueMicrotask(() => focusTarget?.focus());
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onCancel, tone]);

  if (!mounted || !open) return null;

  return createPortal(
    <div
      className="lobby-shell fixed inset-0 z-[80] flex items-end justify-center p-3 backdrop-blur-[3px] sm:items-center sm:p-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-[max(0.75rem,env(safe-area-inset-bottom))]"
      style={{ backgroundColor: 'rgb(var(--ink-overlay) / 0.55)' }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        className="w-full max-w-sm overflow-hidden rounded-2xl border border-sidebar/12 bg-white shadow-[0_18px_48px_rgb(29_4_50_/_0.2)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-sidebar/10 bg-mushroom/40 px-4 py-3.5 sm:px-5 sm:py-4">
          <h2
            id={titleId}
            className="font-display text-lg font-bold tracking-tight text-sidebar sm:text-xl"
          >
            {title}
          </h2>
          {description ? (
            <p
              id={descId}
              className="mt-1.5 text-sm leading-relaxed text-ink-strong-muted"
            >
              {description}
            </p>
          ) : null}
        </div>
        <div className="flex flex-col-reverse gap-2 p-4 sm:flex-row sm:justify-end sm:p-5">
          <Button
            ref={cancelRef}
            type="button"
            variant="ghost"
            className="min-h-10 flex-1 px-4 py-2.5 text-xs sm:flex-none sm:min-w-[6.5rem]"
            onClick={onCancel}
          >
            {cancelLabel}
          </Button>
          <Button
            ref={confirmRef}
            type="button"
            variant={tone === 'danger' ? 'danger' : 'primary'}
            className="min-h-10 flex-1 px-4 py-2.5 text-xs sm:flex-none sm:min-w-[7.5rem]"
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<Pending | null>(null);

  const confirm = useCallback<ConfirmFn>((options) => {
    return new Promise<boolean>((resolve) => {
      setPending((prev) => {
        prev?.resolve(false);
        return { options, resolve };
      });
    });
  }, []);

  const settle = useCallback((result: boolean) => {
    setPending((prev) => {
      prev?.resolve(result);
      return null;
    });
  }, []);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <ConfirmPopover
        open={pending != null}
        title={pending?.options.title ?? ''}
        description={pending?.options.description}
        confirmLabel={pending?.options.confirmLabel}
        cancelLabel={pending?.options.cancelLabel}
        tone={pending?.options.tone}
        onConfirm={() => settle(true)}
        onCancel={() => settle(false)}
      />
    </ConfirmContext.Provider>
  );
}
