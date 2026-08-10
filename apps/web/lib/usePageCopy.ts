'use client';

import { useEffect, useState } from 'react';
import { fetchPublicSite } from '@/lib/api';
import {
  DEFAULT_PAGES_COPY,
  type PageCopy,
  type PageCopyKey,
  type PagesCopy,
} from '@/lib/pageCopy';

/**
 * Loads title/subtitle for a lobby page from /api/site (admin “Pages”).
 * Renders defaults immediately; updates when config arrives.
 */
export function usePageCopy(key: PageCopyKey): PageCopy {
  const [copy, setCopy] = useState<PageCopy>(() => DEFAULT_PAGES_COPY[key]);

  useEffect(() => {
    let cancelled = false;
    void fetchPublicSite()
      .then((data) => {
        if (cancelled) return;
        const pages = data.pages as PagesCopy | undefined;
        const next = pages?.[key];
        if (next?.title && next?.subtitle) {
          setCopy({ title: next.title, subtitle: next.subtitle });
        }
      })
      .catch(() => {
        /* keep defaults */
      });
    return () => {
      cancelled = true;
    };
  }, [key]);

  return copy;
}
