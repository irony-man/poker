/** App chrome look. Independent of table felt color. */

export type UiTheme = 'v1' | 'v2';

export const UI_THEME_STORAGE_KEY = 'pokr-ui-theme';
export const UI_THEME_EVENT = 'pokr-ui-theme';

export function clampUiTheme(value: unknown): UiTheme {
  return value === 'v2' ? 'v2' : 'v1';
}

export function applyUiTheme(theme: UiTheme): void {
  if (typeof document === 'undefined') return;
  const next = clampUiTheme(theme);
  if (next === 'v2') {
    document.documentElement.setAttribute('data-ui-theme', 'v2');
  } else {
    document.documentElement.removeAttribute('data-ui-theme');
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(UI_THEME_EVENT, { detail: next }));
  }
}

/** Prefer the live `html` attribute so FOUC script and Profile saves stay in sync. */
export function readActiveUiTheme(): UiTheme {
  if (typeof document !== 'undefined') {
    if (document.documentElement.getAttribute('data-ui-theme') === 'v2') return 'v2';
    if (document.documentElement.hasAttribute('data-ui-theme')) {
      return clampUiTheme(document.documentElement.getAttribute('data-ui-theme'));
    }
  }
  return loadSavedUiTheme();
}

export function subscribeUiTheme(listener: (theme: UiTheme) => void): () => void {
  if (typeof window === 'undefined') return () => undefined;
  const onCustom = (event: Event) => {
    listener(clampUiTheme((event as CustomEvent).detail));
  };
  const onStorage = (event: StorageEvent) => {
    if (event.key !== UI_THEME_STORAGE_KEY) return;
    listener(clampUiTheme(event.newValue));
  };
  const onMutation = () => listener(readActiveUiTheme());
  window.addEventListener(UI_THEME_EVENT, onCustom);
  window.addEventListener('storage', onStorage);
  const observer = new MutationObserver(onMutation);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-ui-theme'],
  });
  return () => {
    window.removeEventListener(UI_THEME_EVENT, onCustom);
    window.removeEventListener('storage', onStorage);
    observer.disconnect();
  };
}

export function loadSavedUiTheme(): UiTheme {
  if (typeof window === 'undefined') return 'v1';
  try {
    return clampUiTheme(window.localStorage.getItem(UI_THEME_STORAGE_KEY));
  } catch {
    return 'v1';
  }
}

export function saveUiTheme(theme: UiTheme): void {
  const next = clampUiTheme(theme);
  try {
    window.localStorage.setItem(UI_THEME_STORAGE_KEY, next);
  } catch {
    /* quota / private mode */
  }
  applyUiTheme(next);
}
