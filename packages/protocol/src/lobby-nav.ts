/** Admin-controlled lobby sidebar: item order and visibility. Hidden items' pages return 404. */
export type LobbyNavId = 'host' | 'join' | 'public' | 'contests' | 'friends' | 'chat' | 'solo';

export interface LobbyNavItemConfig {
  id: LobbyNavId;
  visible: boolean;
}

export type LobbyNavConfig = LobbyNavItemConfig[];

export const LOBBY_NAV_IDS: readonly LobbyNavId[] = [
  'host',
  'join',
  'public',
  'contests',
  'friends',
  'chat',
  'solo',
] as const;

export const DEFAULT_LOBBY_NAV: LobbyNavConfig = [
  { id: 'host', visible: true },
  { id: 'join', visible: true },
  { id: 'public', visible: true },
  { id: 'contests', visible: true },
  { id: 'friends', visible: true },
  { id: 'chat', visible: false },
  { id: 'solo', visible: true },
];

export function isLobbyNavId(value: unknown): value is LobbyNavId {
  return typeof value === 'string' && (LOBBY_NAV_IDS as readonly string[]).includes(value);
}

export function cloneLobbyNavConfig(config: LobbyNavConfig): LobbyNavConfig {
  return config.map((item) => ({ ...item }));
}

/** Drops unknown ids and duplicates; ids missing from `raw` are appended with their default visibility. */
export function normalizeLobbyNavConfig(raw: unknown): LobbyNavConfig {
  if (!Array.isArray(raw)) return cloneLobbyNavConfig(DEFAULT_LOBBY_NAV);
  const out: LobbyNavConfig = [];
  const seen = new Set<LobbyNavId>();
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) continue;
    const o = entry as Record<string, unknown>;
    if (!isLobbyNavId(o.id) || seen.has(o.id)) continue;
    seen.add(o.id);
    const fallback = DEFAULT_LOBBY_NAV.find((d) => d.id === o.id)!;
    out.push({
      id: o.id,
      visible: typeof o.visible === 'boolean' ? o.visible : fallback.visible,
    });
  }
  for (const d of DEFAULT_LOBBY_NAV) {
    if (!seen.has(d.id)) out.push({ ...d });
  }
  return out;
}

export function isLobbyNavVisible(config: LobbyNavConfig, id: LobbyNavId): boolean {
  const item = config.find((c) => c.id === id);
  return item ? item.visible : (DEFAULT_LOBBY_NAV.find((d) => d.id === id)?.visible ?? true);
}

function underPath(pathname: string, base: string): boolean {
  return pathname === base || pathname.startsWith(`${base}/`);
}

/** Nav item that owns a route (`search` may include the leading `?`), or null for unrelated routes. */
export function lobbyNavIdForPath(pathname: string, search = ''): LobbyNavId | null {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  if (underPath(path, '/join')) return 'join';
  if (underPath(path, '/host')) return 'host';
  if (underPath(path, '/play')) {
    const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
    return params.get('mode') === 'join' ? 'join' : 'host';
  }
  if (underPath(path, '/public')) return 'public';
  if (underPath(path, '/contests')) return 'contests';
  if (underPath(path, '/friends')) return 'friends';
  if (underPath(path, '/chat')) return 'chat';
  if (underPath(path, '/solo') || underPath(path, '/offline')) return 'solo';
  return null;
}

/** Whether a site-relative href (e.g. a home feature CTA) points at a hidden nav item. */
export function isHrefHiddenByLobbyNav(config: LobbyNavConfig, href: string): boolean {
  if (!href.startsWith('/') || href.startsWith('//')) return false;
  const [pathAndQuery] = href.split('#');
  const q = pathAndQuery!.indexOf('?');
  const pathname = q >= 0 ? pathAndQuery!.slice(0, q) : pathAndQuery!;
  const search = q >= 0 ? pathAndQuery!.slice(q) : '';
  const id = lobbyNavIdForPath(pathname || '/', search);
  return id !== null && !isLobbyNavVisible(config, id);
}
