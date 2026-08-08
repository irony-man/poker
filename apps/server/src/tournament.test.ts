import { describe, expect, it, beforeEach } from 'vitest';
import { contestPlacementPrize } from '@poker/protocol';
import { MemoryKv } from './kv/kv.store.js';
import type { HandHistoryStore } from './history/history.store.js';
import { RoomManager } from './rooms/room.js';
import { TournamentManager } from './contests/tournament.js';
import { UnlimitedWalletStore, type WalletStore } from './wallet/wallet.store.js';
import type { WalletMutationResult, WalletReason } from './wallet/wallet.constants.js';

function memoryHistory(): HandHistoryStore {
  return {
    async recordTable() {},
    async recordHand() {},
    async listHands() {
      return [];
    },
  };
}

class TrackingWallet extends UnlimitedWalletStore implements WalletStore {
  credits: { userId: string; amount: number; reason: WalletReason }[] = [];
  async credit(
    userId: string,
    amount: number,
    reason: WalletReason,
    tableId?: string,
  ): Promise<WalletMutationResult> {
    this.credits.push({ userId, amount, reason });
    return super.credit(userId, amount, reason, tableId);
  }
}

describe('contestPlacementPrize', () => {
  it('pays top three in multiway fields', () => {
    expect(contestPlacementPrize(1, 4, 1000)).toBe(200);
    expect(contestPlacementPrize(2, 4, 1000)).toBe(120);
    expect(contestPlacementPrize(3, 4, 1000)).toBe(80);
    expect(contestPlacementPrize(4, 4, 1000)).toBe(0);
  });

  it('pays both seats heads-up', () => {
    expect(contestPlacementPrize(1, 2, 1000)).toBe(140);
    expect(contestPlacementPrize(2, 2, 1000)).toBe(60);
  });
});

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
    const created = tournaments.create({
      name: 'SNG',
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
      autoStart: true,
    });
    expect(created.status).toBe('registering');
    expect(created.entrants).toHaveLength(1);

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

  it('places players in chip-elimination order (last standing wins)', async () => {
    const created = tournaments.create({
      name: 'Freezeout',
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
      autoStart: true,
    });
    const view = (await tournaments.start(created.id, 'host')).contest!;

    const bots = view.entrants.filter((e) => e.userId !== 'host');
    tournaments.forceEliminate(view.id, bots[0]!.userId);
    tournaments.forceEliminate(view.id, bots[1]!.userId);
    tournaments.forceEliminate(view.id, bots[2]!.userId);

    const c = tournaments.get(view.id)!;
    expect(c.status).toBe('completed');
    expect(c.placements.find((p) => p.place === 1)?.userId).toBe('host');
    expect(c.placements).toHaveLength(4);
    expect(c.placements.find((p) => p.userId === bots[0]!.userId)?.place).toBe(4);
    expect(c.placements.find((p) => p.userId === bots[1]!.userId)?.place).toBe(3);
    expect(c.placements.find((p) => p.userId === bots[2]!.userId)?.place).toBe(2);
  });

  it('pays ranking Wuffies prizes to the human winner', async () => {
    const created = tournaments.create({
      name: 'Prize freezeout',
      mode: 'chips',
      hostUserId: 'host',
      hostName: 'Host',
      fieldSize: 4,
      startingStack: 1000,
      smallBlind: 5,
      bigBlind: 10,
      turnTimeMs: 20_000,
      botCount: 3,
      isPrivate: true,
      autoStart: true,
    });
    const view = (await tournaments.start(created.id, 'host')).contest!;
    const bots = view.entrants.filter((e) => e.userId !== 'host');
    tournaments.forceEliminate(view.id, bots[0]!.userId);
    tournaments.forceEliminate(view.id, bots[1]!.userId);
    tournaments.forceEliminate(view.id, bots[2]!.userId);

    const c = tournaments.get(view.id)!;
    expect(c.status).toBe('completed');
    const first = c.placements.find((p) => p.place === 1)!;
    expect(first.userId).toBe('host');
    expect(first.prizeWuffies).toBe(contestPlacementPrize(1, 4, 1000));

    await new Promise((r) => setTimeout(r, 0));
    const prizeCredits = wallet.credits.filter((x) => x.reason === 'contest_prize');
    expect(prizeCredits).toEqual([
      { userId: 'host', amount: contestPlacementPrize(1, 4, 1000), reason: 'contest_prize' },
    ]);
  });

  it('creates rounds contest with hand limit and allows top-up', async () => {
    const created = tournaments.create({
      name: 'Session',
      mode: 'rounds',
      hostUserId: 'host',
      hostName: 'Host',
      fieldSize: 3,
      startingStack: 1000,
      smallBlind: 5,
      bigBlind: 10,
      turnTimeMs: 20_000,
      botCount: 2,
      isPrivate: true,
      autoStart: true,
      handLimit: 10,
    });
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
  });

  it('finishes rounds contest by chip leader after hand limit', async () => {
    const created = tournaments.create({
      name: 'Short session',
      mode: 'rounds',
      hostUserId: 'host',
      hostName: 'Host',
      fieldSize: 3,
      startingStack: 1000,
      smallBlind: 5,
      bigBlind: 10,
      turnTimeMs: 20_000,
      botCount: 2,
      isPrivate: true,
      autoStart: true,
      handLimit: 2,
    });
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

  it('auto-tops bots during rounds contests', async () => {
    const created = tournaments.create({
      name: 'Bot rebuy',
      mode: 'rounds',
      hostUserId: 'host',
      hostName: 'Host',
      fieldSize: 2,
      startingStack: 1000,
      smallBlind: 5,
      bigBlind: 10,
      turnTimeMs: 20_000,
      botCount: 1,
      isPrivate: true,
      autoStart: true,
      handLimit: 5,
    });
    const view = (await tournaments.start(created.id, 'host')).contest!;

    const room = rooms.get(view.tableId!)!;
    const bot = room.seatedPlayersSnapshot().find((p) => p.userId !== 'host')!;
    room.state.players[bot.seat]!.stack = 0;
    expect(room.autoTopUpBrokeBots()).toBe(1);
    expect(room.state.players[bot.seat]!.stack).toBe(1000);
  });

  it('registers players until field is full then auto-starts', async () => {
    const view = tournaments.create({
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
    const a = tournaments.create({
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
    const other = tournaments.create({
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
});
