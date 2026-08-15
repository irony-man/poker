import { describe, expect, it, vi } from 'vitest';
import { AuthStore } from './auth/auth.store.js';
import { MemoryKv } from './kv/kv.store.js';
import { FileHistoryStore } from './history/history.store.js';
import { RoomManager } from './rooms/room.js';
import { MemoryTableChipStore } from './table-chips/table-chips.store.js';
import path from 'node:path';
import os from 'node:os';

function cashConfig() {
  return {
    maxSeats: 6,
    smallBlind: 5,
    bigBlind: 10,
    buyIn: 1000,
    turnTimeMs: 30_000,
  } as const;
}

describe('AuthStore', () => {
  it('issues and consumes tickets after signup', async () => {
    const dir = path.join(os.tmpdir(), `poker-auth-${Date.now()}`);
    const auth = new AuthStore(dir);
    await auth.init();
    const session = await auth.signup('Alice', 'password1');
    expect(auth.consumeTicket(session.ticket)?.name).toBe('Alice');
    expect(auth.consumeTicket('bad')).toBeNull();
  });
});

describe('RoomManager', () => {
  it('creates table and enforces seat binding on actions', async () => {
    const kv = new MemoryKv();
    const history = new FileHistoryStore(path.join(os.tmpdir(), `poker-test-${Date.now()}`));
    const rooms = new RoomManager(kv, history);
    const meta = rooms.create({
      name: 'Test',
      hostUserId: 'host1',
      isPrivate: true,
      config: { ...cashConfig() },
    });
    const room = rooms.get(meta.id)!;
    expect((await room.sit('u1', 'A', 0, 1000)).ok).toBe(true);
    expect((await room.sit('u1', 'A', 1, 1000)).ok).toBe(false); // already seated
    expect((await room.sit('u2', 'B', 1, 1000)).ok).toBe(true);

    // Cash: both humans must ready before deal
    expect(room.setReady('u1', true).ok).toBe(true);
    expect(room.state.street).toBe('waiting');
    expect(room.setReady('u2', true).ok).toBe(true);
    expect(room.state.street).not.toBe('waiting');
    expect(room.state.street).not.toBe('payout');

    const toActBefore = room.state.toAct;
    const seq = room.state.actionSeq;
    const handId = room.state.handId;
    const wrongSeatAction = room.action(
      toActBefore === 0 ? 'u2' : 'u1',
      handId,
      seq,
      'fold',
    );
    expect(wrongSeatAction.ok).toBe(false);

    // Spectator-style: action from non-seated user fails
    expect(room.action('spectator', handId, room.state.actionSeq, 'fold').ok).toBe(false);
  });

  it('keeps seat during disconnect grace and vacates after timeout', async () => {
    vi.useFakeTimers();
    const kv = new MemoryKv();
    const history = new FileHistoryStore(path.join(os.tmpdir(), `poker-test-${Date.now()}`));
    const rooms = new RoomManager(kv, history);
    const meta = rooms.create({
      name: 'Grace',
      hostUserId: 'host1',
      isPrivate: true,
      config: { ...cashConfig() },
    });
    const room = rooms.get(meta.id)!;
    const noop = () => {};
    room.attach({ userId: 'u1', name: 'A', avatarId: 0, avatarUrl: null, send: noop });
    expect((await room.sit('u1', 'A', 0, 1000)).ok).toBe(true);

    room.detach('u1');
    room.scheduleDisconnect('u1');
    expect(room.state.players[0]?.userId).toBe('u1');

    vi.advanceTimersByTime(120_000);
    expect(room.state.players[0]?.status).toBe('empty');

    vi.useRealTimers();
  });

  it('cancels disconnect grace when player reconnects', async () => {
    vi.useFakeTimers();
    const kv = new MemoryKv();
    const history = new FileHistoryStore(path.join(os.tmpdir(), `poker-test-${Date.now()}`));
    const rooms = new RoomManager(kv, history);
    const meta = rooms.create({
      name: 'Reconnect',
      hostUserId: 'host1',
      isPrivate: true,
      config: { ...cashConfig() },
    });
    const room = rooms.get(meta.id)!;
    const noop = () => {};
    room.attach({ userId: 'u1', name: 'A', avatarId: 0, avatarUrl: null, send: noop });
    expect((await room.sit('u1', 'A', 0, 1000)).ok).toBe(true);

    room.detach('u1');
    room.scheduleDisconnect('u1');
    room.attach({ userId: 'u1', name: 'A', avatarId: 0, avatarUrl: null, send: noop });

    vi.advanceTimersByTime(120_000);
    expect(room.state.players[0]?.userId).toBe('u1');

    vi.useRealTimers();
  });

  it('deals only when every human is ready (bots always ready)', async () => {
    const kv = new MemoryKv();
    const history = new FileHistoryStore(path.join(os.tmpdir(), `poker-ready-${Date.now()}`));
    const rooms = new RoomManager(kv, history);
    const meta = rooms.create({
      name: 'Ready',
      hostUserId: 'u1',
      isPrivate: true,
      config: { ...cashConfig() },
    });
    const room = rooms.get(meta.id)!;
    expect((await room.sit('u1', 'Host', 0, 1000)).ok).toBe(true);
    expect(room.addBot('u1').ok).toBe(true);

    expect(room.setReady('u1', true).ok).toBe(true);
    // Human + bot: hand should start
    expect(room.state.street).not.toBe('waiting');
  });

  it('auto-readies bots between hands with staggered state updates', async () => {
    vi.useFakeTimers();
    const kv = new MemoryKv();
    const history = new FileHistoryStore(path.join(os.tmpdir(), `poker-bot-ready-${Date.now()}`));
    const rooms = new RoomManager(kv, history);
    const meta = rooms.create({
      name: 'BotReady',
      hostUserId: 'u1',
      isPrivate: true,
      config: { ...cashConfig() },
    });
    const room = rooms.get(meta.id)!;
    expect((await room.sit('u1', 'Host', 0, 1000)).ok).toBe(true);
    expect(room.addBot('u1').ok).toBe(true);

    let lastTable: { players: { userId?: string | null; ready?: boolean }[] } | null = null;
    room.attach({
      userId: 'u1',
      name: 'Host',
      avatarId: 0,
      avatarUrl: null,
      send: (msg) => {
        const m = msg as { type?: string; table?: typeof lastTable };
        if (m.type === 'state_sync' && m.table) lastTable = m.table;
      },
    });

    const botUserId = room.state.players.find((p) => p.userId?.startsWith('bot:'))?.userId;
    expect(botUserId).toBeTruthy();

    expect(lastTable?.players.find((p) => p.userId === botUserId)?.ready).toBe(false);

    vi.advanceTimersByTime(2000);
    expect(lastTable?.players.find((p) => p.userId === botUserId)?.ready).toBe(true);

    // Deal still waits for the human even though the bot is ready in UI.
    expect(room.state.street).toBe('waiting');
    expect(room.setReady('u1', true).ok).toBe(true);
    expect(room.state.street).not.toBe('waiting');

    vi.useRealTimers();
  });

  it('does not deal until all humans ready; sit-out clears ready', async () => {
    const kv = new MemoryKv();
    const history = new FileHistoryStore(path.join(os.tmpdir(), `poker-ready2-${Date.now()}`));
    const rooms = new RoomManager(kv, history);
    const meta = rooms.create({
      name: 'Ready2',
      hostUserId: 'u1',
      isPrivate: true,
      config: { ...cashConfig() },
    });
    const room = rooms.get(meta.id)!;
    await room.sit('u1', 'A', 0, 1000);
    await room.sit('u2', 'B', 1, 1000);
    await room.sit('u3', 'C', 2, 1000);

    expect(room.setReady('u1', true).ok).toBe(true);
    expect(room.setReady('u2', true).ok).toBe(true);
    expect(room.state.street).toBe('waiting');

    expect(room.doSitOut('u2', 1).ok).toBe(true);
    // Now only u1 + u3 eligible humans — u1 ready, u3 not until...
    expect(room.setReady('u3', true).ok).toBe(true);
    expect(room.state.street).not.toBe('waiting');
  });

  it('sit-in auto-readies for the next hand and can deal', async () => {
    const kv = new MemoryKv();
    const history = new FileHistoryStore(path.join(os.tmpdir(), `poker-sitin-ready-${Date.now()}`));
    const rooms = new RoomManager(kv, history);
    const meta = rooms.create({
      name: 'SitInReady',
      hostUserId: 'u1',
      isPrivate: true,
      config: { ...cashConfig() },
    });
    const room = rooms.get(meta.id)!;
    await room.sit('u1', 'A', 0, 1000);
    await room.sit('u2', 'B', 1, 1000);

    expect(room.setReady('u1', true).ok).toBe(true);
    expect(room.doSitOut('u2', 1).ok).toBe(true);
    expect(room.state.players[1]!.status).toBe('sittingOut');
    expect(room.state.street).toBe('waiting');

    // Only u1 ready + one sitting out — no deal. Sit in auto-readies u2 → deal.
    expect(room.doSitIn('u2', 1).ok).toBe(true);
    expect(room.state.players[1]!.status).not.toBe('sittingOut');
    expect(room.state.street).not.toBe('waiting');
  });

  it('queues sit-out mid-hand and applies between hands; sit-in returns for next hand', async () => {
    const kv = new MemoryKv();
    const history = new FileHistoryStore(path.join(os.tmpdir(), `poker-sitout-next-${Date.now()}`));
    const rooms = new RoomManager(kv, history);
    const meta = rooms.create({
      name: 'SitOutNext',
      hostUserId: 'u1',
      isPrivate: true,
      config: { ...cashConfig() },
    });
    const room = rooms.get(meta.id)!;
    await room.sit('u1', 'A', 0, 1000);
    await room.sit('u2', 'B', 1, 1000);
    expect(room.setReady('u1', true).ok).toBe(true);
    expect(room.setReady('u2', true).ok).toBe(true);
    expect(room.state.street).not.toBe('waiting');

    // Mid-hand: request sit-out after this hand (keep playing now).
    room.state.players[1]!.status = 'active';
    expect(room.doSitOut('u2', 1).ok).toBe(true);
    expect(room.state.players[1]!.status).toBe('active');

    // Hand ends → any afterStateChange while payout/waiting flushes the queue.
    room.state.street = 'payout';
    room.state.players[0]!.status = 'seated';
    room.state.players[1]!.status = 'seated';
    // addBot forces returnToWaiting on payout and broadcasts.
    expect(room.addBot('u1', undefined, 1000, 1).ok).toBe(true);
    expect(room.state.players[1]!.status).toBe('sittingOut');

    // Sit in for the next deal (does not need between-hands street only).
    expect(room.doSitIn('u2', 1).ok).toBe(true);
    expect(room.state.players[1]!.status).toBe('seated');
  });

  it('kick is host-only and vacates seat between hands', async () => {
    const kv = new MemoryKv();
    const history = new FileHistoryStore(path.join(os.tmpdir(), `poker-kick-${Date.now()}`));
    const rooms = new RoomManager(kv, history);
    const meta = rooms.create({
      name: 'Kick',
      hostUserId: 'host1',
      isPrivate: true,
      config: { ...cashConfig() },
    });
    const room = rooms.get(meta.id)!;
    await room.sit('host1', 'Host', 0, 1000);
    await room.sit('u2', 'Guest', 1, 1000);

    expect((await room.kickPlayer('u2', 0)).ok).toBe(false);
    expect((await room.kickPlayer('host1', 1)).ok).toBe(true);
    expect(room.state.players[1]?.status).toBe('empty');
    expect(room.state.players[1]?.userId).toBeNull();
  });

  it('late close of an old socket does not detach a newer reconnect', () => {
    const kv = new MemoryKv();
    const history = new FileHistoryStore(path.join(os.tmpdir(), `poker-reconn-${Date.now()}`));
    const rooms = new RoomManager(kv, history);
    const meta = rooms.create({
      name: 'Reconn',
      hostUserId: 'host1',
      isPrivate: true,
      config: { ...cashConfig() },
    });
    const room = rooms.get(meta.id)!;
    const oldSend = () => {};
    const newSend = () => {};
    room.attach({ userId: 'u1', name: 'A', avatarId: 0, avatarUrl: null, send: oldSend });
    room.attach({ userId: 'u1', name: 'A', avatarId: 0, avatarUrl: null, send: newSend });

    expect(room.detachIfActive('u1', oldSend)).toBe(false);
    expect(room.isActiveConnection('u1', newSend)).toBe(true);
    expect(room.detachIfActive('u1', newSend)).toBe(true);
  });

  it('reseat after kick restores reserved chip stack, not table buy-in', async () => {
    const kv = new MemoryKv();
    const history = new FileHistoryStore(path.join(os.tmpdir(), `poker-kick-stack-${Date.now()}`));
    const chips = new MemoryTableChipStore();
    const rooms = new RoomManager(kv, history, chips);
    const meta = rooms.create({
      name: 'KickStack',
      hostUserId: 'host1',
      isPrivate: true,
      config: { ...cashConfig() },
    });
    const room = rooms.get(meta.id)!;
    await room.sit('host1', 'Host', 0, 1000);
    await room.sit('u2', 'Guest', 1, 1000);
    room.state.players[1]!.stack = 420;

    expect((await room.kickPlayer('host1', 1)).ok).toBe(true);
    expect(room.state.players[1]?.status).toBe('empty');

    // Client always sends table buy-in; server should use reserved 420 instead.
    expect((await room.sit('u2', 'Guest', 1, 1000)).ok).toBe(true);
    expect(room.state.players[1]?.userId).toBe('u2');
    expect(room.state.players[1]?.stack).toBe(420);

    // Reserved stack is single-use.
    await room.stand('u2', 1);
    expect((await room.sit('u2', 'Guest', 1, 1000)).ok).toBe(true);
    expect(room.state.players[1]?.stack).toBe(1000);
  });

  it('reseat after kick with zero stack does a fresh buy-in, not stack 0', async () => {
    const kv = new MemoryKv();
    const history = new FileHistoryStore(path.join(os.tmpdir(), `poker-kick-zero-${Date.now()}`));
    const chips = new MemoryTableChipStore();
    const rooms = new RoomManager(kv, history, chips);
    const meta = rooms.create({
      name: 'KickZero',
      hostUserId: 'host1',
      isPrivate: true,
      config: { ...cashConfig() },
    });
    const room = rooms.get(meta.id)!;
    await room.sit('host1', 'Host', 0, 1000);
    await room.sit('u2', 'Guest', 1, 1000);
    room.state.players[1]!.stack = 0;

    expect((await room.kickPlayer('host1', 1)).ok).toBe(true);
    // Legacy / bad data: empty hold would previously re-seat with stack 0.
    await chips.reserve(meta.id, 'u2', 0);
    expect((await room.sit('u2', 'Guest', 1, 1000)).ok).toBe(true);
    expect(room.state.players[1]?.stack).toBe(1000);
  });

  it('non-finite reserved stack falls back to table buy-in', async () => {
    const kv = new MemoryKv();
    const history = new FileHistoryStore(path.join(os.tmpdir(), `poker-kick-nan-${Date.now()}`));
    const chips = new MemoryTableChipStore();
    const rooms = new RoomManager(kv, history, chips);
    const meta = rooms.create({
      name: 'KickNan',
      hostUserId: 'host1',
      isPrivate: true,
      config: { ...cashConfig() },
    });
    const room = rooms.get(meta.id)!;
    await room.sit('host1', 'Host', 0, 1000);
    // Simulate corrupt hold (NaN bypasses `reserved <= 0`).
    await chips.reserve(meta.id, 'u2', Number.NaN);
    expect((await room.sit('u2', 'Guest', 1, 1000)).ok).toBe(true);
    expect(room.state.players[1]?.stack).toBe(1000);
  });

  it('duplicate sit after autoSit is idempotent (no Seat taken)', async () => {
    const kv = new MemoryKv();
    const history = new FileHistoryStore(path.join(os.tmpdir(), `poker-dup-sit-${Date.now()}`));
    const rooms = new RoomManager(kv, history);
    const meta = rooms.create({
      name: 'DupSit',
      hostUserId: 'host1',
      isPrivate: true,
      config: { ...cashConfig() },
    });
    const room = rooms.get(meta.id)!;
    expect((await room.autoSit('host1', 'Host')).ok).toBe(true);
    expect(room.state.players[0]?.stack).toBe(1000);
    expect((await room.sit('host1', 'Host', 0, 1000)).ok).toBe(true);
    expect(room.state.players[0]?.stack).toBe(1000);
  });

  it('concurrent autoSit and sit resolve without Seat taken', async () => {
    const kv = new MemoryKv();
    const history = new FileHistoryStore(path.join(os.tmpdir(), `poker-race-sit-${Date.now()}`));
    const rooms = new RoomManager(kv, history);
    const meta = rooms.create({
      name: 'RaceSit',
      hostUserId: 'host1',
      isPrivate: true,
      config: { ...cashConfig() },
    });
    const room = rooms.get(meta.id)!;
    const [a, b] = await Promise.all([
      room.autoSit('host1', 'Host'),
      room.sit('host1', 'Host', 0, 1000),
    ]);
    expect(a.ok).toBe(true);
    expect(b.ok).toBe(true);
    expect(b.error).toBeUndefined();
    expect(room.state.players[0]?.userId).toBe('host1');
    expect(room.state.players[0]?.stack).toBe(1000);
  });

  it('start_hand toggles ready on cash tables', async () => {
    const kv = new MemoryKv();
    const history = new FileHistoryStore(path.join(os.tmpdir(), `poker-toggle-${Date.now()}`));
    const rooms = new RoomManager(kv, history);
    const meta = rooms.create({
      name: 'Toggle',
      hostUserId: 'u1',
      isPrivate: true,
      config: { ...cashConfig() },
    });
    const room = rooms.get(meta.id)!;
    await room.sit('u1', 'A', 0, 1000);
    await room.sit('u2', 'B', 1, 1000);

    expect(room.startHand('u1').ok).toBe(true);
    expect(room.state.street).toBe('waiting');
    expect(room.startHand('u1').ok).toBe(true); // unready
    expect(room.startHand('u1').ok).toBe(true); // ready again
    expect(room.startHand('u2').ok).toBe(true); // both ready → deal
    expect(room.state.street).not.toBe('waiting');
  });

  it('start_hand toggles ready on contest tables (no auto-deal)', async () => {
    const kv = new MemoryKv();
    const history = new FileHistoryStore(path.join(os.tmpdir(), `poker-contest-ready-${Date.now()}`));
    const rooms = new RoomManager(kv, history);
    const meta = rooms.create({
      name: 'ContestReady',
      hostUserId: 'u1',
      isPrivate: true,
      config: { ...cashConfig() },
      tournament: { contestId: 'c-ready', mode: 'chips', allowTopUp: false },
    });
    const room = rooms.get(meta.id)!;
    room.forceSeat('u1', 'A', 0, 1000);
    room.forceSeat('u2', 'B', 1, 1000);

    room.scheduleTournamentAutoStart(0);
    expect(room.state.street).toBe('waiting');

    expect(room.setReady('u1', true).ok).toBe(true);
    expect(room.state.street).toBe('waiting');
    expect(room.startHand('u1').ok).toBe(true); // unready
    expect(room.state.street).toBe('waiting');
    expect(room.setReady('u1', true).ok).toBe(true);
    expect(room.setReady('u2', true).ok).toBe(true);
    expect(room.state.street).not.toBe('waiting');
  });

  it('rejects ready when contest match is frozen', async () => {
    const kv = new MemoryKv();
    const history = new FileHistoryStore(path.join(os.tmpdir(), `poker-frozen-ready-${Date.now()}`));
    const rooms = new RoomManager(kv, history);
    const meta = rooms.create({
      name: 'Frozen',
      hostUserId: 'u1',
      isPrivate: true,
      config: { ...cashConfig() },
      tournament: { contestId: 'c-frozen', mode: 'chips', allowTopUp: false, frozen: true },
    });
    const room = rooms.get(meta.id)!;
    room.forceSeat('u1', 'A', 0, 1000);
    room.forceSeat('u2', 'B', 1, 1000);
    expect(room.setReady('u1', true).ok).toBe(false);
    expect(room.setReady('u1', true).error).toMatch(/over/i);
  });

  it('terminates rooms after 15 minutes without humans', async () => {
    const { ROOM_INACTIVITY_MS } = await import('./rooms/room.js');
    const kv = new MemoryKv();
    const history = new FileHistoryStore(path.join(os.tmpdir(), `poker-idle-${Date.now()}`));
    const rooms = new RoomManager(kv, history);
    const meta = rooms.create({
      name: 'Idle',
      hostUserId: 'host1',
      isPrivate: true,
      config: { ...cashConfig() },
    });
    const room = rooms.get(meta.id)!;
    const msgs: unknown[] = [];
    room.attach({
      userId: 'u1',
      name: 'A',
      avatarId: 0,
      avatarUrl: null,
      send: (m) => {
        msgs.push(m);
      },
    });
    expect((await room.sit('u1', 'A', 0, 1000)).ok).toBe(true);
    expect(room.isIdle()).toBe(false);

    // Still connected — even long after create time, not idle.
    const farFuture = meta.createdAt + ROOM_INACTIVITY_MS + 60_000;
    expect(rooms.terminateIdleRooms(farFuture)).toEqual([]);
    expect(rooms.get(meta.id)).toBeDefined();

    room.leave('u1');
    expect(room.hasHumanPresence()).toBe(false);
    expect(room.isIdle(ROOM_INACTIVITY_MS, Date.now())).toBe(false);

    const justIdle = Date.now() + ROOM_INACTIVITY_MS;
    expect(rooms.terminateIdleRooms(justIdle)).toEqual([meta.id]);
    expect(rooms.get(meta.id)).toBeUndefined();
    expect(rooms.getByInvite(meta.inviteCode)).toBeUndefined();
  });

  it('does not idle-terminate tournament rooms', async () => {
    const { ROOM_INACTIVITY_MS } = await import('./rooms/room.js');
    const kv = new MemoryKv();
    const history = new FileHistoryStore(path.join(os.tmpdir(), `poker-tour-idle-${Date.now()}`));
    const rooms = new RoomManager(kv, history);
    const meta = rooms.create({
      name: 'Tourny',
      hostUserId: 'host1',
      isPrivate: true,
      config: { ...cashConfig() },
      tournament: { contestId: 'c1', mode: 'chips' },
    });
    const later = meta.createdAt + ROOM_INACTIVITY_MS + 1;
    expect(rooms.terminateIdleRooms(later)).toEqual([]);
    expect(rooms.get(meta.id)).toBeDefined();
  });
});
