import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AuthStore } from './auth/auth.store.js';
import { MemoryKv } from './kv/kv.store.js';
import type { HandHistoryStore } from './history/history.store.js';
import { RoomManager } from './rooms/room.js';
import { MemoryTableChipStore } from './table-chips/table-chips.store.js';
import {
  AuthWalletStore,
} from './wallet/wallet.store.js';
import {
  REFILL_GRANT,
  REFILL_THRESHOLD,
  STARTING_CHIP_GRANT,
  WalletError,
} from './wallet/wallet.constants.js';

function memoryHistory(): HandHistoryStore {
  return {
    async recordTable() {},
    async recordHand() {},
    async listHands() {
      return [];
    },
  };
}

describe('AuthWalletStore', () => {
  let dir: string;
  let auth: AuthStore;
  let wallet: AuthWalletStore;

  beforeEach(async () => {
    dir = await mkdtemp(path.join(os.tmpdir(), 'wallet-'));
    auth = new AuthStore(dir);
    await auth.init();
    await auth.seedUser('u1', 'alice', 'password1');
    wallet = new AuthWalletStore(auth);
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('grants starting chips on signup/seed', () => {
    expect(wallet.getBalance('u1')).toBe(STARTING_CHIP_GRANT);
  });

  it('debits and credits balance', async () => {
    await wallet.debit('u1', 1000, 'buy_in', 't1');
    expect(wallet.getBalance('u1')).toBe(STARTING_CHIP_GRANT - 1000);
    await wallet.credit('u1', 400, 'cash_out', 't1');
    expect(wallet.getBalance('u1')).toBe(STARTING_CHIP_GRANT - 600);
  });

  it('rejects insufficient debit', async () => {
    await expect(wallet.debit('u1', STARTING_CHIP_GRANT + 1, 'buy_in')).rejects.toBeInstanceOf(
      WalletError,
    );
    expect(wallet.getBalance('u1')).toBe(STARTING_CHIP_GRANT);
  });

  it('allows free refill only below threshold', async () => {
    await wallet.debit('u1', STARTING_CHIP_GRANT - (REFILL_THRESHOLD - 1), 'buy_in');
    expect(wallet.getBalance('u1')).toBe(REFILL_THRESHOLD - 1);
    expect(wallet.refillInfo('u1').eligible).toBe(true);
    const after = await wallet.claimRefill('u1');
    expect(after.balance).toBe(REFILL_THRESHOLD - 1 + REFILL_GRANT);
    await expect(wallet.claimRefill('u1')).rejects.toBeInstanceOf(WalletError);
  });
});

describe('Room wallet economy', () => {
  let dir: string;
  let auth: AuthStore;
  let wallet: AuthWalletStore;
  let rooms: RoomManager;

  beforeEach(async () => {
    dir = await mkdtemp(path.join(os.tmpdir(), 'room-wallet-'));
    auth = new AuthStore(dir);
    await auth.init();
    await auth.seedUser('u1', 'alice', 'password1');
    await auth.seedUser('u2', 'bob', 'password2');
    wallet = new AuthWalletStore(auth);
    rooms = new RoomManager(new MemoryKv(), memoryHistory(), new MemoryTableChipStore(), wallet);
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('cash room: sit and leave do not touch bankroll', async () => {
    const meta = rooms.create({
      name: 'Cash',
      hostUserId: 'u1',
      isPrivate: true,
      config: {
        maxSeats: 6,
        smallBlind: 5,
        bigBlind: 10,
        buyIn: 1000,
        turnTimeMs: 20_000,
      },
    });
    const room = rooms.get(meta.id)!;
    const before = wallet.getBalance('u1');
    const sit = await room.sit('u1', 'alice', 0, 1000);
    expect(sit.ok).toBe(true);
    expect(wallet.getBalance('u1')).toBe(before);
    expect(room.state.players[0]!.stack).toBe(1000);

    room.state.players[0]!.stack = 750;
    const stand = room.stand('u1', 0);
    expect(stand.ok).toBe(true);
    // cash-out is async when enabled
    await new Promise((r) => setTimeout(r, 20));
    expect(wallet.getBalance('u1')).toBe(before);
  });

  it('cash room: allows sit with empty bankroll', async () => {
    await wallet.debit('u1', STARTING_CHIP_GRANT, 'buy_in');
    expect(wallet.getBalance('u1')).toBe(0);
    const meta = rooms.create({
      name: 'Cash',
      hostUserId: 'u1',
      isPrivate: true,
      config: {
        maxSeats: 6,
        smallBlind: 5,
        bigBlind: 10,
        buyIn: 1000,
        turnTimeMs: 20_000,
      },
    });
    const room = rooms.get(meta.id)!;
    const sit = await room.sit('u1', 'alice', 0, 1000);
    expect(sit.ok).toBe(true);
    expect(room.state.players[0]!.stack).toBe(1000);
    expect(wallet.getBalance('u1')).toBe(0);
  });

  it('cash room: top-up freezes bankroll', async () => {
    const meta = rooms.create({
      name: 'Cash',
      hostUserId: 'u1',
      isPrivate: true,
      config: {
        maxSeats: 6,
        smallBlind: 5,
        bigBlind: 10,
        buyIn: 1000,
        turnTimeMs: 20_000,
      },
    });
    const room = rooms.get(meta.id)!;
    const before = wallet.getBalance('u1');
    await room.sit('u1', 'alice', 0, 1000);
    room.state.players[0]!.stack = 0;
    room.state.street = 'waiting';
    const top = await room.doTopUp('u1', 0, 1000);
    expect(top.ok).toBe(true);
    expect(wallet.getBalance('u1')).toBe(before);
    expect(room.state.players[0]!.stack).toBe(1000);
  });

  it('kick reserve rejoin does not touch bankroll', async () => {
    const chips = new MemoryTableChipStore();
    rooms = new RoomManager(new MemoryKv(), memoryHistory(), chips, wallet);
    const meta = rooms.create({
      name: 'Cash',
      hostUserId: 'u1',
      isPrivate: true,
      config: {
        maxSeats: 6,
        smallBlind: 5,
        bigBlind: 10,
        buyIn: 1000,
        turnTimeMs: 20_000,
      },
    });
    const room = rooms.get(meta.id)!;
    const before = wallet.getBalance('u2');
    await room.sit('u2', 'bob', 1, 1000);
    expect(wallet.getBalance('u2')).toBe(before);
    room.state.players[1]!.stack = 420;
    const kick = await room.kickPlayer('u1', 1);
    expect(kick.ok).toBe(true);
    await new Promise((r) => setTimeout(r, 20));
    expect(wallet.getBalance('u2')).toBe(before);

    const rejoin = await room.sit('u2', 'bob', 2, 1000);
    expect(rejoin.ok).toBe(true);
    expect(room.state.players[2]!.stack).toBe(420);
    expect(wallet.getBalance('u2')).toBe(before);
  });

  it('play-money table: sit and leave freeze balance', async () => {
    const meta = rooms.create({
      name: 'Practice',
      hostUserId: 'u1',
      isPrivate: true,
      playMoney: true,
      config: {
        maxSeats: 6,
        smallBlind: 5,
        bigBlind: 10,
        buyIn: 1000,
        turnTimeMs: 20_000,
      },
    });
    const room = rooms.get(meta.id)!;
    const before = wallet.getBalance('u1');
    const sit = await room.sit('u1', 'alice', 0, 1000);
    expect(sit.ok).toBe(true);
    expect(wallet.getBalance('u1')).toBe(before);
    expect(room.state.players[0]!.stack).toBe(1000);

    room.state.players[0]!.stack = 2500;
    const stand = room.stand('u1', 0);
    expect(stand.ok).toBe(true);
    await new Promise((r) => setTimeout(r, 20));
    expect(wallet.getBalance('u1')).toBe(before);
  });

  it('play-money table: top-up freezes balance', async () => {
    const meta = rooms.create({
      name: 'Practice',
      hostUserId: 'u1',
      isPrivate: true,
      playMoney: true,
      config: {
        maxSeats: 6,
        smallBlind: 5,
        bigBlind: 10,
        buyIn: 1000,
        turnTimeMs: 20_000,
      },
    });
    const room = rooms.get(meta.id)!;
    const before = wallet.getBalance('u1');
    await room.sit('u1', 'alice', 0, 1000);
    room.state.players[0]!.stack = 0;
    room.state.street = 'waiting';
    const top = await room.doTopUp('u1', 0, 1000);
    expect(top.ok).toBe(true);
    expect(wallet.getBalance('u1')).toBe(before);
    expect(room.state.players[0]!.stack).toBe(1000);
  });

  it('addBot enables playMoney on private table before humans sit', async () => {
    const meta = rooms.create({
      name: 'Host',
      hostUserId: 'u1',
      isPrivate: true,
      config: {
        maxSeats: 6,
        smallBlind: 5,
        bigBlind: 10,
        buyIn: 1000,
        turnTimeMs: 20_000,
      },
    });
    const room = rooms.get(meta.id)!;
    expect(room.meta.playMoney).toBeFalsy();
    expect(room.addBot('u1').ok).toBe(true);
    expect(room.meta.playMoney).toBe(true);

    const empty = room.state.players.find((p) => p.status === 'empty')!.seat;
    const before = wallet.getBalance('u1');
    const sit = await room.sit('u1', 'alice', empty, 1000);
    expect(sit.ok).toBe(true);
    expect(wallet.getBalance('u1')).toBe(before);
  });

  it('public stake table: free buy-in stack and rejects bots', async () => {
    const meta = rooms.create({
      name: 'NL10',
      hostUserId: 'felt-house',
      isPrivate: false,
      stakeId: 'nl10',
      config: {
        maxSeats: 6,
        smallBlind: 5,
        bigBlind: 10,
        buyIn: 1000,
        turnTimeMs: 20_000,
      },
    });
    const room = rooms.get(meta.id)!;
    expect(room.addBot('felt-house', undefined, 1000, 2).ok).toBe(false);
    expect(room.meta.playMoney).toBeFalsy();

    const empty = room.state.players.find((p) => p.status === 'empty')!.seat;
    const before = wallet.getBalance('u1');
    const sit = await room.sit('u1', 'alice', empty, 1000);
    expect(sit.ok).toBe(true);
    expect(wallet.getBalance('u1')).toBe(before);
    expect(room.state.players[empty]!.stack).toBe(1000);
  });
});
