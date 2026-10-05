import { describe, expect, it } from 'vitest';
import {
  DEFAULT_LOBBY_NAV,
  isHrefHiddenByLobbyNav,
  isLobbyNavVisible,
  lobbyNavIdForPath,
  normalizeLobbyNavConfig,
} from '@poker/protocol';

describe('normalizeLobbyNavConfig', () => {
  it('falls back to defaults for missing or invalid input', () => {
    expect(normalizeLobbyNavConfig(undefined)).toEqual(DEFAULT_LOBBY_NAV);
    expect(normalizeLobbyNavConfig({ host: true })).toEqual(DEFAULT_LOBBY_NAV);
    expect(normalizeLobbyNavConfig([])).toEqual(DEFAULT_LOBBY_NAV);
  });

  it('keeps the given order, drops unknown ids and duplicates, appends missing ids', () => {
    const out = normalizeLobbyNavConfig([
      { id: 'solo', visible: false },
      { id: 'nope', visible: true },
      { id: 'chat', visible: true },
      { id: 'solo', visible: true },
      'junk',
    ]);
    expect(out.map((i) => i.id)).toEqual([
      'solo',
      'chat',
      'host',
      'join',
      'public',
      'contests',
      'friends',
    ]);
    expect(out[0]).toEqual({ id: 'solo', visible: false });
    expect(out[1]).toEqual({ id: 'chat', visible: true });
  });

  it('uses default visibility when the flag is missing', () => {
    const out = normalizeLobbyNavConfig([{ id: 'chat' }, { id: 'host' }]);
    expect(isLobbyNavVisible(out, 'chat')).toBe(false);
    expect(isLobbyNavVisible(out, 'host')).toBe(true);
  });
});

describe('lobbyNavIdForPath', () => {
  it('splits /play into host and join by mode', () => {
    expect(lobbyNavIdForPath('/play')).toBe('host');
    expect(lobbyNavIdForPath('/play', '?mode=join')).toBe('join');
    expect(lobbyNavIdForPath('/play', 'mode=join&x=1')).toBe('join');
    expect(lobbyNavIdForPath('/host')).toBe('host');
    expect(lobbyNavIdForPath('/join')).toBe('join');
  });

  it('maps lobby routes and their subpaths', () => {
    expect(lobbyNavIdForPath('/public')).toBe('public');
    expect(lobbyNavIdForPath('/contests/')).toBe('contests');
    expect(lobbyNavIdForPath('/friends/requests')).toBe('friends');
    expect(lobbyNavIdForPath('/chat')).toBe('chat');
    expect(lobbyNavIdForPath('/solo')).toBe('solo');
    expect(lobbyNavIdForPath('/offline')).toBe('solo');
  });

  it('ignores unrelated routes', () => {
    expect(lobbyNavIdForPath('/')).toBeNull();
    expect(lobbyNavIdForPath('/contest/abc')).toBeNull();
    expect(lobbyNavIdForPath('/chatter')).toBeNull();
    expect(lobbyNavIdForPath('/profile')).toBeNull();
  });
});

describe('isHrefHiddenByLobbyNav', () => {
  it('hides hrefs that point at hidden items only', () => {
    const config = normalizeLobbyNavConfig([
      { id: 'join', visible: false },
      { id: 'chat', visible: false },
    ]);
    expect(isHrefHiddenByLobbyNav(config, '/play?mode=join')).toBe(true);
    expect(isHrefHiddenByLobbyNav(config, '/play')).toBe(false);
    expect(isHrefHiddenByLobbyNav(config, '/chat')).toBe(true);
    expect(isHrefHiddenByLobbyNav(config, '/friends')).toBe(false);
    expect(isHrefHiddenByLobbyNav(config, 'https://example.com/chat')).toBe(false);
  });
});
