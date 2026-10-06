import {
  DEFAULT_UI_LOOKS,
  normalizeUiLooks,
  resolveUiLook,
  type UiLooksConfig,
} from '@poker/protocol';

/** App chrome look. Independent of table felt color. */

export type UiTheme = 'v1' | 'v2' | 'v3';

export const UI_THEME_STORAGE_KEY = 'pokr-ui-theme';
export const UI_THEME_EVENT = 'pokr-ui-theme';
/** Admin look visibility, cached so the pre-paint script in `app/layout.tsx` can honor it. */
export const UI_LOOKS_STORAGE_KEY = 'pokr-ui-looks';
export const UI_LOOKS_EVENT = 'pokr-ui-looks';

let uiLooks: UiLooksConfig | null = null;

export function clampUiTheme(value: unknown): UiTheme {
  if (value === 'v2') return 'v2';
  if (value === 'v3') return 'v3';
  return 'v1';
}

function loadCachedUiLooks(): UiLooksConfig {
  if (typeof window === 'undefined') return DEFAULT_UI_LOOKS;
  try {
    const raw = window.localStorage.getItem(UI_LOOKS_STORAGE_KEY);
    return raw ? normalizeUiLooks(JSON.parse(raw)) : DEFAULT_UI_LOOKS;
  } catch {
    return DEFAULT_UI_LOOKS;
  }
}

/** Looks players may pick (Admin → App looks); cached copy until /api/site loads. */
export function getUiLooks(): UiLooksConfig {
  if (!uiLooks) uiLooks = loadCachedUiLooks();
  return uiLooks;
}

/** Apply admin look visibility; a hidden saved look falls back to the admin default. */
export function configureUiLooks(raw: unknown): void {
  const next = normalizeUiLooks(raw);
  uiLooks = next;
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(UI_LOOKS_STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* quota / private mode */
  }
  window.dispatchEvent(new CustomEvent(UI_LOOKS_EVENT, { detail: next }));
  applyUiTheme(loadSavedUiTheme());
}

export function subscribeUiLooks(listener: (config: UiLooksConfig) => void): () => void {
  if (typeof window === 'undefined') return () => undefined;
  const onCustom = (event: Event) => listener((event as CustomEvent<UiLooksConfig>).detail);
  window.addEventListener(UI_LOOKS_EVENT, onCustom);
  return () => window.removeEventListener(UI_LOOKS_EVENT, onCustom);
}

export function applyUiTheme(theme: UiTheme): void {
  if (typeof document === 'undefined') return;
  const next = clampUiTheme(theme);
  if (next === 'v1') {
    document.documentElement.removeAttribute('data-ui-theme');
  } else {
    document.documentElement.setAttribute('data-ui-theme', next);
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(UI_THEME_EVENT, { detail: next }));
  }
}

/** Prefer the live `html` attribute so FOUC script and Profile saves stay in sync. */
export function readActiveUiTheme(): UiTheme {
  if (typeof document !== 'undefined') {
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
    listener(resolveUiLook(getUiLooks(), event.newValue));
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

/** The look to show: the saved choice if the admin allows it, otherwise the admin default. */
export function loadSavedUiTheme(): UiTheme {
  if (typeof window === 'undefined') return 'v1';
  try {
    return resolveUiLook(getUiLooks(), window.localStorage.getItem(UI_THEME_STORAGE_KEY));
  } catch {
    return getUiLooks().defaultLook;
  }
}

export function saveUiTheme(theme: UiTheme): void {
  const next = clampUiTheme(theme);
  try {
    window.localStorage.setItem(UI_THEME_STORAGE_KEY, next);
  } catch {
    /* quota / private mode */
  }
  applyUiTheme(resolveUiLook(getUiLooks(), next));
}
