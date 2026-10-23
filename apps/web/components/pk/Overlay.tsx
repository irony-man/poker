'use client';

import { useRef, type ReactNode } from 'react';
import { useModalFocus } from '@/lib/useModalFocus';
import { cn } from '@/lib/cn';
import { PkButton } from './Button';

export function PkDialog({
  open,
  title,
  onClose,
  children,
  labelledBy,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  labelledBy?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useModalFocus({ open, containerRef: ref, onClose });
  if (!open) return null;
  const titleId = labelledBy ?? 'pk-dialog-title';
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-pk-4">
      <button type="button" className="absolute inset-0 bg-chrome/50" aria-label="Close dialog" onClick={onClose} />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative z-10 w-full max-w-lg rounded-pk-xl bg-panel p-pk-6 shadow-pk-lg"
      >
        <div className="mb-pk-4 flex items-start justify-between gap-pk-3">
          <h2 id={titleId} className="font-pk-display text-pk-h3">
            {title}
          </h2>
          <PkButton variant="icon" aria-label="Close" onClick={onClose}>
            ×
          </PkButton>
        </div>
        {children}
      </div>
    </div>
  );
}

/** Bottom sheet on portrait phones. Side sheet when `side` is set (landscape). */
export function PkSheet({
  open,
  title,
  onClose,
  children,
  side = false,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  side?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useModalFocus({ open, containerRef: ref, onClose });
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <button type="button" className="absolute inset-0 bg-chrome/50" aria-label="Close sheet" onClick={onClose} />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          'relative z-10 w-full bg-panel p-pk-4 shadow-pk-lg',
          side
            ? 'ml-auto h-full max-w-sm rounded-none'
            : 'max-h-[85dvh] overflow-auto rounded-t-pk-2xl sm:max-w-md sm:rounded-pk-xl',
        )}
      >
        <div className="mx-auto mb-pk-3 h-1.5 w-10 rounded-pk-full bg-subtle/40" aria-hidden />
        <div className="mb-pk-3 flex items-center justify-between">
          <h2 className="font-pk-display text-pk-h4">{title}</h2>
          <PkButton variant="icon" aria-label="Close" onClick={onClose}>
            ×
          </PkButton>
        </div>
        {children}
      </div>
    </div>
  );
}

export function PkConfirm({
  open,
  title,
  body,
  confirmLabel,
  onConfirm,
  onClose,
  danger,
}: {
  open: boolean;
  title: string;
  body: string;
  confirmLabel: string;
  onConfirm: () => void;
  onClose: () => void;
  danger?: boolean;
}) {
  return (
    <PkDialog open={open} title={title} onClose={onClose}>
      <p className="text-pk-body-md text-muted">{body}</p>
      <div className="mt-pk-5 flex justify-end gap-pk-2">
        <PkButton variant="ghost" onClick={onClose}>
          Cancel
        </PkButton>
        <PkButton variant={danger ? 'danger' : 'primary'} onClick={onConfirm}>
          {confirmLabel}
        </PkButton>
      </div>
    </PkDialog>
  );
}
