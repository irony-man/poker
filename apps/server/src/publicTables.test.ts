import { describe, expect, it } from 'vitest';
import { MemoryKv } from './kv.js';
import { createHistoryStore } from './history.js';
import { RoomManager } from './room.js';
import { ensurePublicTables } from './publicTables.js';
import { STAKE_PRESETS } from '@poker/protocol';

describe('ensurePublicTables', () => {
  it('creates one public table per stake preset', async () => {
    const kv = new MemoryKv();
    const history = await createHistoryStore();
    const rooms = new RoomManager(kv, history);

    ensurePublicTables(rooms);

    const lobby = rooms.listPublicLobby();
    expect(lobby).toHaveLength(STAKE_PRESETS.length);
    expect(lobby.map((t) => t.stakeId).sort()).toEqual(STAKE_PRESETS.map((s) => s.id).sort());

    const low = lobby.find((t) => t.stakeId === 'low')!;
    expect(low.config.minBuyIn).toBe(200);
    expect(low.config.maxBuyIn).toBe(1000);
    expect(low.seatedCount).toBeGreaterThanOrEqual(2);

    ensurePublicTables(rooms);
    expect(rooms.listPublicLobby()).toHaveLength(STAKE_PRESETS.length);
  });
});
