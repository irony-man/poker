import { DEFAULT_LOBBY_NAV, normalizeLobbyNavConfig, type LobbyNavConfig } from '@poker/protocol';
import { serverApiBase } from '@/lib/legal';

/** Server-side fetch of the admin sidebar config; falls back to the defaults. */
export async function fetchLobbyNav(revalidateSeconds = 300): Promise<LobbyNavConfig> {
  try {
    const res = await fetch(`${serverApiBase()}/api/site/nav`, {
      next: { revalidate: revalidateSeconds },
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return DEFAULT_LOBBY_NAV;
    const body = (await res.json()) as { items?: unknown };
    return normalizeLobbyNavConfig(body.items);
  } catch {
    return DEFAULT_LOBBY_NAV;
  }
}
