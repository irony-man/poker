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
  { href: '/', label: 'Home' },
  { href: '/host', label: 'Host' },
  { href: '/join', label: 'Join' },
  { href: '/public', label: 'Public Tables' },
  { href: '/contests', label: 'Contests' },
  { href: '/friends', label: 'Friends' },
  { href: '/solo', label: 'Offline' },
];

export function isLobbyNavActive(
  pathname: string,
  href: LobbyHref,
  search?: string | null,
): boolean {
  if (href === '/') return pathname === '/';
  if (href === '/friends') {
    return pathname === '/friends' || pathname.startsWith('/friends/');
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}
