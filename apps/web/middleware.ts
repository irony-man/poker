import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import {
  isLobbyNavVisible,
  lobbyNavIdForPath,
  normalizeLobbyNavConfig,
  type LobbyNavConfig,
} from '@poker/protocol';

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

/** Admin-hidden lobby sections (Admin → Sidebar) return 404. */
export async function middleware(req: NextRequest) {
  const id = lobbyNavIdForPath(req.nextUrl.pathname, req.nextUrl.search);
  if (!id) return NextResponse.next();
  const config = await loadLobbyNav();
  if (!config || isLobbyNavVisible(config, id)) return NextResponse.next();
  return NextResponse.rewrite(new URL('/__not-found', req.url));
}

export const config = {
  matcher: [
    '/play/:path*',
    '/host/:path*',
    '/join/:path*',
    '/public/:path*',
    '/contests/:path*',
    '/friends/:path*',
    '/chat/:path*',
    '/solo/:path*',
    '/offline/:path*',
  ],
};
