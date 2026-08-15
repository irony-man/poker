'use client';

import { useEffect, useState } from 'react';
import { fetchPublicSite, type PagesByTheme, type PagesCopy } from '@/lib/api';
import {
  DEFAULT_PAGES_COPY,
  type PageCopy,
  type PageCopyKey,
} from '@/lib/pageCopy';
import { pickPagesForTheme } from '@/lib/themeCopy';
import { useUiTheme } from '@/lib/useUiTheme';

/**
 * Loads title/subtitle for a lobby page from /api/site (admin “Pages”).
 * Renders defaults immediately; updates when config arrives or the look changes.
 */
export function usePageCopy(key: PageCopyKey): PageCopy {
  const uiTheme = useUiTheme();
  const [pagesByTheme, setPagesByTheme] = useState<Partial<PagesByTheme> | undefined>();
  const [pages, setPages] = useState<PagesCopy | undefined>();

  useEffect(() => {
    let cancelled = false;
    void fetchPublicSite()
      .then((data) => {
        if (cancelled) return;
        setPagesByTheme(data.pagesByTheme);
        setPages(data.pages);
      })
      .catch(() => {
        /* keep defaults */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const bag = pickPagesForTheme(pagesByTheme, pages, uiTheme);
  const next = bag?.[key];
  if (next?.title && next?.subtitle) {
    return { title: next.title, subtitle: next.subtitle };
  }
  return DEFAULT_PAGES_COPY[key];
}
