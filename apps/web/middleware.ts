import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import {
  isLobbyNavVisible,
  lobbyNavIdForPath,
  normalizeLobbyNavConfig,
  type LobbyNavConfig,
} from '@poker/protocol';
import { adminHostRoute, requestHost } from '@/lib/adminHost';

const NAV_CACHE_TTL_MS = 30_000;

let navCache: { at: number; config: LobbyNavConfig } | null = null;
let navInflight: Promise<LobbyNavConfig | null> | null = null;

function apiBase(): string {
  return (
    process.env.API_REWRITE_TARGET ||
    process.env.NEXT_PUBLIC_API_URL ||
    'http://localhost:4000'
  ).replace(/\/$/, '');
}

/** Last config that loaded, or null if the API has never answered (fail open). */
async function loadLobbyNav(): Promise<LobbyNavConfig | null> {
  if (navCache && Date.now() - navCache.at < NAV_CACHE_TTL_MS) return navCache.config;
  if (navInflight) return navInflight;
  navInflight = (async () => {
    try {
      const res = await fetch(`${apiBase()}/api/site/nav`, {
        cache: 'no-store',
        signal: AbortSignal.timeout(3000),
      });
      if (!res.ok) return navCache?.config ?? null;
      const body = (await res.json()) as { items?: unknown };
      const config = normalizeLobbyNavConfig(body.items);
      navCache = { at: Date.now(), config };
      return config;
    } catch {
      return navCache?.config ?? null;
    }
  })().finally(() => {
    navInflight = null;
  });
  return navInflight;
}

/**
 * Admin subdomain routing (see lib/adminHost), then admin-hidden lobby sections
 * (Admin → Sidebar) return 404.
 */
export async function middleware(req: NextRequest) {
  const host = requestHost(req.headers.get('x-forwarded-host'), req.headers.get('host'));
  const route = adminHostRoute(host, req.nextUrl.pathname, req.nextUrl.search);
  if (route.kind === 'redirect') {
    return NextResponse.redirect(route.url, route.permanent ? 308 : 307);
  }
  if (route.kind === 'rewrite') {
    const url = req.nextUrl.clone();
    url.pathname = route.pathname;
    return NextResponse.rewrite(url);
  }

  const id = lobbyNavIdForPath(req.nextUrl.pathname, req.nextUrl.search);
  if (!id) return NextResponse.next();
  const config = await loadLobbyNav();
  if (!config || isLobbyNavVisible(config, id)) return NextResponse.next();
  return NextResponse.rewrite(new URL('/__not-found', req.url));
}

export const config = {
  // Every page path: the admin host must see all of them. Skips Next internals, /api and static files.
  matcher: ['/((?!_next/|api/|.*\\.[^/]+$).*)'],
};
