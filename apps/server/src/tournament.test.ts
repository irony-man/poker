import { describe, expect, it, beforeEach } from 'vitest';
import { CONTEST_COMPLETION_WHUFFIES } from '@poker/protocol';
import { MemoryKv } from './kv/kv.store.js';
import { memoryHistoryStore, type HandHistoryStore } from './history/history.store.js';
import { RoomManager } from './rooms/room.js';
import { TournamentManager } from './contests/tournament.js';
import type { ContestPersistence, PersistedContest } from './contests/contest.store.js';
import { UnlimitedWalletStore, type WalletStore } from './wallet/wallet.store.js';
import type {
  WalletMutationResult,
  WalletReason,
  WhuffieReason,
} from './wallet/wallet.constants.js';

function memoryHistory(): HandHistoryStore {
  return memoryHistoryStore();
}

class TrackingWallet extends UnlimitedWalletStore implements WalletStore {
  credits: { userId: string; amount: number; reason: WalletReason }[] = [];
  debits: { userId: string; amount: number; reason: WalletReason }[] = [];
  whuffieCredits: { userId: string; amount: number; reason: WhuffieReason }[] = [];
  async debit(
    userId: string,
    amount: number,
    reason: WalletReason,
    tableId?: string,
  ): Promise<WalletMutationResult> {
    this.debits.push({ userId, amount, reason });
    return super.debit(userId, amount, reason, tableId);
  }
  async credit(
    userId: string,
    amount: number,
    reason: WalletReason,
    tableId?: string,
  ): Promise<WalletMutationResult> {
    this.credits.push({ userId, amount, reason });
    return super.credit(userId, amount, reason, tableId);
  }
  async creditWhuffies(
    userId: string,
    amount: number,
    reason: WhuffieReason,
    tableId?: string,
  ): Promise<WalletMutationResult> {
    this.whuffieCredits.push({ userId, amount, reason });
    return super.creditWhuffies(userId, amount, reason, tableId);
  }
}

/** Fill remaining human seats so start (or autoStart) has a full field. */
async function fillHumans(
  tournaments: TournamentManager,
  contestId: string,
  count: number,
  prefix = 'p',
): Promise<string[]> {
  const ids: string[] = [];
  for (let i = 0; i < count; i++) {
    const userId = `${prefix}${i + 2}`;
    const name = `Player${i + 2}`;
    const result = await tournaments.register(contestId, userId, name);
    expect(result.ok).toBe(true);
    ids.push(userId);
  }
  return ids;
}

describe('TournamentManager', () => {
  let rooms: RoomManager;
  let tournaments: TournamentManager;
  let wallet: TrackingWallet;

  beforeEach(() => {
    rooms = new RoomManager(new MemoryKv(), memoryHistory());
    wallet = new TrackingWallet();
    tournaments = new TournamentManager(rooms, wallet);
  });

  it('creates chips contest with equal stacks and no top-up', async () => {
    const created = await tournaments.create({
      name: 'SNG',
      mode: 'chips',
      hostUserId: 'host',
      hostName: 'Host',
      fieldSize: 4,
      startingStack: 500,
      smallBlind: 5,
      bigBlind: 10,
      turnTimeMs: 20_000,
      botCount: 0,
      isPrivate: true,
      autoStart: false,
    });
    expect(created.status).toBe('registering');
    expect(created.entrants).toHaveLength(1);

    await fillHumans(tournaments, created.id, 3);
    const started = await tournaments.start(created.id, 'host');
    expect(started.ok).toBe(true);
    const view = started.contest!;
    expect(view.status).toBe('running');
    expect(view.mode).toBe('chips');
    expect(view.handLimit).toBeNull();
    expect(view.tableId).toBeTruthy();
    const room = rooms.get(view.tableId!);
    expect(room?.isTournament()).toBe(true);
    expect(room?.playersWithChips()).toHaveLength(4);
    expect(room?.meta.tournament?.allowTopUp).toBeFalsy();

    for (const p of room!.seatedPlayersSnapshot()) {
      expect(p.stack).toBe(500);
    }

    const hostSeat = room!.seatedPlayersSnapshot().find((p) => p.userId === 'host')!.seat;
    room!.state.players[hostSeat]!.stack = 0;
    const result = await room!.doTopUp('host', hostSeat, 500);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/top-up/i);
  });

  it('refuses start until two humans are registered (ignores botCount)', async () => {
    const created = await tournaments.create({
      name: 'No bots',
      mode: 'chips',
      hostUserId: 'host',
      hostName: 'Host',
      fieldSize: 4,
      startingStack: 500,
      smallBlind: 5,
      bigBlind: 10,
      turnTimeMs: 20_000,
      botCount: 3,
      isPrivate: true,
      autoStart: false,
    });
    const alone = await tournaments.start(created.id, 'host');
    expect(alone.ok).toBe(false);
    expect(alone.error).toMatch(/2 players/i);
    expect(tournaments.get(created.id)!.entrants).toHaveLength(1);
  });

  it('rejects register after contest has ended', async () => {
    const created = await tournaments.create({
      name: 'Ended',
      mode: 'chips',
      hostUserId: 'host',
      hostName: 'Host',
      fieldSize: 3,
      startingStack: 500,
      smallBlind: 5,
      bigBlind: 10,
      turnTimeMs: 20_000,
      botCount: 0,
      isPrivate: true,
      autoStart: false,
    });
    const others = await fillHumans(tournaments, created.id, 2);
    const view = (await tournaments.start(created.id, 'host')).contest!;
    tournaments.forceEliminate(view.id, others[0]!);
    tournaments.forceEliminate(view.id, others[1]!);
    expect(tournaments.get(view.id)!.status).toBe('completed');

    const late = await tournaments.register(view.id, 'latecomer', 'Late');
    expect(late.ok).toBe(false);
    expect(late.error).toMatch(/ended/i);
    expect(tournaments.get(view.id)!.assignments.every((a) => a.tableId == null)).toBe(true);

    const room = rooms.get(view.tableId!);
    expect(room?.meta.tournament?.frozen).toBe(true);
  });

  it('places players in chip-elimination order (last standing wins)', async () => {
    const created = await tournaments.create({
      name: 'Freezeout',
      mode: 'chips',
      hostUserId: 'host',
      hostName: 'Host',
      fieldSize: 4,
      startingStack: 500,
      smallBlind: 5,
      bigBlind: 10,
      turnTimeMs: 20_000,
      botCount: 0,
      isPrivate: true,
      autoStart: false,
    });
    const others = await fillHumans(tournaments, created.id, 3);
    const view = (await tournaments.start(created.id, 'host')).contest!;

    tournaments.forceEliminate(view.id, others[0]!);
    tournaments.forceEliminate(view.id, others[1]!);
    tournaments.forceEliminate(view.id, others[2]!);

    const c = tournaments.get(view.id)!;
    expect(c.status).toBe('completed');
    expect(c.placements.find((p) => p.place === 1)?.userId).toBe('host');
    expect(c.placements).toHaveLength(4);
    expect(c.placements.find((p) => p.userId === others[0]!)?.place).toBe(4);
    expect(c.placements.find((p) => p.userId === others[1]!)?.place).toBe(3);
    expect(c.placements.find((p) => p.userId === others[2]!)?.place).toBe(2);
  });

  it('pays every player 1 Whuffie and no chips when a contest completes', async () => {
    const created = await tournaments.create({
      name: 'Prize freezeout',
      mode: 'chips',
      hostUserId: 'host',
      hostName: 'Host',
      fieldSize: 4,
      startingStack: 1000,
      smallBlind: 5,
      bigBlind: 10,
      turnTimeMs: 20_000,
      botCount: 0,
      isPrivate: true,
      autoStart: false,
    });
    const others = await fillHumans(tournaments, created.id, 3);
    const view = (await tournaments.start(created.id, 'host')).contest!;
    tournaments.forceEliminate(view.id, others[0]!);
    expect(tournaments.get(view.id)!.placements[0]!.prizeWhuffies).toBeUndefined();
    tournaments.forceEliminate(view.id, others[1]!);
    tournaments.forceEliminate(view.id, others[2]!);

    const c = tournaments.get(view.id)!;
    expect(c.status).toBe('completed');
    expect(c.placements).toHaveLength(4);
    for (const p of c.placements) {
      expect(p.prizeWhuffies).toBe(CONTEST_COMPLETION_WHUFFIES);
    }

    await new Promise((r) => setTimeout(r, 0));
    expect(CONTEST_COMPLETION_WHUFFIES).toBe(1);
    expect(wallet.whuffieCredits).toHaveLength(4);
    expect(wallet.whuffieCredits).toEqual(
      expect.arrayContaining(
        ['host', ...others].map((userId) => ({ userId, amount: 1, reason: 'contest_prize' })),
      ),
    );
    expect(wallet.credits).toEqual([]);
    expect(wallet.debits).toEqual([]);
  });

  it('pays 1 Whuffie to every player when a rounds contest completes', async () => {
    const created = await tournaments.create({
      name: 'Rounds prize',
      mode: 'rounds',
      hostUserId: 'host',
      hostName: 'Host',
      fieldSize: 3,
      startingStack: 1000,
      smallBlind: 5,
      bigBlind: 10,
      turnTimeMs: 20_000,
      botCount: 0,
      isPrivate: true,
      autoStart: false,
      handLimit: 5,
    });
    const others = await fillHumans(tournaments, created.id, 2);
    const view = (await tournaments.start(created.id, 'host')).contest!;
    for (let i = 0; i < 5; i++) tournaments.forceHandEnded(view.id);
    expect(tournaments.get(view.id)!.status).toBe('completed');

    await new Promise((r) => setTimeout(r, 0));
    expect(wallet.whuffieCredits.map((x) => x.userId).sort()).toEqual(['host', ...others].sort());
    expect(wallet.whuffieCredits.every((x) => x.amount === 1)).toBe(true);
    expect(wallet.credits).toEqual([]);
  });

  it('creates rounds contest with hand limit and allows top-up', async () => {
    const created = await tournaments.create({
      name: 'Session',
      mode: 'rounds',
      hostUserId: 'host',
      hostName: 'Host',
      fieldSize: 3,
      startingStack: 1000,
      smallBlind: 5,
      bigBlind: 10,
      turnTimeMs: 20_000,
      botCount: 0,
      isPrivate: true,
      autoStart: false,
      handLimit: 10,
    });
    await fillHumans(tournaments, created.id, 2);
    const view = (await tournaments.start(created.id, 'host')).contest!;

    expect(view.status).toBe('running');
    expect(view.mode).toBe('rounds');
    expect(view.handLimit).toBe(10);
    expect(view.handsPlayed).toBe(0);
    const room = rooms.get(view.tableId!)!;
    expect(room.meta.tournament?.allowTopUp).toBe(true);

    const hostSeat = room.seatedPlayersSnapshot().find((p) => p.userId === 'host')!.seat;
    room.state.players[hostSeat]!.stack = 0;
    const result = await room.doTopUp('host', hostSeat, 1000);
    expect(result.ok).toBe(true);
    expect(room.state.players[hostSeat]!.stack).toBe(1000);
    expect(wallet.debits).toEqual([]);
  });

  it('finishes rounds contest by chip leader after hand limit', async () => {
    const created = await tournaments.create({
      name: 'Short session',
      mode: 'rounds',
      hostUserId: 'host',
      hostName: 'Host',
      fieldSize: 3,
      startingStack: 1000,
      smallBlind: 5,
      bigBlind: 10,
      turnTimeMs: 20_000,
      botCount: 0,
      isPrivate: true,
      autoStart: false,
      handLimit: 2,
    });
    await fillHumans(tournaments, created.id, 2);
    const view = (await tournaments.start(created.id, 'host')).contest!;

    const room = rooms.get(view.tableId!)!;
    for (const p of room.state.players) {
      if (!p.userId) continue;
      p.stack = p.userId === 'host' ? 2500 : 250;
    }

    tournaments.forceHandEnded(view.id);
    expect(tournaments.get(view.id)!.status).toBe('running');
    expect(tournaments.get(view.id)!.handsPlayed).toBe(1);

    tournaments.forceHandEnded(view.id);
    const c = tournaments.get(view.id)!;
    expect(c.status).toBe('completed');
    expect(c.handsPlayed).toBe(2);
    expect(c.placements.find((p) => p.place === 1)?.userId).toBe('host');
    expect(c.placements).toHaveLength(3);
    expect(room.meta.tournament?.frozen).toBe(true);
  });

  it('registers players until field is full then auto-starts', async () => {
    const view = await tournaments.create({
      name: 'Reg',
      mode: 'chips',
      hostUserId: 'host',
      hostName: 'Host',
      fieldSize: 3,
      startingStack: 1000,
      smallBlind: 5,
      bigBlind: 10,
      turnTimeMs: 20_000,
      botCount: 0,
      isPrivate: false,
      autoStart: true,
    });
    expect(view.status).toBe('registering');
    await tournaments.register(view.id, 'p2', 'Bob');
    expect(tournaments.get(view.id)!.status).toBe('registering');
    await tournaments.register(view.id, 'p3', 'Carol');
    expect(tournaments.get(view.id)!.status).toBe('running');
    expect(tournaments.listPublic()).toHaveLength(0);
  });

  it('lists contests the user has joined', async () => {
    const a = await tournaments.create({
      name: 'Mine',
      mode: 'chips',
      hostUserId: 'host',
      hostName: 'Host',
      fieldSize: 3,
      startingStack: 1000,
      smallBlind: 5,
      bigBlind: 10,
      turnTimeMs: 20_000,
      botCount: 0,
      isPrivate: true,
      autoStart: false,
    });
    await tournaments.register(a.id, 'friend', 'Friend');
    const other = await tournaments.create({
      name: 'Other',
      mode: 'chips',
      hostUserId: 'other-host',
      hostName: 'Other',
      fieldSize: 3,
      startingStack: 1000,
      smallBlind: 5,
      bigBlind: 10,
      turnTimeMs: 20_000,
      botCount: 0,
      isPrivate: true,
      autoStart: false,
    });
    void other;
    const mine = tournaments.listForUser('friend');
    expect(mine.map((c) => c.id)).toEqual([a.id]);
    expect(tournaments.listForUser('host').map((c) => c.id)).toContain(a.id);
  });

  it('does not charge chips on create, register, or start', async () => {
    const created = await tournaments.create({
      name: 'Free entry',
      mode: 'chips',
      hostUserId: 'host',
      hostName: 'Host',
      fieldSize: 3,
      startingStack: 1000,
      smallBlind: 5,
      bigBlind: 10,
      turnTimeMs: 20_000,
      botCount: 0,
      isPrivate: true,
      autoStart: false,
    });
    await tournaments.register(created.id, 'p2', 'Bob');
    const started = await tournaments.start(created.id, 'host');
    expect(started.ok).toBe(true);
    expect(wallet.debits).toEqual([]);
    expect(wallet.credits).toEqual([]);
  });

  it('unregisters without touching chips', async () => {
    const created = await tournaments.create({
      name: 'Leave',
      mode: 'chips',
      hostUserId: 'host',
      hostName: 'Host',
      fieldSize: 4,
      startingStack: 500,
      smallBlind: 5,
      bigBlind: 10,
      turnTimeMs: 20_000,
      botCount: 0,
      isPrivate: true,
      autoStart: false,
    });
    await tournaments.register(created.id, 'p2', 'Bob');
    const left = await tournaments.unregister(created.id, 'p2');
    expect(left.ok).toBe(true);
    expect(wallet.credits).toEqual([]);
    expect(tournaments.get(created.id)!.entrants.map((e) => e.userId)).toEqual(['host']);
  });

  it('cancels a registering contest when the host account is removed', async () => {
    const created = await tournaments.create({
      name: 'Host gone',
      mode: 'chips',
      hostUserId: 'host',
      hostName: 'Host',
      fieldSize: 4,
      startingStack: 500,
      smallBlind: 5,
      bigBlind: 10,
      turnTimeMs: 20_000,
      botCount: 0,
      isPrivate: true,
      autoStart: false,
    });
    await tournaments.register(created.id, 'p2', 'Bob');
    await tournaments.removeUser('host');
    expect(tournaments.get(created.id)!.status).toBe('cancelled');
    expect(wallet.credits).toEqual([]);
    expect(wallet.whuffieCredits).toEqual([]);
  });

  it('unregisters a non-host from a registering contest when their account is removed', async () => {
    const created = await tournaments.create({
      name: 'Player gone',
      mode: 'chips',
      hostUserId: 'host',
      hostName: 'Host',
      fieldSize: 4,
      startingStack: 500,
      smallBlind: 5,
      bigBlind: 10,
      turnTimeMs: 20_000,
      botCount: 0,
      isPrivate: true,
      autoStart: false,
    });
    await tournaments.register(created.id, 'p2', 'Bob');
    await tournaments.removeUser('p2');
    expect(tournaments.get(created.id)!.status).toBe('registering');
    expect(tournaments.get(created.id)!.entrants.map((e) => e.userId)).toEqual(['host']);
    expect(wallet.credits).toEqual([]);
  });
});

class MemoryContestStore implements ContestPersistence {
  rows = new Map<string, PersistedContest>();
  async loadAll(): Promise<PersistedContest[]> {
    return [...this.rows.values()].map((p) => structuredClone(p));
  }
  async save(contest: PersistedContest): Promise<void> {
    this.rows.set(contest.id, structuredClone(contest));
  }
}

describe('TournamentManager persistence', () => {
  let store: MemoryContestStore;
  let wallet: TrackingWallet;
  let tournaments: TournamentManager;

  const baseOpts = {
    name: 'Saved',
    hostUserId: 'host',
    hostName: 'Host',
    fieldSize: 2,
    startingStack: 500,
    smallBlind: 5,
    bigBlind: 10,
    turnTimeMs: 20_000,
    botCount: 0,
    isPrivate: true,
    autoStart: false,
  };

  function boot(): TournamentManager {
    const tm = new TournamentManager(new RoomManager(new MemoryKv(), memoryHistory()), wallet);
    tm.setPersistence(store);
    return tm;
  }

  async function restart(): Promise<TournamentManager> {
    await tournaments.flushPersistence();
    wallet = new TrackingWallet();
    const next = boot();
    await next.restore();
    return next;
  }

  /** Simulate a snapshot saved before contests stopped charging chip buy-ins. */
  async function markLegacyPaid(contestId: string, userIds: string[]): Promise<void> {
    await tournaments.flushPersistence();
    store.rows.get(contestId)!.entryPaid = userIds;
  }

  beforeEach(() => {
    store = new MemoryContestStore();
    wallet = new TrackingWallet();
    tournaments = boot();
  });

  it('keeps registering contests (entrants, invite code) across a restart', async () => {
    const created = await tournaments.create({ ...baseOpts, mode: 'chips', fieldSize: 4 });
    await tournaments.register(created.id, 'p2', 'Bob');

    const after = await restart();
    const view = after.get(created.id);
    expect(view?.status).toBe('registering');
    expect(view?.entrants.map((e) => e.userId)).toEqual(['host', 'p2']);
    expect(after.getByInvite(created.inviteCode)?.id).toBe(created.id);
    expect(after.listPublic()).toHaveLength(0);
    expect(after.listForUser('p2').map((c) => c.id)).toEqual([created.id]);
    expect(wallet.credits).toEqual([]);

    const left = await after.unregister(created.id, 'p2');
    expect(left.ok).toBe(true);
    expect(wallet.credits).toEqual([]);
  });

  it('refunds legacy chip buy-ins on registering contests once at restore', async () => {
    const created = await tournaments.create({ ...baseOpts, mode: 'chips', fieldSize: 4 });
    await tournaments.register(created.id, 'p2', 'Bob');
    await markLegacyPaid(created.id, ['host', 'p2']);

    const after = await restart();
    expect(after.get(created.id)?.status).toBe('registering');
    expect(wallet.credits).toEqual(
      expect.arrayContaining([
        { userId: 'host', amount: 500, reason: 'cash_out' },
        { userId: 'p2', amount: 500, reason: 'cash_out' },
      ]),
    );
    expect(wallet.credits).toHaveLength(2);

    tournaments = after;
    await restart();
    expect(wallet.credits).toHaveLength(0);
  });

  it('cancels a contest interrupted mid-game without moving chips', async () => {
    const created = await tournaments.create({ ...baseOpts, mode: 'chips' });
    await tournaments.register(created.id, 'p2', 'Bob');
    await tournaments.start(created.id, 'host');

    const after = await restart();
    const view = after.get(created.id);
    expect(view?.status).toBe('cancelled');
    expect(wallet.credits).toEqual([]);
    expect(wallet.whuffieCredits).toEqual([]);
  });

  it('cancels a legacy contest interrupted mid-game and refunds last known stacks', async () => {
    const created = await tournaments.create({ ...baseOpts, mode: 'chips' });
    await tournaments.register(created.id, 'p2', 'Bob');
    const started = await tournaments.start(created.id, 'host');
    expect(started.contest?.status).toBe('running');
    await markLegacyPaid(created.id, ['host', 'p2']);

    const after = await restart();
    const view = after.get(created.id);
    expect(view?.status).toBe('cancelled');
    expect(view?.assignments.every((a) => a.tableId === null)).toBe(true);
    expect(wallet.credits).toEqual(
      expect.arrayContaining([
        { userId: 'host', amount: 500, reason: 'cash_out' },
        { userId: 'p2', amount: 500, reason: 'cash_out' },
      ]),
    );

    // A second restart must not refund again.
    tournaments = after;
    const again = await restart();
    expect(again.get(created.id)?.status).toBe('cancelled');
    expect(wallet.credits).toHaveLength(0);
  });

  it('refunds legacy contests the stacks recorded after the last finished hand', async () => {
    const rooms = new RoomManager(new MemoryKv(), memoryHistory());
    tournaments = new TournamentManager(rooms, wallet);
    tournaments.setPersistence(store);
    const created = await tournaments.create({ ...baseOpts, mode: 'rounds', handLimit: 10 });
    await tournaments.register(created.id, 'p2', 'Bob');
    const started = await tournaments.start(created.id, 'host');
    const room = rooms.get(started.contest!.tableId!)!;
    for (const p of room.state.players) {
      if (p.userId === 'host') p.stack = 650;
      if (p.userId === 'p2') p.stack = 350;
    }
    tournaments.forceHandEnded(created.id);
    await markLegacyPaid(created.id, ['host', 'p2']);

    const after = await restart();
    expect(after.get(created.id)?.status).toBe('cancelled');
    expect(wallet.credits).toEqual(
      expect.arrayContaining([
        { userId: 'host', amount: 650, reason: 'cash_out' },
        { userId: 'p2', amount: 350, reason: 'cash_out' },
      ]),
    );
  });

  it('keeps completed contests with standings and does not pay again', async () => {
    const created = await tournaments.create({ ...baseOpts, mode: 'chips' });
    await tournaments.register(created.id, 'p2', 'Bob');
    await tournaments.start(created.id, 'host');
    tournaments.forceEliminate(created.id, 'p2');
    expect(tournaments.get(created.id)?.status).toBe('completed');

    const after = await restart();
    const view = after.get(created.id);
    expect(view?.status).toBe('completed');
    expect(view?.placements.map((p) => [p.userId, p.place])).toEqual([
      ['host', 1],
      ['p2', 2],
    ]);
    expect(wallet.credits).toHaveLength(0);
    expect(wallet.whuffieCredits).toHaveLength(0);
  });
});
