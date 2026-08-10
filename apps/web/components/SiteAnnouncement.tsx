'use client';

import { useEffect, useState } from 'react';
import { fetchPublicSite } from '@/lib/api';

const POLL_MS = 45_000;

/** Site-wide announcement bar from admin-managed `/api/site`. */
export function SiteAnnouncementBanner() {
  const [text, setText] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const data = await fetchPublicSite();
        if (cancelled) return;
        const t = data.announcement?.text?.trim() ?? '';
        setText(data.announcement?.enabled && t ? t : null);
      } catch {
        if (!cancelled) setText(null);
      }
    }

    void load();
    const id = window.setInterval(() => void load(), POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  if (!text) return null;

  return (
    <div
      role="status"
      className="mb-4 border border-brass/25 bg-brass/10 px-3 py-2 text-center text-sm text-ink-strong sm:mb-5"
    >
      <p className="mx-auto max-w-3xl whitespace-pre-wrap leading-snug">{text}</p>
    </div>
  );
}
