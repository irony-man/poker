/** Helpers so sign-in / sign-up can return to the page that started auth. */

/** Same-origin path only — blocks open redirects. */
export function safeReturnPath(next: string | null | undefined, fallback = '/'): string {
  if (!next) return fallback;
  const path = next.trim();
  if (!path.startsWith('/') || path.startsWith('//')) return fallback;
  if (path.includes('://')) return fallback;
  // Avoid bounce loops if next points at auth pages.
  if (path === '/sign-in' || path.startsWith('/sign-in?') || path.startsWith('/sign-in/')) {
    return fallback;
  }
  if (path === '/sign-up' || path.startsWith('/sign-up?') || path.startsWith('/sign-up/')) {
    return fallback;
  }
  return path;
}

/** Current browser path + query (client only). */
export function currentPathWithQuery(): string {
  if (typeof window === 'undefined') return '/';
  return `${window.location.pathname}${window.location.search}` || '/';
}

export function authHref(
  kind: 'sign-in' | 'sign-up',
  returnTo?: string | null,
): string {
  const base = kind === 'sign-in' ? '/sign-in' : '/sign-up';
  const next = safeReturnPath(returnTo, '');
  if (!next || next === '/') return base;
  return `${base}?next=${encodeURIComponent(next)}`;
}
