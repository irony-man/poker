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

  it('creates knockout with host + bots and builds first-round matches', () => {
    const view = tournaments.create({
      name: 'KO 4',
      mode: 'knockout',
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

    expect(view.status).toBe('running');
    expect(view.entrants).toHaveLength(4);
    expect(view.matches.filter((m) => m.round === 0)).toHaveLength(2);
    expect(view.matches.filter((m) => m.status === 'active')).toHaveLength(2);
    for (const m of view.matches.filter((m) => m.round === 0)) {
      expect(m.tableId).toBeTruthy();
      expect(m.playerA).toBeTruthy();
      expect(m.playerB).toBeTruthy();
      const room = rooms.get(m.tableId!);
      expect(room).toBeTruthy();
      expect(room!.isTournament()).toBe(true);
      expect(room!.playersWithChips()).toHaveLength(2);
    }
  });

  it('advances knockout bracket and crowns a champion', () => {
    const view = tournaments.create({
      name: 'KO Adv',
      mode: 'knockout',
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

    const round0 = view.matches.filter((m) => m.round === 0);
    expect(round0).toHaveLength(2);

    const m0 = round0[0]!;
    const m1 = round0[1]!;
    tournaments.forceCompleteMatch(view.id, m0.id, m0.playerA!);
    tournaments.forceCompleteMatch(view.id, m1.id, m1.playerA!);

    let c = tournaments.get(view.id)!;
    const final = c.matches.find((m) => m.round === 1);
    expect(final).toBeTruthy();
    expect(final!.status).toBe('active');
    expect(final!.playerA).toBe(m0.playerA);
    expect(final!.playerB).toBe(m1.playerA);
    expect(c.placements).toHaveLength(2); // two R1 losers

    tournaments.forceCompleteMatch(view.id, final!.id, final!.playerA!);
    c = tournaments.get(view.id)!;
    expect(c.status).toBe('completed');
    expect(c.placements.find((p) => p.place === 1)?.userId).toBe(final!.playerA);
    expect(c.placements).toHaveLength(4);
  });

  it('creates table-match and places players in elimination order', () => {
    const view = tournaments.create({
      name: 'SNG',
      mode: 'table_match',
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

    expect(view.status).toBe('running');
    expect(view.tableId).toBeTruthy();
    const room = rooms.get(view.tableId!);
    expect(room?.playersWithChips()).toHaveLength(4);

    const bots = view.entrants.filter((e) => e.userId !== 'host');
    tournaments.forceEliminate(view.id, bots[0]!.userId);
    tournaments.forceEliminate(view.id, bots[1]!.userId);
    tournaments.forceEliminate(view.id, bots[2]!.userId);

    const c = tournaments.get(view.id)!;
    expect(c.status).toBe('completed');
    expect(c.placements.find((p) => p.place === 1)?.userId).toBe('host');
    expect(c.placements).toHaveLength(4);
    // First eliminated gets worst place (4)
    expect(c.placements.find((p) => p.userId === bots[0]!.userId)?.place).toBe(4);
    expect(c.placements.find((p) => p.userId === bots[1]!.userId)?.place).toBe(3);
    expect(c.placements.find((p) => p.userId === bots[2]!.userId)?.place).toBe(2);
  });

  it('rejects top-up on tournament tables', () => {
    const view = tournaments.create({
      name: 'No rebuy',
      mode: 'table_match',
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
    });
    const room = rooms.get(view.tableId!)!;
    const hostSeat = room.seatedPlayersSnapshot().find((p) => p.userId === 'host')!.seat;
    // Force host broke
    const player = room.state.players[hostSeat]!;
    player.stack = 0;
    const result = room.doTopUp('host', hostSeat, 1000);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/top-up/i);
  });

  it('registers players until field is full then auto-starts', () => {
    const view = tournaments.create({
      name: 'Reg',
      mode: 'table_match',
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
    expect(tournaments.listPublic()).toHaveLength(0); // no longer registering
  });
});
