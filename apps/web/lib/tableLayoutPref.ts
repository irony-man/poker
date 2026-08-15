/** In-game table layout. Independent of app chrome and felt color. */

export type TableLayout = 'v1' | 'v2';

export const TABLE_LAYOUT_STORAGE_KEY = 'pokr-table-layout';
export const TABLE_LAYOUT_EVENT = 'pokr-table-layout';

export function clampTableLayout(value: unknown): TableLayout {
  return value === 'v2' ? 'v2' : 'v1';
}

export function applyTableLayout(layout: TableLayout): void {
  if (typeof document === 'undefined') return;
  const next = clampTableLayout(layout);
  if (next === 'v2') {
    document.documentElement.setAttribute('data-table-layout', 'v2');
  } else {
    document.documentElement.removeAttribute('data-table-layout');
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(TABLE_LAYOUT_EVENT, { detail: next }));
  }
}

export function readActiveTableLayout(): TableLayout {
  if (typeof document !== 'undefined') {
    if (document.documentElement.getAttribute('data-table-layout') === 'v2') return 'v2';
    if (document.documentElement.hasAttribute('data-table-layout')) {
      return clampTableLayout(document.documentElement.getAttribute('data-table-layout'));
    }
  }
  return loadSavedTableLayout();
}

export function subscribeTableLayout(listener: (layout: TableLayout) => void): () => void {
  if (typeof window === 'undefined') return () => undefined;
  const onCustom = (event: Event) => {
    listener(clampTableLayout((event as CustomEvent).detail));
  };
  const onStorage = (event: StorageEvent) => {
    if (event.key !== TABLE_LAYOUT_STORAGE_KEY) return;
    listener(clampTableLayout(event.newValue));
  };
  const onMutation = () => listener(readActiveTableLayout());
  window.addEventListener(TABLE_LAYOUT_EVENT, onCustom);
  window.addEventListener('storage', onStorage);
  const observer = new MutationObserver(onMutation);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-table-layout'],
  });
  return () => {
    window.removeEventListener(TABLE_LAYOUT_EVENT, onCustom);
    window.removeEventListener('storage', onStorage);
    observer.disconnect();
  };
}

export function loadSavedTableLayout(): TableLayout {
  if (typeof window === 'undefined') return 'v1';
  try {
    return clampTableLayout(window.localStorage.getItem(TABLE_LAYOUT_STORAGE_KEY));
  } catch {
    return 'v1';
  }
}

export function saveTableLayout(layout: TableLayout): void {
  const next = clampTableLayout(layout);
  try {
    window.localStorage.setItem(TABLE_LAYOUT_STORAGE_KEY, next);
  } catch {
    /* quota / private mode */
  }
  applyTableLayout(next);
}
