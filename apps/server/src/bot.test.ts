import { describe, expect, it } from 'vitest';
import {
  applyAction,
  createEmptyTable,
  sitDown,
  startHand,
  type TableConfig,
} from '@poker/engine';
import { chooseBotAction, isBotUserId, makeBotUserId } from './bot.js';
import { MemoryKv } from './kv.js';
import { FileHistoryStore } from './history.js';
import { RoomManager } from './room.js';
import path from 'node:path';
import os from 'node:os';
import { randomBytes } from 'node:crypto';

const config: TableConfig = {
  maxSeats: 6,
  smallBlind: 5,
  bigBlind: 10,
  minBuyIn: 200,
  maxBuyIn: 1000,
  turnTimeMs: 15000,
};

describe('bots', () => {
  it('identifies bot user ids', () => {
    expect(isBotUserId(makeBotUserId('abc'))).toBe(true);
    expect(isBotUserId('human')).toBe(false);
  });

  it('always returns a legal action when to act', () => {
    let state = createEmptyTable(config);
    state = sitDown(state, 0, 'u1', 'Alice', 500).state;
    state = sitDown(state, 1, makeBotUserId('x'), 'AceBot', 500).state;
    state = startHand(state, config, 'h1', (n) => randomBytes(n)).state;

    let guard = 0;
    while (state.street !== 'payout' && state.toAct !== null && guard++ < 40) {
      const seat = state.toAct;
      const p = state.players[seat]!;
      if (isBotUserId(p.userId)) {
        const intent = chooseBotAction(state, seat, config);
        expect(intent).not.toBeNull();
        const r = applyAction(state, seat, intent!, config);
        expect(r.ok).toBe(true);
        state = r.state;
      } else {
        const toCall = state.currentBet - p.bet;
        const r = applyAction(
          state,
          seat,
          toCall > 0
            ? { type: 'call', seq: state.actionSeq }
            : { type: 'check', seq: state.actionSeq },
          config,
        );
        expect(r.ok).toBe(true);
        state = r.state;
      }
    }
    expect(state.street).toBe('payout');
  });

  it('addBot seats a bot and fills empty seat', async () => {
    const kv = new MemoryKv();
    const history = new FileHistoryStore(path.join(os.tmpdir(), `poker-bot-${Date.now()}`));
    const rooms = new RoomManager(kv, history);
    const meta = rooms.create({
      name: 'Bots',
      hostUserId: 'host',
      isPrivate: true,
      config,
    });
    const room = rooms.get(meta.id)!;
    expect(room.sit('host', 'Host', 0, 500).ok).toBe(true);
    expect(room.addBot('host').ok).toBe(true);
    expect(room.state.players.some((p) => isBotUserId(p.userId))).toBe(true);
  });

  it('addBot can seat multiple bots at once', async () => {
    const kv = new MemoryKv();
    const history = new FileHistoryStore(path.join(os.tmpdir(), `poker-bots-${Date.now()}`));
    const rooms = new RoomManager(kv, history);
    const meta = rooms.create({
      name: 'Multi',
      hostUserId: 'host',
      isPrivate: true,
      config,
    });
    const room = rooms.get(meta.id)!;
    expect(room.sit('host', 'Host', 0, 500).ok).toBe(true);
    const result = room.addBot('host', undefined, 200, 3);
    expect(result.ok).toBe(true);
    expect(result.added).toBe(3);
    expect(room.state.players.filter((p) => isBotUserId(p.userId)).length).toBe(3);
  });
});
