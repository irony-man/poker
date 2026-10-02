import { fetchAuthConfig } from '@/lib/api/auth';

/** Minimal typing for the Google Identity Services (GIS) script we use. */
type GsiButtonConfig = {
  type?: 'standard' | 'icon';
  theme?: 'outline' | 'filled_blue' | 'filled_black';
  size?: 'large' | 'medium' | 'small';
  text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin';
  shape?: 'rectangular' | 'pill' | 'circle' | 'square';
  logo_alignment?: 'left' | 'center';
  width?: number;
};

type GsiIdApi = {
  initialize(config: {
    client_id: string;
    callback: (response: { credential?: string }) => void;
    ux_mode?: 'popup' | 'redirect';
    auto_select?: boolean;
    cancel_on_tap_outside?: boolean;
    use_fedcm_for_button?: boolean;
  }): void;
  renderButton(parent: HTMLElement, options: GsiButtonConfig): void;
  disableAutoSelect(): void;
};

declare global {
  interface Window {
    google?: { accounts?: { id?: GsiIdApi } };
  }
}

export type { GsiButtonConfig };

const GSI_SRC = 'https://accounts.google.com/gsi/client';
let scriptPromise: Promise<GsiIdApi> | null = null;

/** Load the GIS script once per page. */
export function loadGoogleIdentity(): Promise<GsiIdApi> {
  if (typeof window === 'undefined') return Promise.reject(new Error('Browser only'));
  const ready = window.google?.accounts?.id;
  if (ready) return Promise.resolve(ready);
  if (!scriptPromise) {
    scriptPromise = new Promise<GsiIdApi>((resolve, reject) => {
      const done = () => {
        const api = window.google?.accounts?.id;
        if (api) resolve(api);
        else reject(new Error('Google sign-in failed to load'));
      };
      const existing = document.querySelector<HTMLScriptElement>(`script[src="${GSI_SRC}"]`);
      if (existing) {
        existing.addEventListener('load', done, { once: true });
        existing.addEventListener('error', () => reject(new Error('Google sign-in failed to load')), {
          once: true,
        });
        return;
      }
      const script = document.createElement('script');
      script.src = GSI_SRC;
      script.async = true;
      script.defer = true;
      script.onload = done;
      script.onerror = () => {
        scriptPromise = null;
        reject(new Error('Google sign-in failed to load'));
      };
      document.head.appendChild(script);
    });
  }
  return scriptPromise;
}

/** Build-time `NEXT_PUBLIC_GOOGLE_CLIENT_ID`, else the server's `GOOGLE_CLIENT_ID` via `/api/auth/config`. */
export async function resolveGoogleClientId(): Promise<string | null> {
  const baked = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID?.trim();
  if (baked) return baked;
  return (await fetchAuthConfig()).googleClientId;
}
