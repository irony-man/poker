import { mkdir, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FileHistoryStore, playerUserIdsFromResult } from './history.store.js';
import { redactUnrevealedHoleCards } from './history.service.js';

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

describe('redactUnrevealedHoleCards', () => {
  it('keeps revealed hole cards and strips the rest', () => {
    const json = JSON.stringify({
      players: [
        { userId: 'a', revealed: true, holeCards: [{ rank: 14, suit: 'h' }] },
        { userId: 'b', revealed: false, holeCards: [{ rank: 13, suit: 's' }] },
      ],
    });
    const out = JSON.parse(redactUnrevealedHoleCards(json)) as {
      players: Array<{ userId: string; holeCards: unknown }>;
    };
    expect(out.players[0]?.holeCards).toEqual([{ rank: 14, suit: 'h' }]);
    expect(out.players[1]?.holeCards).toBeNull();
  });

  it('keeps the viewer hole cards even when unrevealed', () => {
    const json = JSON.stringify({
      players: [
        { userId: 'a', revealed: false, holeCards: [{ rank: 14, suit: 'h' }] },
        { userId: 'b', revealed: false, holeCards: [{ rank: 13, suit: 's' }] },
      ],
    });
    const out = JSON.parse(redactUnrevealedHoleCards(json, 'a')) as {
      players: Array<{ userId: string; holeCards: unknown }>;
    };
    expect(out.players[0]?.holeCards).toEqual([{ rank: 14, suit: 'h' }]);
    expect(out.players[1]?.holeCards).toBeNull();
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

  it('is idempotent on tableId+handId', async () => {
    const first = await store.recordHand({
      tableId: 't1',
      handId: 'h1',
      startedAt: 1,
      endedAt: 2,
      result: { players: [{ userId: 'alice' }] },
    });
    const second = await store.recordHand({
      tableId: 't1',
      handId: 'h1',
      startedAt: 3,
      endedAt: 4,
      result: { players: [{ userId: 'alice' }] },
    });
    expect(first).toBe(true);
    expect(second).toBe(false);
    expect(await store.countHandsForUser('alice')).toBe(1);
  });

  it('stores chat and lists by table', async () => {
    await store.recordChat({
      tableId: 't1',
      userId: 'alice',
      name: 'Alice',
      text: 'hi',
      at: 10,
      kind: 'user',
    });
    await store.recordChat({
      tableId: 't1',
      userId: 'system',
      name: 'Dealer',
      text: 'flop',
      at: 20,
      kind: 'system',
    });
    const chat = await store.listChat({ tableId: 't1' });
    expect(chat.map((c) => c.text)).toEqual(['hi', 'flop']);
  });
});
