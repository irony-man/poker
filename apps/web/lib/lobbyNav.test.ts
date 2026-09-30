import { describe, expect, it } from 'vitest';
import {
  hotOfflineSoloHref,
  isHotOfflineNavActive,
  isLobbyNavActive,
} from './lobbyNav';

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
