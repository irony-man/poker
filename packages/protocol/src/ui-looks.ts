import type { UiTheme } from './messages.js';

/** Admin-controlled App looks: which ones players can pick, and the fallback / new-player default. */
export interface UiLooksConfig {
  /** Canonical order (`UI_LOOK_IDS`); never empty. */
  visible: UiTheme[];
  /** Always one of `visible`. */
  defaultLook: UiTheme;
}

export const UI_LOOK_IDS: readonly UiTheme[] = ['v1', 'v2', 'v3'] as const;

export const UI_LOOK_LABELS: Record<UiTheme, string> = {
  v1: 'Classic',
  v2: 'Arcade',
  v3: 'Glass',
};

export const DEFAULT_UI_LOOKS: UiLooksConfig = {
  visible: [...UI_LOOK_IDS],
  defaultLook: 'v1',
};

export function isUiLookId(value: unknown): value is UiTheme {
  return typeof value === 'string' && (UI_LOOK_IDS as readonly string[]).includes(value);
}

export function cloneUiLooks(config: UiLooksConfig): UiLooksConfig {
  return { visible: [...config.visible], defaultLook: config.defaultLook };
}

/** Unknown ids are dropped; an empty list means every look; a hidden default becomes the first visible look. */
export function normalizeUiLooks(raw: unknown): UiLooksConfig {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return cloneUiLooks(DEFAULT_UI_LOOKS);
  const o = raw as Record<string, unknown>;
  const requested = Array.isArray(o.visible) ? o.visible.filter(isUiLookId) : [];
  const visible = UI_LOOK_IDS.filter((id) => requested.includes(id));
  const list = visible.length > 0 ? visible : [...UI_LOOK_IDS];
  const defaultLook =
    isUiLookId(o.defaultLook) && list.includes(o.defaultLook) ? o.defaultLook : list[0]!;
  return { visible: list, defaultLook };
}

/** The look a player actually sees: their choice if it is visible, otherwise the default. */
export function resolveUiLook(config: UiLooksConfig, choice: unknown): UiTheme {
  return isUiLookId(choice) && config.visible.includes(choice) ? choice : config.defaultLook;
}
