import { STAKE_PRESETS } from '@poker/protocol';
import type { RoomManager } from './room.js';

const HOUSE_HOST = 'felt-house';

/** Ensure one public ring table exists per stake preset. */
export function ensurePublicTables(rooms: RoomManager): void {
  for (const stake of STAKE_PRESETS) {
    if (rooms.findPublicByStake(stake.id)) continue;

    const meta = rooms.create({
      name: `${stake.label} stakes`,
      hostUserId: HOUSE_HOST,
      isPrivate: false,
      stakeId: stake.id,
      config: {
        maxSeats: 6,
        smallBlind: stake.smallBlind,
        bigBlind: stake.bigBlind,
        buyIn: stake.buyIn,
        turnTimeMs: 20_000,
      },
    });

    const room = rooms.get(meta.id);
    if (room) {
      // Keep public tables lively when empty.
      room.addBot(HOUSE_HOST, undefined, stake.buyIn, 2);
    }
  }
}
