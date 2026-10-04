import { create } from 'zustand';

export type ToastKind = 'error' | 'success' | 'info';

export type ToastItem = {
  id: number;
  kind: ToastKind;
  message: string;
  title?: string;
  durationMs: number;
  /** Bumped when a duplicate refreshes this toast (restarts the progress bar). */
  shownAt: number;
  leaving: boolean;
};

export type ToastOptions = {
  title?: string;
  durationMs?: number;
};

export const TOAST_DEFAULT_MS = 5_000;
export const TOAST_EXIT_MS = 280;
export const TOAST_VISIBLE_CAP = 4;

type ToastState = {
  items: ToastItem[];
  push: (kind: ToastKind, message: string, options?: ToastOptions) => number;
  dismiss: (id: number) => void;
  clear: () => void;
};

let nextId = 1;
const timers = new Map<number, ReturnType<typeof setTimeout>[]>();

function clearTimers(id: number) {
  for (const t of timers.get(id) ?? []) clearTimeout(t);
  timers.delete(id);
}

export const useToasts = create<ToastState>((set, get) => {
  function remove(id: number) {
    clearTimers(id);
    set((s) => ({ items: s.items.filter((t) => t.id !== id) }));
  }

  function schedule(id: number, durationMs: number) {
    clearTimers(id);
    timers.set(id, [
      setTimeout(() => get().dismiss(id), Math.max(0, durationMs - TOAST_EXIT_MS)),
    ]);
  }

  return {
    items: [],

    push(kind, message, options) {
      const text = message.trim();
      if (!text) return 0;
      const durationMs = options?.durationMs ?? TOAST_DEFAULT_MS;
      const now = Date.now();

      const existing = get().items.find(
        (t) => !t.leaving && t.kind === kind && t.message === text,
      );
      if (existing) {
        set((s) => ({
          items: s.items.map((t) =>
            t.id === existing.id ? { ...t, shownAt: now, durationMs } : t,
          ),
        }));
        schedule(existing.id, durationMs);
        return existing.id;
      }

      const id = nextId++;
      const item: ToastItem = {
        id,
        kind,
        message: text,
        title: options?.title,
        durationMs,
        shownAt: now,
        leaving: false,
      };
      const next = [...get().items, item];
      const overflow = next.length - TOAST_VISIBLE_CAP;
      for (const dropped of next.slice(0, Math.max(0, overflow))) clearTimers(dropped.id);
      set({ items: overflow > 0 ? next.slice(overflow) : next });
      schedule(id, durationMs);
      return id;
    },

    dismiss(id) {
      const item = get().items.find((t) => t.id === id);
      if (!item || item.leaving) return;
      clearTimers(id);
      set((s) => ({
        items: s.items.map((t) => (t.id === id ? { ...t, leaving: true } : t)),
      }));
      timers.set(id, [setTimeout(() => remove(id), TOAST_EXIT_MS)]);
    },

    clear() {
      for (const id of timers.keys()) clearTimers(id);
      set({ items: [] });
    },
  };
});

/** Imperative API — safe outside React (e.g. from `apiFetch`). */
export const toast = {
  error: (message: string, options?: ToastOptions) =>
    useToasts.getState().push('error', message, options),
  success: (message: string, options?: ToastOptions) =>
    useToasts.getState().push('success', message, options),
  info: (message: string, options?: ToastOptions) =>
    useToasts.getState().push('info', message, options),
  dismiss: (id: number) => useToasts.getState().dismiss(id),
};
