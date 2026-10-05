import type { LobbyNavConfig, LobbyNavId } from '@poker/protocol';

/** Lobby routes shown in the sidebar. Offline play starts at /solo; /offline is the game. */

export type LobbyHref =
  | '/'
  | '/play'
  | '/play?mode=join'
  | '/public'
  | '/contests'
  | '/solo'
  | '/friends'
  | '/chat';

export type LobbyNavEntry = { id: LobbyNavId; href: LobbyHref; label: string };

export const LOBBY_NAV_ITEMS: Record<LobbyNavId, LobbyNavEntry> = {
  host: { id: 'host', href: '/play', label: 'Host' },
  join: { id: 'join', href: '/play?mode=join', label: 'Join' },
  public: { id: 'public', href: '/public', label: 'Public Tables' },
  contests: { id: 'contests', href: '/contests', label: 'Contests' },
  friends: { id: 'friends', href: '/friends', label: 'Friends' },
  chat: { id: 'chat', href: '/chat', label: 'Chat' },
  solo: { id: 'solo', href: '/solo', label: 'Offline' },
};

/** Visible sidebar items in admin order (Admin → Sidebar). */
export function orderedLobbyNav(config: LobbyNavConfig): LobbyNavEntry[] {
  return config.filter((c) => c.visible).map((c) => LOBBY_NAV_ITEMS[c.id]);
}

export type MobileBottomIcon =
  | 'home'
  | 'play'
  | 'public'
  | 'contests'
  | 'friends'
  | 'chat'
  | 'offline';

export type MobileBottomNavItem = {
  id: MobileBottomIcon;
  href: LobbyHref;
  label: string;
  shortLabel: string;
  icon: MobileBottomIcon;
};

const MOBILE_SLOTS: Record<Exclude<LobbyNavId, 'host' | 'join'>, MobileBottomNavItem> = {
  public: { id: 'public', href: '/public', label: 'Public tables', shortLabel: 'Public', icon: 'public' },
  contests: { id: 'contests', href: '/contests', label: 'Contests', shortLabel: 'Contests', icon: 'contests' },
  friends: { id: 'friends', href: '/friends', label: 'Friends', shortLabel: 'Friends', icon: 'friends' },
  chat: { id: 'chat', href: '/chat', label: 'Chat', shortLabel: 'Chat', icon: 'chat' },
  solo: { id: 'offline', href: '/solo', label: 'Offline', shortLabel: 'Offline', icon: 'offline' },
};

/** Home, then visible items in admin order; Host and Join share one Play slot. */
export function mobileBottomNav(config: LobbyNavConfig): MobileBottomNavItem[] {
  const out: MobileBottomNavItem[] = [
    { id: 'home', href: '/', label: 'Home', shortLabel: 'Home', icon: 'home' },
  ];
  const hostVisible = config.some((c) => c.id === 'host' && c.visible);
  const joinVisible = config.some((c) => c.id === 'join' && c.visible);
  let playAdded = false;
  for (const c of config) {
    if (!c.visible) continue;
    if (c.id === 'host' || c.id === 'join') {
      if (playAdded) continue;
      playAdded = true;
      out.push({
        id: 'play',
        href: hostVisible ? '/play' : '/play?mode=join',
        label: hostVisible && joinVisible ? 'Host or join' : hostVisible ? 'Host' : 'Join',
        shortLabel: 'Play',
        icon: 'play',
      });
      continue;
    }
    out.push(MOBILE_SLOTS[c.id]);
  }
  return out;
}

function isPlayPath(pathname: string): boolean {
  return (
    pathname === '/play' ||
    pathname.startsWith('/play/') ||
    pathname === '/host' ||
    pathname.startsWith('/host/') ||
    pathname === '/join' ||
    pathname.startsWith('/join/')
  );
}

function playModeFromSearch(search?: string | null): 'host' | 'join' {
  if (!search) return 'host';
  const params = new URLSearchParams(
    search.startsWith('?') ? search.slice(1) : search,
  );
  return params.get('mode') === 'join' ? 'join' : 'host';
}

export function isLobbyNavActive(
  pathname: string,
  href: LobbyHref,
  search?: string | null,
): boolean {
  if (href === '/') return pathname === '/';
  if (href === '/friends') {
    return pathname === '/friends' || pathname.startsWith('/friends/');
  }
  if (href === '/chat') {
    return pathname === '/chat' || pathname.startsWith('/chat/');
  }
  if (href === '/play' || href === '/play?mode=join') {
    if (!isPlayPath(pathname)) return false;
    const mode = playModeFromSearch(search);
    return href === '/play?mode=join' ? mode === 'join' : mode === 'host';
  }
  if (href === '/solo') {
    if (pathname !== '/solo' && !pathname.startsWith('/solo/')) {
      if (pathname !== '/offline' && !pathname.startsWith('/offline/')) return false;
    }
    const params = new URLSearchParams(
      search?.startsWith('?') ? search.slice(1) : (search ?? ''),
    );
    return !params.get('botGroup');
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function hotOfflineSoloHref(groupId: string): string {
  return `/solo?botGroup=${encodeURIComponent(groupId)}`;
}

export function isHotOfflineNavActive(
  pathname: string,
  groupId: string,
  search?: string | null,
): boolean {
  if (
    pathname !== '/solo' &&
    !pathname.startsWith('/solo/') &&
    pathname !== '/offline' &&
    !pathname.startsWith('/offline/')
  ) {
    return false;
  }
  const params = new URLSearchParams(
    search?.startsWith('?') ? search.slice(1) : (search ?? ''),
  );
  return params.get('botGroup') === groupId;
}

export function isMobileNavActive(pathname: string, item: MobileBottomNavItem): boolean {
  if (item.id === 'play') return isPlayPath(pathname);
  return isLobbyNavActive(pathname, item.href);
}
