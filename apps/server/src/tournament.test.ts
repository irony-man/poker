import { describe, expect, it, beforeEach } from 'vitest';
import { MemoryKv } from './kv.js';
import type { HandHistoryStore } from './history.js';
import { RoomManager } from './room.js';
import { TournamentManager } from './tournament.js';

function memoryHistory(): HandHistoryStore {
  return {
    async recordTable() {},
    async recordHand() {},
    async listHands() {
      return [];
    },
  };
}

describe('TournamentManager', () => {
  let rooms: RoomManager;
  let tournaments: TournamentManager;

  beforeEach(() => {
    rooms = new RoomManager(new MemoryKv(), memoryHistory());
    tournaments = new TournamentManager(rooms);
  });

  it('creates chips contest with equal stacks and no top-up', () => {
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

    const started = tournaments.start(created.id, 'host');
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
    const result = room!.doTopUp('host', hostSeat, 500);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/top-up/i);
  });

  it('places players in chip-elimination order (last standing wins)', () => {
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
    const view = tournaments.start(created.id, 'host').contest!;

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

  it('creates rounds contest with hand limit and allows top-up', () => {
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
    const view = tournaments.start(created.id, 'host').contest!;

    expect(view.status).toBe('running');
    expect(view.mode).toBe('rounds');
    expect(view.handLimit).toBe(10);
    expect(view.handsPlayed).toBe(0);
    const room = rooms.get(view.tableId!)!;
    expect(room.meta.tournament?.allowTopUp).toBe(true);

    const hostSeat = room.seatedPlayersSnapshot().find((p) => p.userId === 'host')!.seat;
    room.state.players[hostSeat]!.stack = 0;
    const result = room.doTopUp('host', hostSeat, 1000);
    expect(result.ok).toBe(true);
    expect(room.state.players[hostSeat]!.stack).toBe(1000);
  });

  it('finishes rounds contest by chip leader after hand limit', () => {
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
    const view = tournaments.start(created.id, 'host').contest!;

    const room = rooms.get(view.tableId!)!;
    // Give host a clear chip lead
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

  it('auto-tops bots during rounds contests', () => {
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
    const view = tournaments.start(created.id, 'host').contest!;

    const room = rooms.get(view.tableId!)!;
    const bot = room.seatedPlayersSnapshot().find((p) => p.userId !== 'host')!;
    room.state.players[bot.seat]!.stack = 0;
    expect(room.autoTopUpBrokeBots()).toBe(1);
    expect(room.state.players[bot.seat]!.stack).toBe(1000);
  });

  it('registers players until field is full then auto-starts', () => {
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
    tournaments.register(view.id, 'p2', 'Bob');
    expect(tournaments.get(view.id)!.status).toBe('registering');
    tournaments.register(view.id, 'p3', 'Carol');
    expect(tournaments.get(view.id)!.status).toBe('running');
    expect(tournaments.listPublic()).toHaveLength(0);
  });

  it('lists contests the user has joined', () => {
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
    tournaments.register(a.id, 'friend', 'Friend');
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
