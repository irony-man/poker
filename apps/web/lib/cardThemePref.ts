import { DEFAULT_CARD_THEME_ID } from '@/lib/cardFaceTheme';

const CARD_THEME_KEY = 'pokr-card-theme-id';

export function loadSavedCardThemeId(): string {
  try {
    const raw = localStorage.getItem(CARD_THEME_KEY);
    if (raw && raw.trim()) return raw.trim().slice(0, 64);
  } catch {
    /* ignore */
  }
  return DEFAULT_CARD_THEME_ID;
}

export function saveCardThemeId(id: string): void {
  try {
    localStorage.setItem(CARD_THEME_KEY, id.trim().slice(0, 64) || DEFAULT_CARD_THEME_ID);
  } catch {
    /* ignore */
  }
}
