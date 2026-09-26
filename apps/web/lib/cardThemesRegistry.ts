import {
  type CardFaceTheme,
  defaultCardFaceThemes,
  normalizeCardFaceThemes,
  resolveCardFaceTheme,
} from '@/lib/cardFaceTheme';

let themes: CardFaceTheme[] = defaultCardFaceThemes();
const listeners = new Set<(list: CardFaceTheme[]) => void>();

export function getConfiguredCardThemes(): CardFaceTheme[] {
  return themes;
}

export function configureCardThemes(raw: CardFaceTheme[] | null | undefined): void {
  themes = normalizeCardFaceThemes(raw ?? []);
  for (const fn of listeners) fn(themes);
}

export function subscribeCardThemes(listener: (list: CardFaceTheme[]) => void): () => void {
  listeners.add(listener);
  listener(themes);
  return () => listeners.delete(listener);
}

export function resolveActiveCardTheme(themeId: string | null | undefined): CardFaceTheme {
  return resolveCardFaceTheme(themes, themeId);
}
