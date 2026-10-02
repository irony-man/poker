'use client';

import { useEffect, useRef, useState } from 'react';
import { loadGoogleIdentity, resolveGoogleClientId, type GsiButtonConfig } from '@/lib/googleIdentity';

/**
 * Google's official "Sign in with Google" button (GIS). Renders nothing when no
 * Google client id is configured, so password auth keeps working on its own.
 */
export function GoogleSignInButton({
  onCredential,
  onError,
  text = 'continue_with',
  disabled = false,
  onAvailable,
}: {
  onCredential: (idToken: string) => void;
  onError?: (message: string) => void;
  text?: GsiButtonConfig['text'];
  disabled?: boolean;
  /** Called once we know whether the button can render (for "or" dividers). */
  onAvailable?: (available: boolean) => void;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [available, setAvailable] = useState<boolean | null>(null);
  const handlers = useRef({ onCredential, onError, onAvailable });
  handlers.current = { onCredential, onError, onAvailable };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const clientId = await resolveGoogleClientId();
      if (cancelled) return;
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
          use_fedcm_for_button: true,
          callback: (response) => {
            if (response.credential) handlers.current.onCredential(response.credential);
            else handlers.current.onError?.('Google sign-in was cancelled');
          },
        });
        const width = Math.min(400, Math.max(200, Math.floor(hostRef.current.clientWidth || 320)));
        hostRef.current.innerHTML = '';
        gsi.renderButton(hostRef.current, {
          type: 'standard',
          theme: 'outline',
          size: 'large',
          shape: 'pill',
          text,
          logo_alignment: 'center',
          width,
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
  }, [text]);

  if (available === false) return null;

  return (
    <div
      className={disabled ? 'pointer-events-none opacity-60' : undefined}
      aria-busy={available === null}
    >
      <div ref={hostRef} className="flex min-h-11 w-full justify-center" />
    </div>
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
