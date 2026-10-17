import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthService } from './auth/auth.service.js';
import type { User } from './auth/auth.types.js';
import { FriendsController } from './friends/friends.controller.js';
import type { FriendsService } from './friends/friends.service.js';
import { createHistoryStore } from './history/history.store.js';
import type { HistoryService } from './history/history.service.js';
import { MemoryKv } from './kv/kv.store.js';
import { MAX_TABLE_SEATS, Room, RoomManager } from './rooms/room.js';
import type { RoomsService } from './rooms/rooms.service.js';
import type { SiteConfigService } from './site-config/site-config.service.js';
import { TablesController } from './tables/tables.controller.js';

const BUY_IN = 1000;

async function setup() {
  const kv = new MemoryKv();
  return new RoomManager(kv, await createHistoryStore());
}

function createTable(
  rooms: RoomManager,
  opts: { maxSeats?: number; lobby?: boolean } = {},
): Room {
  const meta = rooms.create({
    name: 'Lobby',
    hostUserId: 'host',
    isPrivate: true,
    lobby: opts.lobby ?? true,
    config: {
      maxSeats: opts.maxSeats ?? 2,
      smallBlind: 5,
      bigBlind: 10,
      buyIn: BUY_IN,
      turnTimeMs: 30_000,
    },
  });
  return rooms.get(meta.id)!;
}

/** Fold whoever is to act so a heads-up hand ends in payout. */
function foldToPayout(room: Room) {
  const seat = room.state.toAct!;
  const userId = room.state.players[seat]!.userId!;
  expect(room.action(userId, room.state.handId, room.state.actionSeq, 'fold').ok).toBe(true);
  expect(room.state.street).toBe('payout');
}

function roomsService(rooms: RoomManager): RoomsService {
  return {
    create: (opts: Parameters<RoomManager['create']>[0]) => rooms.create(opts),
    get: (id: string) => rooms.get(id),
  } as unknown as RoomsService;
}

describe('Hosted table lobby', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('rejects Ready and never deals while in the lobby', async () => {
    const rooms = await setup();
    const room = createTable(rooms, { maxSeats: 4 });
    expect(room.isLobby()).toBe(true);
    await room.sit('host', 'Host', 0, BUY_IN);
    await room.sit('u2', 'Guest', 1, BUY_IN);
    expect(room.addBot('host').ok).toBe(true);

    expect(room.setReady('host', true)).toEqual({
      ok: false,
      error: 'Waiting for the host to start',
    });
    expect(room.setReady('u2', true).ok).toBe(false);
    await vi.advanceTimersByTimeAsync(30_000);
    expect(room.state.street).toBe('waiting');
  });

  it('only the host can start, and only with at least 2 players', async () => {
    const rooms = await setup();
    const room = createTable(rooms);
    await room.sit('host', 'Host', 0, BUY_IN);
    expect(room.startGame('host').ok).toBe(false);

    await room.sit('u2', 'Guest', 1, BUY_IN);
    expect(room.startGame('u2')).toEqual({ ok: false, error: 'Only the host can start the game' });
    expect(room.isLobby()).toBe(true);

    expect(room.startGame('host').ok).toBe(true);
    expect(room.isLobby()).toBe(false);
    expect(room.startGame('host').ok).toBe(false);
  });

  it('deals the first hand without Ready; later hands use the Ready flow', async () => {
    const rooms = await setup();
    const room = createTable(rooms);
    await room.sit('host', 'Host', 0, BUY_IN);
    await room.sit('u2', 'Guest', 1, BUY_IN);

    expect(room.startGame('host').ok).toBe(true);
    expect(room.state.street).not.toBe('waiting');
    expect(room.state.street).not.toBe('payout');

    foldToPayout(room);
    const firstHand = room.state.handId;
    await vi.advanceTimersByTimeAsync(30_000);
    expect(room.state.handId).toBe(firstHand);

    expect(room.setReady('host', true).ok).toBe(true);
    expect(room.state.handId).toBe(firstHand);
    expect(room.setReady('u2', true).ok).toBe(true);
    expect(room.state.handId).not.toBe(firstHand);
  });

  it('grows a 2-seat challenge so bots can be added', async () => {
    const rooms = await setup();
    const room = createTable(rooms);
    await room.sit('host', 'Host', 0, BUY_IN);
    await room.sit('u2', 'Guest', 1, BUY_IN);
    expect(room.addBot('host').ok).toBe(false);

    expect(room.resizeSeats('u2', 4).ok).toBe(false);
    expect(room.resizeSeats('host', 4).ok).toBe(true);
    expect(room.config.maxSeats).toBe(4);
    expect(room.state.players).toHaveLength(4);
    expect(room.addBot('host', undefined, BUY_IN, 2).ok).toBe(true);
    expect(room.seatedCount()).toBe(4);
  });

  it('compacts seated players on shrink and rejects invalid sizes', async () => {
    const rooms = await setup();
    const room = createTable(rooms, { maxSeats: 6 });
    await room.sit('host', 'Host', 1, BUY_IN);
    await room.sit('u2', 'Guest', 4, BUY_IN);

    expect(room.resizeSeats('host', 1).ok).toBe(false);
    expect(room.resizeSeats('host', MAX_TABLE_SEATS + 1).ok).toBe(false);
    expect(room.resizeSeats('host', 2).ok).toBe(true);
    expect(room.state.players.map((p) => [p.seat, p.userId])).toEqual([
      [0, 'host'],
      [1, 'u2'],
    ]);

    expect(room.addBot('host').ok).toBe(false);
    expect(room.resizeSeats('host', 3).ok).toBe(true);
    expect(room.addBot('host').ok).toBe(true);
    expect(room.resizeSeats('host', 2)).toEqual({ ok: false, error: '3 players are seated' });

    expect(room.startGame('host').ok).toBe(true);
    expect(room.resizeSeats('host', 4).ok).toBe(false);
  });

  it('leaves non-lobby private tables on the Ready flow', async () => {
    const rooms = await setup();
    const room = createTable(rooms, { lobby: false });
    expect(room.isLobby()).toBe(false);
    await room.sit('host', 'Host', 0, BUY_IN);
    await room.sit('u2', 'Guest', 1, BUY_IN);
    expect(room.startGame('host').ok).toBe(false);
    expect(room.resizeSeats('host', 4).ok).toBe(false);
    expect(room.setReady('host', true).ok).toBe(true);
    expect(room.setReady('u2', true).ok).toBe(true);
    expect(room.state.street).not.toBe('waiting');
  });

  it('hands host to a joined human when the host leaves', async () => {
    const rooms = await setup();
    const room = createTable(rooms, { maxSeats: 4 });
    const attach = (userId: string) =>
      room.attach({ userId, name: userId, avatarId: 0, avatarUrl: null, send: () => {} });
    attach('host');
    attach('u2');
    attach('u3');
    await room.sit('host', 'Host', 0, BUY_IN);
    expect(room.addBot('host').ok).toBe(true);
    await room.sit('u2', 'Guest', 2, BUY_IN);
    await room.sit('u3', 'Other', 3, BUY_IN);
    room.detach('u2');

    room.leave('host');
    expect(room.meta.hostUserId).toBe('u3');
    expect(room.startGame('host').ok).toBe(false);
    expect(room.resizeSeats('u3', 3).ok).toBe(true);

    room.leave('u3');
    expect(room.meta.hostUserId).toBe('u2');
    room.leave('u2');
    expect(room.meta.hostUserId).toBe('u2');
  });

  it('ignores the lobby flag on public tables', async () => {
    const rooms = await setup();
    const meta = rooms.create({
      name: 'Public',
      hostUserId: 'host',
      isPrivate: false,
      lobby: true,
      config: { maxSeats: 6, smallBlind: 5, bigBlind: 10, buyIn: BUY_IN, turnTimeMs: 30_000 },
    });
    expect(rooms.get(meta.id)!.isLobby()).toBe(false);
  });
});

describe('Seat growth for invites', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('adds seats between hands, capped at 9', async () => {
    const rooms = await setup();
    const room = createTable(rooms, { lobby: false });
    await room.sit('host', 'Host', 0, BUY_IN);
    await room.sit('u2', 'Guest', 1, BUY_IN);

    expect(room.growSeatsForInvites(['f1'])).toEqual({ added: 1, deferred: false });
    expect(room.config.maxSeats).toBe(3);
    expect(room.state.players).toHaveLength(3);

    const many = Array.from({ length: 10 }, (_, i) => `g${i}`);
    expect(room.growSeatsForInvites(many).added).toBe(MAX_TABLE_SEATS - 3);
    expect(room.config.maxSeats).toBe(MAX_TABLE_SEATS);
    expect(room.growSeatsForInvites(['h1'])).toEqual({ added: 0, deferred: false });
  });

  it('does not add seats when empty seats already cover the invites', async () => {
    const rooms = await setup();
    const room = createTable(rooms, { maxSeats: 6, lobby: false });
    await room.sit('host', 'Host', 0, BUY_IN);
    expect(room.growSeatsForInvites(['f1', 'f2'])).toEqual({ added: 0, deferred: false });
    expect(room.config.maxSeats).toBe(6);
  });

  it('defers growth mid-hand and keeps existing seat numbers', async () => {
    const rooms = await setup();
    const room = createTable(rooms, { lobby: false });
    await room.sit('host', 'Host', 0, BUY_IN);
    await room.sit('u2', 'Guest', 1, BUY_IN);
    room.setReady('host', true);
    room.setReady('u2', true);
    expect(room.state.street).not.toBe('waiting');

    expect(room.growSeatsForInvites(['f1', 'f2'])).toEqual({ added: 2, deferred: true });
    expect(room.state.players).toHaveLength(2);
    expect(room.config.maxSeats).toBe(2);

    foldToPayout(room);
    expect(room.config.maxSeats).toBe(4);
    expect(room.state.players.map((p) => p.userId)).toEqual(['host', 'u2', null, null]);
    expect(room.state.players.map((p) => p.seat)).toEqual([0, 1, 2, 3]);
  });

  it('auto-seats an invited friend who is already watching', async () => {
    const rooms = await setup();
    const room = createTable(rooms, { lobby: false });
    await room.sit('host', 'Host', 0, BUY_IN);
    await room.sit('u2', 'Guest', 1, BUY_IN);
    room.attach({ userId: 'f1', name: 'Friend', avatarId: 0, avatarUrl: null, send: () => {} });
    expect(room.isSeated('f1')).toBe(false);

    room.growSeatsForInvites(['f1']);
    await vi.waitFor(() => expect(room.isSeated('f1')).toBe(true));
    expect(room.state.players[2]?.userId).toBe('f1');
  });
});

describe('TablesController invite-friends', () => {
  function controller(rooms: RoomManager) {
    const createFriendInvites = vi.fn(async (_hostId: string, ids: string[]) =>
      ids.map((id, i) => ({ id: `c${i}`, challengedId: id })),
    );
    const ctrl = new TablesController(
      roomsService(rooms),
      { createFriendInvites } as unknown as FriendsService,
      {} as HistoryService,
      {} as SiteConfigService,
    );
    return { ctrl, createFriendInvites };
  }
  const host = { id: 'host' } as User;

  it('caps invites at the open slots and adds seats for them', async () => {
    const rooms = await setup();
    const room = createTable(rooms, { lobby: false });
    await room.sit('host', 'Host', 0, BUY_IN);
    await room.sit('u2', 'Guest', 1, BUY_IN);
    const { ctrl, createFriendInvites } = controller(rooms);

    const ids = ['u2', ...Array.from({ length: 7 }, (_, i) => `f${i}`)];
    const res = await ctrl.inviteFriends(host, room.meta.id, { friendUserIds: ids });
    expect(createFriendInvites.mock.calls[0]![1]).toEqual(ids.slice(1));
    expect(res.inviteCount).toBe(7);
    expect(res.seatsAdded).toBe(7);
    expect(room.config.maxSeats).toBe(MAX_TABLE_SEATS);
  });

  it('rejects when 9 players are seated, or when not the host', async () => {
    const rooms = await setup();
    const room = createTable(rooms, { maxSeats: MAX_TABLE_SEATS, lobby: false });
    await room.sit('host', 'Host', 0, BUY_IN);
    const { ctrl } = controller(rooms);

    await expect(
      ctrl.inviteFriends({ id: 'u2' } as User, room.meta.id, { friendUserIds: ['f1'] }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(room.addBot('host', undefined, BUY_IN, MAX_TABLE_SEATS - 1).ok).toBe(true);
    expect(room.seatedCount()).toBe(MAX_TABLE_SEATS);
    await expect(
      ctrl.inviteFriends(host, room.meta.id, { friendUserIds: ['f1'] }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('FriendsController challenge lobby flag', () => {
  async function challenge(body: Record<string, unknown>) {
    const rooms = await setup();
    const users: Record<string, { id: string; name: string }> = {
      host: { id: 'host', name: 'Host' },
      f1: { id: 'f1', name: 'Friend' },
    };
    const ctrl = new FriendsController(
      { createChallenge: async () => ({ id: 'ch1' }) } as unknown as FriendsService,
      { getUser: (id: string) => users[id] ?? null } as unknown as AuthService,
      roomsService(rooms),
    );
    const res = await ctrl.challenge({ id: 'host' } as User, { friendUserId: 'f1', ...body });
    return rooms.get(res.tableId)!;
  }

  it('creates a lobby table when lobby is true', async () => {
    const room = await challenge({ lobby: true });
    expect(room.isLobby()).toBe(true);
    expect(room.config.maxSeats).toBe(2);
  });

  it('keeps the old behaviour without the flag', async () => {
    const room = await challenge({});
    expect(room.isLobby()).toBe(false);
  });
});
