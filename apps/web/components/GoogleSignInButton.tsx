'use client';

import { useEffect, useRef, useState } from 'react';
import { GOOGLE_CLIENT_ID, loadGoogleIdentity, type GsiButtonConfig } from '@/lib/googleIdentity';

/**
 * Google's official "Sign in with Google" button (GIS). Renders nothing when no
 * Google client id is configured, so password auth keeps working on its own.
 * Icon layout draws the G ourselves as a placeholder until the GIS icon renders on
 * top. The GIS iframe must stay visible: Chrome ignores clicks on a hidden or
 * covered Google button (clickjacking protection).
 */
export function GoogleSignInButton({
  onCredential,
  onError,
  text = 'continue_with',
  disabled = false,
  onAvailable,
  layout = 'full',
}: {
  onCredential: (idToken: string) => void;
  onError?: (message: string) => void;
  text?: GsiButtonConfig['text'];
  disabled?: boolean;
  /** Called once we know whether the button can render (for "or" dividers). */
  onAvailable?: (available: boolean) => void;
  layout?: 'full' | 'icon';
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [available, setAvailable] = useState<boolean | null>(null);
  const handlers = useRef({ onCredential, onError, onAvailable });
  handlers.current = { onCredential, onError, onAvailable };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const clientId = GOOGLE_CLIENT_ID;
      if (!clientId) {
        setAvailable(false);
        handlers.current.onAvailable?.(false);
        return;
      }
      try {
        const gsi = await loadGoogleIdentity();
        if (cancelled || !hostRef.current) return;
        gsi.initialize({
          client_id: clientId,
          ux_mode: 'popup',
          cancel_on_tap_outside: true,
          use_fedcm_for_button: layout !== 'icon',
          callback: (response) => {
            if (response.credential) handlers.current.onCredential(response.credential);
            else handlers.current.onError?.('Google sign-in was cancelled');
          },
        });
        hostRef.current.innerHTML = '';
        const icon = layout === 'icon';
        gsi.renderButton(hostRef.current, {
          type: icon ? 'icon' : 'standard',
          theme: 'outline',
          size: 'large',
          shape: icon ? 'circle' : 'pill',
          text,
          logo_alignment: 'center',
          ...(icon
            ? {}
            : {
                width: Math.min(400, Math.max(200, Math.floor(hostRef.current.clientWidth || 320))),
              }),
        });
        setAvailable(true);
        handlers.current.onAvailable?.(true);
      } catch (err) {
        if (cancelled) return;
        setAvailable(false);
        handlers.current.onAvailable?.(false);
        handlers.current.onError?.(err instanceof Error ? err.message : 'Google sign-in failed to load');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [text, layout]);

  if (available === false) return null;

  if (layout === 'icon') {
    return (
      <div
        className={`relative h-10 w-10 shrink-0 ${disabled ? 'pointer-events-none opacity-60' : ''}`}
        aria-busy={available === null}
      >
        <span
          className="pointer-events-none absolute inset-0 z-0 flex items-center justify-center rounded-full border border-sidebar/15 bg-white shadow-sm"
          aria-hidden
        >
          <GoogleG />
        </span>
        <div
          ref={hostRef}
          className={`absolute inset-0 z-10 flex items-center justify-center ${available ? '' : 'opacity-0'}`}
          title="Continue with Google"
        />
      </div>
    );
  }

  return (
    <div
      className={disabled ? 'pointer-events-none opacity-60' : undefined}
      aria-busy={available === null}
    >
      <div ref={hostRef} className="flex min-h-11 w-full justify-center" />
    </div>
  );
}

export function GoogleG() {
  return (
    <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20.4H24v7.2h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 8 3l5.1-5.1C33.7 6.1 29.1 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20c11.3 0 20.9-8.2 20.9-20 0-1.3-.1-2.3-.3-3.5z"
      />
      <path
        fill="#FF3D00"
        d="M6.3 14.7 12.2 19C13.8 14.9 18.5 12 24 12c3.1 0 5.8 1.1 8 3l5.1-5.1C33.7 6.1 29.1 4 24 4 16.3 4 9.6 8.3 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.1 35.3 26.7 36 24 36c-5.3 0-9.7-3.3-11.3-8l-6 4.6C10 39.6 16.5 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20.4H24v7.2h11.3c-1.1 3.1-3.5 5.5-6.1 6.9l.1.1 6.2 5.2C37.2 41.3 44.9 36 44.9 24c0-1.3-.1-2.3-.3-3.5z"
      />
    </svg>
  );
}

export function OrDivider({ label = 'or' }: { label?: string }) {
  return (
    <div className="flex items-center gap-3 text-xs uppercase tracking-[0.12em] text-muted" role="separator">
      <span className="h-px flex-1 bg-sidebar/15" />
      {label}
      <span className="h-px flex-1 bg-sidebar/15" />
    </div>
  );
}
