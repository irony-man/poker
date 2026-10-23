import { describe, expect, it } from 'vitest';
import { parsePokerV2List, resolvePokerV2 } from './pokerV2';

describe('poker v2 flag', () => {
  it('treats all as the play areas and keeps analysis off', () => {
    const areas = parsePokerV2List('all');
    expect(areas.has('lobby')).toBe(true);
    expect(areas.has('table')).toBe(true);
    expect(areas.has('analysis')).toBe(false);
    expect(parsePokerV2List('all,analysis').has('analysis')).toBe(true);
  });

  it('lets the query override storage and env', () => {
    expect(resolvePokerV2('lobby', { query: '1', stored: '0', env: '' })).toBe(true);
    expect(resolvePokerV2('lobby', { query: '0', env: 'all' })).toBe(false);
    expect(resolvePokerV2('analysis', { stored: '1' })).toBe(true);
    expect(resolvePokerV2('analysis', { env: 'all', preview: true })).toBe(false);
    expect(resolvePokerV2('table', { preview: true })).toBe(true);
    expect(resolvePokerV2('table', { env: 'lobby' })).toBe(false);
    expect(resolvePokerV2('lobby', { stored: 'lobby,table' })).toBe(true);
  });
});
