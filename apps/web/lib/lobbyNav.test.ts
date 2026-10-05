import { describe, expect, it } from 'vitest';
import { DEFAULT_LOBBY_NAV, normalizeLobbyNavConfig } from '@poker/protocol';
import {
  hotOfflineSoloHref,
  isHotOfflineNavActive,
  isLobbyNavActive,
  mobileBottomNav,
  orderedLobbyNav,
} from './lobbyNav';

describe('orderedLobbyNav', () => {
  it('defaults to the original sidebar with Chat hidden', () => {
    expect(orderedLobbyNav(DEFAULT_LOBBY_NAV).map((i) => i.label)).toEqual([
      'Host',
      'Join',
      'Public Tables',
      'Contests',
      'Friends',
      'Offline',
    ]);
  });

  it('follows admin order and skips hidden items', () => {
    const config = normalizeLobbyNavConfig([
      { id: 'chat', visible: true },
      { id: 'solo', visible: true },
      { id: 'contests', visible: false },
    ]);
    expect(orderedLobbyNav(config).map((i) => i.href)).toEqual([
      '/chat',
      '/solo',
      '/play',
      '/play?mode=join',
      '/public',
      '/friends',
    ]);
  });
});

describe('mobileBottomNav', () => {
  it('matches the original tab bar by default', () => {
    expect(mobileBottomNav(DEFAULT_LOBBY_NAV).map((i) => i.id)).toEqual([
      'home',
      'play',
      'public',
      'contests',
      'friends',
      'offline',
    ]);
  });

  it('merges Host and Join into one Play slot at the first visible position', () => {
    const config = normalizeLobbyNavConfig([
      { id: 'friends', visible: true },
      { id: 'join', visible: true },
      { id: 'chat', visible: true },
      { id: 'host', visible: true },
    ]);
    expect(mobileBottomNav(config).map((i) => i.id)).toEqual([
      'home',
      'friends',
      'play',
      'chat',
      'public',
      'contests',
      'offline',
    ]);
  });

  it('points Play at join when Host is hidden, and drops it when both are hidden', () => {
    const joinOnly = normalizeLobbyNavConfig([{ id: 'host', visible: false }]);
    const play = mobileBottomNav(joinOnly).find((i) => i.id === 'play');
    expect(play?.href).toBe('/play?mode=join');
    expect(play?.label).toBe('Join');

    const neither = normalizeLobbyNavConfig([
      { id: 'host', visible: false },
      { id: 'join', visible: false },
    ]);
    expect(mobileBottomNav(neither).some((i) => i.id === 'play')).toBe(false);
  });
});

describe('lobbyNav', () => {
  it('marks /chat as active for the Bots item', () => {
    expect(isLobbyNavActive('/chat', '/chat')).toBe(true);
    expect(isLobbyNavActive('/friends', '/chat')).toBe(false);
  });

  it('Offline nav is inactive when a botGroup query is set', () => {
    expect(isLobbyNavActive('/solo', '/solo', 'botGroup=medium')).toBe(false);
    expect(isLobbyNavActive('/solo', '/solo')).toBe(true);
  });

  it('hot offline links encode group id and match active state', () => {
    expect(hotOfflineSoloHref('station-crushers')).toBe(
      '/solo?botGroup=station-crushers',
    );
    expect(
      isHotOfflineNavActive('/solo', 'medium', 'botGroup=medium'),
    ).toBe(true);
    expect(
      isHotOfflineNavActive('/offline', 'medium', 'botGroup=medium&seats=6'),
    ).toBe(true);
    expect(isHotOfflineNavActive('/solo', 'medium', 'botGroup=easy')).toBe(false);
  });
});
