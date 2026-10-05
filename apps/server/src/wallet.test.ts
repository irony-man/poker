import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AuthStore } from './auth/auth.store.js';
import { MemoryKv } from './kv/kv.store.js';
import { memoryHistoryStore, type HandHistoryStore } from './history/history.store.js';
import { RoomManager } from './rooms/room.js';
import { MemoryTableChipStore } from './table-chips/table-chips.store.js';
import type { Queryable } from './database/queryable.js';
import {
  AuthWalletStore,
  decodeTrailCursor,
  encodeTrailCursor,
} from './wallet/wallet.store.js';
import {
  REFILL_GRANT,
  REFILL_THRESHOLD,
  STARTING_CHIP_GRANT,
  STARTING_WHUFFIE_GRANT,
  WalletError,
} from './wallet/wallet.constants.js';

function memoryHistory(): HandHistoryStore {
  return memoryHistoryStore();
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
    expect(wallet.getWhuffieBalance('u1')).toBe(STARTING_WHUFFIE_GRANT);
  });

  it('credits Whuffies without touching chips', async () => {
    const chipsBefore = wallet.getBalance('u1');
    await wallet.creditWhuffies('u1', 250, 'contest_prize');
    expect(wallet.getWhuffieBalance('u1')).toBe(STARTING_WHUFFIE_GRANT + 250);
    expect(wallet.getBalance('u1')).toBe(chipsBefore);
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

type LedgerInsert = {
  table: string;
  userId: string;
  tableId: string;
  delta: number;
  reason: string;
  balanceAfter: number;
};

/** Records ledger inserts; answers the opening-entry probe and trail selects. */
class FakeLedgerPool implements Queryable {
  inserts: LedgerInsert[] = [];
  selects: Array<{ text: string; params: unknown[] }> = [];
  trailRows: unknown[] = [];

  async query(text: string, params: unknown[] = []) {
    const insert = /INSERT INTO (\w+)/.exec(text);
    if (insert) {
      const [, userId, tableId, delta, reason, balanceAfter] = params as [
        string,
        string,
        string,
        number,
        string,
        number,
      ];
      this.inserts.push({ table: insert[1]!, userId, tableId, delta, reason, balanceAfter });
      return { rows: [] };
    }
    const probe = /SELECT 1 FROM (\w+)/.exec(text);
    if (probe) {
      const hit = this.inserts.some((r) => r.table === probe[1] && r.userId === params[0]);
      return { rows: hit ? [{ '?column?': 1 }] : [] };
    }
    this.selects.push({ text, params });
    return { rows: this.trailRows };
  }
}

describe('AuthWalletStore ledger trail', () => {
  let dir: string;
  let auth: AuthStore;
  let wallet: AuthWalletStore;
  let pool: FakeLedgerPool;

  beforeEach(async () => {
    dir = await mkdtemp(path.join(os.tmpdir(), 'wallet-trail-'));
    auth = new AuthStore(dir);
    await auth.init();
    await auth.seedUser('u1', 'alice', 'password1');
    wallet = new AuthWalletStore(auth);
    pool = new FakeLedgerPool();
    wallet.setPool(pool);
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('records chip changes with the balance after each change', async () => {
    await wallet.credit('u1', 500, 'admin_credit');
    await wallet.debit('u1', 200, 'admin_reset');
    expect(pool.inserts).toEqual([
      {
        table: 'chip_ledger',
        userId: 'u1',
        tableId: '',
        delta: STARTING_CHIP_GRANT,
        reason: 'opening_balance',
        balanceAfter: STARTING_CHIP_GRANT,
      },
      {
        table: 'chip_ledger',
        userId: 'u1',
        tableId: '',
        delta: 500,
        reason: 'admin_credit',
        balanceAfter: STARTING_CHIP_GRANT + 500,
      },
      {
        table: 'chip_ledger',
        userId: 'u1',
        tableId: '',
        delta: -200,
        reason: 'admin_reset',
        balanceAfter: STARTING_CHIP_GRANT + 300,
      },
    ]);
  });

  it('records Whuffie changes in the Whuffie ledger', async () => {
    await wallet.creditWhuffies('u1', 250, 'contest_prize', 'c1');
    await wallet.debitWhuffies('u1', 100, 'admin_reset');
    expect(pool.inserts.filter((r) => r.table === 'chip_ledger')).toEqual([]);
    expect(pool.inserts).toEqual([
      {
        table: 'whuffie_ledger',
        userId: 'u1',
        tableId: 'c1',
        delta: 250,
        reason: 'contest_prize',
        balanceAfter: STARTING_WHUFFIE_GRANT + 250,
      },
      {
        table: 'whuffie_ledger',
        userId: 'u1',
        tableId: '',
        delta: -100,
        reason: 'admin_reset',
        balanceAfter: STARTING_WHUFFIE_GRANT + 150,
      },
    ]);
  });

  it('writes the opening entry only once', async () => {
    await wallet.ensureStartingBalance('u1');
    await wallet.ensureStartingBalance('u1');
    const fresh = new AuthWalletStore(auth);
    fresh.setPool(pool);
    await fresh.ensureStartingBalance('u1');
    const openings = pool.inserts.filter((r) => r.reason === 'opening_balance');
    expect(openings).toHaveLength(1);
    expect(openings[0]).toMatchObject({ table: 'chip_ledger', delta: STARTING_CHIP_GRANT });
  });

  it('skips the opening entry for a zero balance', async () => {
    await wallet.ensureStartingWhuffies('u1');
    expect(pool.inserts.filter((r) => r.table === 'whuffie_ledger')).toEqual([]);
  });

  it('pages the trail newest first with a keyset cursor', async () => {
    const ts = '2026-10-05T12:00:00.123456Z';
    pool.trailRows = [
      {
        id: 'a',
        table_id: 'c1',
        delta: 250,
        reason: 'contest_prize',
        balance_after: 400,
        created_at: new Date('2026-10-05T12:00:01Z'),
        cursor_ts: '2026-10-05T12:00:01.000000Z',
      },
      {
        id: 'b',
        table_id: '',
        delta: '150',
        reason: 'offline_win',
        balance_after: null,
        created_at: '2026-10-05T12:00:00.123Z',
        cursor_ts: ts,
      },
      {
        id: 'c',
        table_id: '',
        delta: 1,
        reason: 'offline_win',
        balance_after: 1,
        created_at: '2026-10-05T11:00:00Z',
        cursor_ts: '2026-10-05T11:00:00.000000Z',
      },
    ];
    const before = encodeTrailCursor('2026-10-06T00:00:00.000000Z', 'z');
    const page = await wallet.listTrail('u1', 'whuffies', { before, limit: 2 });

    const select = pool.selects.at(-1)!;
    expect(select.text).toContain('FROM whuffie_ledger');
    expect(select.text).toContain('(created_at, id) < ($2::timestamptz, $3)');
    expect(select.params).toEqual(['u1', '2026-10-06T00:00:00.000000Z', 'z', 3]);

    expect(page.entries).toEqual([
      {
        id: 'a',
        currency: 'whuffies',
        delta: 250,
        balanceAfter: 400,
        reason: 'contest_prize',
        refId: 'c1',
        createdAt: Date.parse('2026-10-05T12:00:01Z'),
      },
      {
        id: 'b',
        currency: 'whuffies',
        delta: 150,
        balanceAfter: null,
        reason: 'offline_win',
        refId: '',
        createdAt: Date.parse('2026-10-05T12:00:00.123Z'),
      },
    ]);
    expect(decodeTrailCursor(page.nextCursor!)).toEqual({ ts, id: 'b' });
  });

  it('returns no cursor on the last page', async () => {
    pool.trailRows = [];
    const page = await wallet.listTrail('u1', 'chips');
    expect(page).toEqual({ entries: [], nextCursor: null });
    expect(pool.selects.at(-1)!.params).toEqual(['u1', 26]);
  });

  it('rejects a malformed cursor', async () => {
    await expect(
      wallet.listTrail('u1', 'chips', { before: 'not-a-cursor' }),
    ).rejects.toMatchObject({ code: 'invalid_cursor' });
  });

  it('returns an empty trail without a database', async () => {
    const offline = new AuthWalletStore(auth);
    expect(await offline.listTrail('u1', 'chips')).toEqual({ entries: [], nextCursor: null });
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
    rooms = new RoomManager(new MemoryKv(), memoryHistory(), new MemoryTableChipStore());
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
    rooms = new RoomManager(new MemoryKv(), memoryHistory(), chips);
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
