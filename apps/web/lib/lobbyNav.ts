/** Lobby routes shown in the sidebar. Offline play starts at /solo; /offline is the game. */

export type LobbyHref =
  | '/'
  | '/play'
  | '/play?mode=join'
  | '/public'
  | '/contests'
  | '/solo'
  | '/friends';

export const LOBBY_NAV: { href: LobbyHref; label: string }[] = [
  { href: '/play', label: 'Host' },
  { href: '/play?mode=join', label: 'Join' },
  { href: '/public', label: 'Public Tables' },
  { href: '/contests', label: 'Contests' },
  { href: '/friends', label: 'Friends' },
  { href: '/solo', label: 'Offline' },
];

export type MobileBottomIcon = 'home' | 'play' | 'public' | 'contests' | 'friends' | 'offline';

export type MobileBottomNavItem = {
  id: MobileBottomIcon;
  href: Exclude<LobbyHref, '/play?mode=join'>;
  label: string;
  shortLabel: string;
  icon: MobileBottomIcon;
};

export const MOBILE_BOTTOM_NAV: MobileBottomNavItem[] = [
  { id: 'home', href: '/', label: 'Home', shortLabel: 'Home', icon: 'home' },
  { id: 'play', href: '/play', label: 'Host or join', shortLabel: 'Play', icon: 'play' },
  { id: 'public', href: '/public', label: 'Public tables', shortLabel: 'Public', icon: 'public' },
  { id: 'contests', href: '/contests', label: 'Contests', shortLabel: 'Contests', icon: 'contests' },
  { id: 'friends', href: '/friends', label: 'Friends', shortLabel: 'Friends', icon: 'friends' },
  { id: 'offline', href: '/solo', label: 'Offline', shortLabel: 'Offline', icon: 'offline' },
];

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
  if (href === '/play' || href === '/play?mode=join') {
    if (!isPlayPath(pathname)) return false;
    const mode = playModeFromSearch(search);
    return href === '/play?mode=join' ? mode === 'join' : mode === 'host';
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function isMobileNavActive(pathname: string, item: MobileBottomNavItem): boolean {
  if (item.id === 'play') return isPlayPath(pathname);
  return isLobbyNavActive(pathname, item.href);
}
