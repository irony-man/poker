/** Lobby routes shown in the sidebar. Offline play starts at /solo; /offline is the game. */

export type LobbyHref =
  | '/'
  | '/host'
  | '/join'
  | '/public'
  | '/contests'
  | '/solo'
  | '/friends';

export const LOBBY_NAV: { href: LobbyHref; label: string }[] = [
  { href: '/host', label: 'Host' },
  { href: '/join', label: 'Join' },
  { href: '/public', label: 'Public Tables' },
  { href: '/contests', label: 'Contests' },
  { href: '/friends', label: 'Friends' },
  { href: '/solo', label: 'Offline' },
];

export type MobileBottomIcon = 'home' | 'hostJoin' | 'public' | 'contests' | 'friends' | 'offline';

export type MobileBottomNavItem =
  | {
      id: 'hostJoin';
      kind: 'hostJoin';
      label: string;
      shortLabel: string;
      icon: 'hostJoin';
    }
  | {
      id: Exclude<MobileBottomIcon, 'hostJoin'>;
      kind: 'link';
      href: LobbyHref;
      label: string;
      shortLabel: string;
      icon: Exclude<MobileBottomIcon, 'hostJoin'>;
    };

export const MOBILE_BOTTOM_NAV: MobileBottomNavItem[] = [
  { id: 'home', kind: 'link', href: '/', label: 'Home', shortLabel: 'Home', icon: 'home' },
  { id: 'hostJoin', kind: 'hostJoin', label: 'Host or join', shortLabel: 'Play', icon: 'hostJoin' },
  { id: 'public', kind: 'link', href: '/public', label: 'Public tables', shortLabel: 'Public', icon: 'public' },
  { id: 'contests', kind: 'link', href: '/contests', label: 'Contests', shortLabel: 'Contests', icon: 'contests' },
  { id: 'friends', kind: 'link', href: '/friends', label: 'Friends', shortLabel: 'Friends', icon: 'friends' },
  { id: 'offline', kind: 'link', href: '/solo', label: 'Offline', shortLabel: 'Offline', icon: 'offline' },
];

export function isLobbyNavActive(
  pathname: string,
  href: LobbyHref,
  search?: string | null,
): boolean {
  void search;
  if (href === '/') return pathname === '/';
  if (href === '/friends') {
    return pathname === '/friends' || pathname.startsWith('/friends/');
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function isMobileNavActive(pathname: string, item: MobileBottomNavItem): boolean {
  if (item.kind === 'hostJoin') {
    return (
      pathname === '/host' ||
      pathname.startsWith('/host/') ||
      pathname === '/join' ||
      pathname.startsWith('/join/')
    );
  }
  return isLobbyNavActive(pathname, item.href);
}
