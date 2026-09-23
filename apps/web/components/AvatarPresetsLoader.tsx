'use client';

import { useEffect } from 'react';
import { fetchPublicSite } from '@/lib/api';
import { configureAvatarPresets, DEFAULT_AVATAR_PRESET_URLS } from '@/lib/avatars';

/** Load site-configured profile preset URLs for sign-up, profile, and tables. */
export function AvatarPresetsLoader() {
  useEffect(() => {
    let cancelled = false;
    const load = () => {
      void fetchPublicSite()
        .then((site) => {
          if (cancelled) return;
          configureAvatarPresets(
            site.avatarPresets ?? { urls: [...DEFAULT_AVATAR_PRESET_URLS] },
          );
        })
        .catch(() => {
          if (cancelled) return;
          configureAvatarPresets({ urls: [...DEFAULT_AVATAR_PRESET_URLS] });
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
