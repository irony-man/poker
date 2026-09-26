'use client';

import { useEffect } from 'react';
import { fetchPublicSite } from '@/lib/api';
import { configureCardThemes } from '@/lib/cardThemesRegistry';
import { defaultCardFaceThemes } from '@/lib/cardFaceTheme';

/** Load site-configured card face themes for tables and profile picker. */
export function CardThemesLoader() {
  useEffect(() => {
    let cancelled = false;
    const load = () => {
      void fetchPublicSite()
        .then((site) => {
          if (cancelled) return;
          configureCardThemes(site.cardThemes ?? defaultCardFaceThemes());
        })
        .catch(() => {
          if (cancelled) return;
          configureCardThemes(defaultCardFaceThemes());
        });
    };
    load();
    window.addEventListener('focus', load);
    return () => {
      cancelled = true;
      window.removeEventListener('focus', load);
    };
  }, []);
  return null;
}
