/** Admin panel on its own subdomain (e.g. admin.pokr.site), served by this same Next app. */

import { SITE_URL } from '@/lib/site';

/** Absolute admin origin, or '' when admin stays at `/admin` on the main site. */
export const ADMIN_URL = (process.env.NEXT_PUBLIC_ADMIN_URL ?? '').trim().replace(/\/$/, '');
export const TASK_TRACKER_URL = (process.env.NEXT_PUBLIC_TASK_TRACKER_URL ?? '').trim().replace(/\/$/, '');

export const ADMIN_HOST = (() => {
  if (!ADMIN_URL) return '';
  try {
    return new URL(ADMIN_URL).host.toLowerCase();
  } catch {
    return '';
  }
})();

/** Admin home path on whichever host renders the panel. */
export function adminBasePath(adminHost: string = ADMIN_HOST): string {
  return adminHost ? '/' : '/admin';
}

/** Link to the admin panel from the main site. */
export function adminHomeHref(adminUrl: string = ADMIN_URL): string {
  return adminUrl ? `${adminUrl}/` : '/admin';
}

/** Link to the admin panel from the main site. */
export function taskTrackerHref(taskTrackerUrl: string = TASK_TRACKER_URL): string | null {
  return taskTrackerUrl ? taskTrackerUrl : null;
}

/** Lobby link from the admin panel (another origin when admin has its own host). */
export function lobbyHomeHref(adminUrl: string = ADMIN_URL, siteUrl: string = SITE_URL): string {
  return adminUrl ? `${siteUrl}/` : '/';
}

/** Paths the admin host serves itself besides the panel (so admins can sign in there). */
const ADMIN_HOST_AUTH_PATHS = ['/sign-in', '/forgot-password', '/reset-password'];

export type AdminHostRoute =
  | { kind: 'next' }
  | { kind: 'rewrite'; pathname: string }
  | { kind: 'redirect'; url: string; permanent: boolean };

/** First host from `x-forwarded-host` / `host`, lowercased. */
export function requestHost(forwardedHost: string | null, host: string | null): string {
  return (forwardedHost ?? host ?? '').split(',')[0]!.trim().toLowerCase();
}

function matchesPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

/** Middleware decision for admin-subdomain routing. `search` includes the leading `?` (or is ''). */
export function adminHostRoute(
  host: string,
  pathname: string,
  search: string,
  opts: { adminUrl?: string; adminHost?: string; siteUrl?: string } = {},
): AdminHostRoute {
  const adminUrl = opts.adminUrl ?? ADMIN_URL;
  const adminHost = opts.adminHost ?? ADMIN_HOST;
  const siteUrl = opts.siteUrl ?? SITE_URL;
  if (!adminUrl || !adminHost) return { kind: 'next' };

  if (host === adminHost) {
    if (pathname === '/') return { kind: 'rewrite', pathname: '/admin' };
    if (matchesPrefix(pathname, '/admin')) {
      return { kind: 'redirect', url: `${adminUrl}/${search}`, permanent: false };
    }
    if (ADMIN_HOST_AUTH_PATHS.some((p) => matchesPrefix(pathname, p))) return { kind: 'next' };
    return { kind: 'redirect', url: `${siteUrl}${pathname}${search}`, permanent: false };
  }

  if (matchesPrefix(pathname, '/admin')) {
    return { kind: 'redirect', url: `${adminUrl}/${search}`, permanent: true };
  }
  return { kind: 'next' };
}
