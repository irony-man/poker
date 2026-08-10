import { describe, expect, it } from 'vitest';
import { MemoryKv } from './kv/kv.store.js';
import { createHistoryStore } from './history/history.store.js';
import { RoomManager } from './rooms/room.js';
import { ensurePublicTables } from './public-tables/public-tables.js';
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
    expect(low.config.buyIn).toBe(1000);
    expect(low.seatedCount).toBe(0);

    ensurePublicTables(rooms);
    expect(rooms.listPublicLobby()).toHaveLength(STAKE_PRESETS.length);
  });
});
