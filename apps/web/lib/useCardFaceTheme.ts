'use client';

import { useEffect, useState } from 'react';
import { loadSavedCardThemeId } from '@/lib/cardThemePref';
import {
  getConfiguredCardThemes,
  resolveActiveCardTheme,
  subscribeCardThemes,
} from '@/lib/cardThemesRegistry';
import type { CardFaceTheme } from '@/lib/cardFaceTheme';
import { useSession } from '@/lib/store';

export function useCardFaceTheme(): CardFaceTheme {
  const cardThemeIdFromSession = useSession((s) => s.cardThemeId);
  const [revision, setRevision] = useState(0);

  useEffect(() => subscribeCardThemes(() => setRevision((n) => n + 1)), []);

  const preferredId =
    cardThemeIdFromSession?.trim() || loadSavedCardThemeId();
  void revision;
  void getConfiguredCardThemes();
  return resolveActiveCardTheme(preferredId);
}
