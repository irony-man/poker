import { describe, expect, it, vi } from 'vitest';
import { AuthStore } from '../src/auth.js';
import { MemoryKv } from '../src/kv.js';
import { FileHistoryStore } from '../src/history.js';
import { RoomManager } from '../src/room.js';
import path from 'node:path';
import os from 'node:os';

describe('AuthStore', () => {
  it('issues and consumes tickets', () => {
    const auth = new AuthStore();
    const user = auth.register('Alice');
    const ticket = auth.issueTicket(user.id);
    expect(auth.consumeTicket(ticket)?.name).toBe('Alice');
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
      config: {
        maxSeats: 6,
        smallBlind: 5,
        bigBlind: 10,
        minBuyIn: 200,
        maxBuyIn: 1000,
        turnTimeMs: 30_000,
      },
    });
    const room = rooms.get(meta.id)!;
    expect(room.sit('u1', 'A', 0, 500).ok).toBe(true);
    expect(room.sit('u1', 'A', 1, 500).ok).toBe(false); // already seated
    expect(room.sit('u2', 'B', 1, 500).ok).toBe(true);

    const started = room.startHand('u1');
    expect(started.ok).toBe(true);

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

  it('keeps seat during disconnect grace and vacates after timeout', () => {
    vi.useFakeTimers();
    const kv = new MemoryKv();
    const history = new FileHistoryStore(path.join(os.tmpdir(), `poker-test-${Date.now()}`));
    const rooms = new RoomManager(kv, history);
    const meta = rooms.create({
      name: 'Grace',
      hostUserId: 'host1',
      isPrivate: true,
      config: {
        maxSeats: 6,
        smallBlind: 5,
        bigBlind: 10,
        minBuyIn: 200,
        maxBuyIn: 1000,
        turnTimeMs: 30_000,
      },
    });
    const room = rooms.get(meta.id)!;
    const noop = () => {};
    room.attach({ userId: 'u1', name: 'A', avatarId: 0, send: noop });
    expect(room.sit('u1', 'A', 0, 500).ok).toBe(true);

    room.detach('u1');
    room.scheduleDisconnect('u1');
    expect(room.state.players[0]?.userId).toBe('u1');

    vi.advanceTimersByTime(120_000);
    expect(room.state.players[0]?.status).toBe('empty');

    vi.useRealTimers();
  });

  it('cancels disconnect grace when player reconnects', () => {
    vi.useFakeTimers();
    const kv = new MemoryKv();
    const history = new FileHistoryStore(path.join(os.tmpdir(), `poker-test-${Date.now()}`));
    const rooms = new RoomManager(kv, history);
    const meta = rooms.create({
      name: 'Reconnect',
      hostUserId: 'host1',
      isPrivate: true,
      config: {
        maxSeats: 6,
        smallBlind: 5,
        bigBlind: 10,
        minBuyIn: 200,
        maxBuyIn: 1000,
        turnTimeMs: 30_000,
      },
    });
    const room = rooms.get(meta.id)!;
    const noop = () => {};
    room.attach({ userId: 'u1', name: 'A', avatarId: 0, send: noop });
    expect(room.sit('u1', 'A', 0, 500).ok).toBe(true);

    room.detach('u1');
    room.scheduleDisconnect('u1');
    room.attach({ userId: 'u1', name: 'A', avatarId: 0, send: noop });

    vi.advanceTimersByTime(120_000);
    expect(room.state.players[0]?.userId).toBe('u1');

    vi.useRealTimers();
  });
});
