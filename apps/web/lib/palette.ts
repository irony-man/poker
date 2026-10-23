/** Redesign palette flag. Off unless preview or NEXT_PUBLIC_PALETTE_V2=1. */

export const PALETTE_STORAGE_KEY = 'pokr-palette';

export function paletteV2Default(): boolean {
  const explicit = process.env.NEXT_PUBLIC_PALETTE_V2?.trim().toLowerCase();
  if (explicit === '1' || explicit === 'true') return true;
  if (explicit === '0' || explicit === 'false') return false;
  const vercel = process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.VERCEL_ENV;
  return vercel === 'preview';
}

/** Honour ?palette=v1|v2 and localStorage. Leave the pre-paint attribute when neither is set. */
export function applyPaletteOverride(): void {
  if (typeof document === 'undefined') return;
  const query = new URLSearchParams(window.location.search).get('palette');
  if (query === 'v1' || query === 'v2') {
    try {
      window.localStorage.setItem(PALETTE_STORAGE_KEY, query);
    } catch {
      /* quota / private mode */
    }
  }
  let mode: 'v1' | 'v2' | null = query === 'v1' || query === 'v2' ? query : null;
  if (!mode) {
    try {
      const stored = window.localStorage.getItem(PALETTE_STORAGE_KEY);
      if (stored === 'v1' || stored === 'v2') mode = stored;
    } catch {
      /* ignore */
    }
  }
  if (mode === 'v2') document.documentElement.setAttribute('data-palette', 'v2');
  else if (mode === 'v1') document.documentElement.removeAttribute('data-palette');
}
