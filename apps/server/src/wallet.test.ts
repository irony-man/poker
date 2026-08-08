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

  it('debits buy-in on sit and credits on leave', async () => {
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
    expect(wallet.getBalance('u1')).toBe(STARTING_CHIP_GRANT - 1000);

    room.state.players[0]!.stack = 750;
    const stand = room.stand('u1', 0);
    expect(stand.ok).toBe(true);
    // cash-out is async
    await new Promise((r) => setTimeout(r, 20));
    expect(wallet.getBalance('u1')).toBe(STARTING_CHIP_GRANT - 1000 + 750);
  });

  it('rejects sit when bankroll is short', async () => {
    await wallet.debit('u1', STARTING_CHIP_GRANT - 100, 'buy_in');
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
    expect(sit.ok).toBe(false);
    expect(sit.error).toMatch(/Need 1000/i);
  });

  it('debits top-up amount', async () => {
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
    await room.sit('u1', 'alice', 0, 1000);
    room.state.players[0]!.stack = 0;
    room.state.street = 'waiting';
    const top = await room.doTopUp('u1', 0, 1000);
    expect(top.ok).toBe(true);
    expect(wallet.getBalance('u1')).toBe(STARTING_CHIP_GRANT - 2000);
    expect(room.state.players[0]!.stack).toBe(1000);
  });

  it('kick reserve rejoin does not double-debit', async () => {
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
    await room.sit('u2', 'bob', 1, 1000);
    expect(wallet.getBalance('u2')).toBe(STARTING_CHIP_GRANT - 1000);
    room.state.players[1]!.stack = 420;
    const kick = await room.kickPlayer('u1', 1);
    expect(kick.ok).toBe(true);
    // kick holds table reserve — no cash-out
    await new Promise((r) => setTimeout(r, 20));
    expect(wallet.getBalance('u2')).toBe(STARTING_CHIP_GRANT - 1000);

    const rejoin = await room.sit('u2', 'bob', 2, 1000);
    expect(rejoin.ok).toBe(true);
    expect(room.state.players[2]!.stack).toBe(420);
    expect(wallet.getBalance('u2')).toBe(STARTING_CHIP_GRANT - 1000);
  });
});
