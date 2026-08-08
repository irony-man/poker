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
    room.attach({ userId: 'u1', name: 'A', avatarId: 0, send: noop });
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
    room.attach({ userId: 'u1', name: 'A', avatarId: 0, send: noop });
    expect((await room.sit('u1', 'A', 0, 1000)).ok).toBe(true);

    room.detach('u1');
    room.scheduleDisconnect('u1');
    room.attach({ userId: 'u1', name: 'A', avatarId: 0, send: noop });

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
    room.attach({ userId: 'u1', name: 'A', avatarId: 0, send: oldSend });
    room.attach({ userId: 'u1', name: 'A', avatarId: 0, send: newSend });

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
});
