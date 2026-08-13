import { mkdir, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FileHistoryStore, playerUserIdsFromResult } from './history.store.js';

describe('playerUserIdsFromResult', () => {
  it('returns unique seated user ids', () => {
    expect(
      playerUserIdsFromResult({
        players: [
          { seat: 0, userId: 'a' },
          { seat: 1, userId: 'b' },
          { seat: 2, userId: 'a' },
          { seat: 3, userId: null },
        ],
      }),
    ).toEqual(['a', 'b']);
  });

  it('returns empty for malformed results', () => {
    expect(playerUserIdsFromResult(null)).toEqual([]);
    expect(playerUserIdsFromResult({})).toEqual([]);
  });
});

describe('FileHistoryStore hand counts', () => {
  let dir: string;
  let store: FileHistoryStore;

  beforeEach(async () => {
    dir = path.join(os.tmpdir(), `felt-hist-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await mkdir(dir, { recursive: true });
    store = new FileHistoryStore(dir);
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('counts hands a user was dealt into', async () => {
    await store.recordHand({
      tableId: 't1',
      handId: 'h1',
      startedAt: 1,
      endedAt: 2,
      result: { players: [{ userId: 'alice' }, { userId: 'bob' }] },
    });
    await store.recordHand({
      tableId: 't1',
      handId: 'h2',
      startedAt: 3,
      endedAt: 4,
      result: { players: [{ userId: 'alice' }] },
    });

    expect(await store.countHandsForUser('alice')).toBe(2);
    expect(await store.countHandsForUser('bob')).toBe(1);
    expect(await store.countHandsForUser('carol')).toBe(0);

    const byUser = await store.countHandsByUser();
    expect(byUser.get('alice')).toBe(2);
    expect(byUser.get('bob')).toBe(1);
  });
});
