'use client';

import { useToasts, type ToastItem, type ToastKind } from '@/lib/toast';

const KIND_STYLES: Record<
  ToastKind,
  { border: string; tint: string; label: string; labelText: string; bar: string }
> = {
  error: {
    border: 'border-danger/35',
    tint: 'bg-danger/10',
    label: 'text-danger',
    labelText: 'Notice',
    bar: 'bg-danger',
  },
  success: {
    border: 'border-sidebar/30',
    tint: 'bg-sidebar/8',
    label: 'text-sidebar',
    labelText: 'Done',
    bar: 'bg-sidebar',
  },
  info: {
    border: 'border-mushroom/40',
    tint: 'bg-mushroom/10',
    label: 'text-muted',
    labelText: 'Info',
    bar: 'bg-mushroom',
  },
};

function ToastCard({ item, onDismiss }: { item: ToastItem; onDismiss: () => void }) {
  const style = KIND_STYLES[item.kind];
  return (
    <div
      role={item.kind === 'error' ? 'alert' : 'status'}
      aria-live={item.kind === 'error' ? 'assertive' : 'polite'}
      aria-atomic="true"
      className={`glass-sheet pointer-events-auto w-full max-w-[17.5rem] overflow-hidden rounded-xl border ${style.border} bg-[rgb(255_252_250_/0.97)] shadow-[0_10px_32px_rgb(29_4_50/0.24),0_1px_0_rgb(255_255_255/0.65)_inset] backdrop-blur-xl ${
        item.leaving ? 'app-toast-out' : 'app-toast-in'
      }`}
    >
      <div className={`flex items-start gap-2.5 px-3 py-2.5 ${style.tint}`}>
        <div className="min-w-0 flex-1">
          <p
            className={`text-[10px] font-display font-bold uppercase tracking-[0.14em] ${style.label}`}
          >
            {item.title ?? style.labelText}
          </p>
          <p className="mt-0.5 text-sm font-semibold leading-snug text-primary">{item.message}</p>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-base leading-none text-muted transition hover:bg-white/70 hover:text-sidebar"
          aria-label="Dismiss notification"
        >
          ×
        </button>
      </div>
      <div className="h-0.5 w-full bg-sidebar/10">
        <div
          key={`bar-${item.shownAt}`}
          className={`app-toast-bar h-full origin-left ${style.bar}`}
          style={{ animationDuration: `${item.durationMs}ms` }}
        />
      </div>
    </div>
  );
}

/** App-wide notification stack (top-right). Push via `toast.*` from `@/lib/toast`. */
export function ToastViewport() {
  const items = useToasts((s) => s.items);
  const dismiss = useToasts((s) => s.dismiss);

  if (items.length === 0) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[80] flex flex-col items-end gap-2 px-3 pt-[max(0.65rem,env(safe-area-inset-top))] sm:px-4 sm:pt-3">
      {items.map((item) => (
        <ToastCard key={item.id} item={item} onDismiss={() => dismiss(item.id)} />
      ))}
    </div>
  );
}
