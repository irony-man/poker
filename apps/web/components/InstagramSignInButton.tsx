'use client';

import { useEffect, useId, useState } from 'react';
import { startInstagramAuth } from '@/lib/api';
import { currentPathWithQuery } from '@/lib/authRedirect';
import { readStoredSession } from '@/lib/session';

/** Baked at build time; set only when the server has `INSTAGRAM_APP_ID` + `INSTAGRAM_APP_SECRET`. */
const INSTAGRAM_ENABLED = process.env.NEXT_PUBLIC_INSTAGRAM_ENABLED?.trim() === 'true';

export function InstagramSignInButton({
  next,
  intent = 'login',
  disabled = false,
  onError,
  onAvailable,
  label,
  layout = 'full',
}: {
  next?: string;
  intent?: 'login' | 'link';
  disabled?: boolean;
  onError?: (message: string) => void;
  onAvailable?: (available: boolean) => void;
  label?: string;
  layout?: 'full' | 'icon';
}) {
  const available = INSTAGRAM_ENABLED;
  const [busy, setBusy] = useState(false);
  const gradientId = useId().replace(/:/g, '');

  useEffect(() => {
    onAvailable?.(available);
  }, [available, onAvailable]);

  if (!available) return null;

  const caption = label ?? 'Continue with Instagram';

  async function onClick() {
    setBusy(true);
    try {
      const sessionToken = intent === 'link' ? readStoredSession()?.sessionToken : undefined;
      const url = await startInstagramAuth({
        next: next ?? currentPathWithQuery(),
        intent,
        sessionToken,
      });
      window.location.assign(url);
    } catch (err) {
      setBusy(false);
      onError?.(err instanceof Error ? err.message : 'Instagram sign-in failed');
    }
  }

  const icon = <InstagramGlyph gradientId={gradientId} />;

  if (layout === 'icon') {
    return (
      <button
        type="button"
        disabled={disabled || busy}
        onClick={() => void onClick()}
        aria-label={busy ? 'Redirecting to Instagram' : caption}
        title={caption}
        className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-sidebar/15 bg-white shadow-sm hover:bg-zinc-50 disabled:opacity-60"
      >
        {icon}
      </button>
    );
  }

  return (
    <button
      type="button"
      disabled={disabled || busy}
      onClick={() => void onClick()}
      className="flex min-h-11 w-full items-center justify-center gap-2 rounded-full border border-sidebar/15 bg-white px-4 text-sm font-semibold text-zinc-900 shadow-sm hover:bg-zinc-50 disabled:opacity-60"
    >
      {icon}
      {busy ? 'Redirecting…' : caption}
    </button>
  );
}

export function InstagramGlyph({ gradientId }: { gradientId: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
      <defs>
        <radialGradient id={gradientId} cx="30%" cy="107%" r="150%">
          <stop offset="0%" stopColor="#fdf497" />
          <stop offset="5%" stopColor="#fdf497" />
          <stop offset="45%" stopColor="#fd5949" />
          <stop offset="60%" stopColor="#d6249f" />
          <stop offset="90%" stopColor="#285AEB" />
        </radialGradient>
      </defs>
      <path
        fill={`url(#${gradientId})`}
        d="M7 2h10a5 5 0 0 1 5 5v10a5 5 0 0 1-5 5H7a5 5 0 0 1-5-5V7a5 5 0 0 1 5-5zm0 2a3 3 0 0 0-3 3v10a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3V7a3 3 0 0 0-3-3H7zm11.25 1.5a1.25 1.25 0 1 1 0 2.5 1.25 1.25 0 0 1 0-2.5zM12 7a5 5 0 1 1 0 10 5 5 0 0 1 0-10zm0 2a3 3 0 1 0 0 6 3 3 0 0 0 0-6z"
      />
    </svg>
  );
}
