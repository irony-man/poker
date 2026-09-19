import { describe, expect, it } from 'vitest';
import { isLobbyNavActive } from './lobbyNav';

describe('lobbyNav', () => {
  it('marks /chat as active for the Bots item', () => {
    expect(isLobbyNavActive('/chat', '/chat')).toBe(true);
    expect(isLobbyNavActive('/friends', '/chat')).toBe(false);
  });
});
