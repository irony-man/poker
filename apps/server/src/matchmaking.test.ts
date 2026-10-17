import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { isBotUserId } from './bot.js';
import { createHistoryStore } from './history/history.store.js';
import { MemoryKv } from './kv/kv.store.js';
import { Matchmaker } from './matchmaking/matchmaker.js';
import { Room, RoomManager, tableTimingsKey } from './rooms/room.js';
import {
  DEFAULT_PUBLIC_TABLE_TIMINGS_MS,
  type PublicTableTimingsMs,
} from './site-config/site-config.types.js';

type Sent = { userId: string; msg: { type: string; [key: string]: unknown } };

async function setup(timings: PublicTableTimingsMs = DEFAULT_PUBLIC_TABLE_TIMINGS_MS) {
  const kv = new MemoryKv();
  const rooms = new RoomManager(kv, await createHistoryStore());
  const sent: Sent[] = [];
  let current = { ...timings };
  const mm = new Matchmaker({
    rooms,
    timings: () => current,
    botSeating: () => ({ names: [], defaultPersonality: null, namePersonalities: {} }),
    sendToUser: (userId, msg) => sent.push({ userId, msg: msg as Sent['msg'] }),
  });
  const found = (userId: string) =>
    sent.filter((s) => s.userId === userId && s.msg.type === 'matchmaking_found').at(-1)?.msg;
  const setTimings = (next: Partial<PublicTableTimingsMs>) => {
    current = { ...current, ...next };
  };
  return { kv, rooms, mm, sent, found, setTimings };
}

function botCount(room: Room): number {
  return room.state.players.filter((p) => p.status !== 'empty' && isBotUserId(p.userId)).length;
}

describe('Matchmaker', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('groups queued players and fills with bots after the bot-fill wait', async () => {
    const { rooms, mm, sent, found } = await setup();
    mm.join('u1', 'Alice');
    await vi.advanceTimersByTimeAsync(5_000);
    mm.join('u2', 'Bob');

    const status = sent.filter((s) => s.userId === 'u2' && s.msg.type === 'matchmaking_status');
    expect(status.at(-1)?.msg.humansWaiting).toBe(2);
    expect(found('u1')).toBeUndefined();

    await vi.advanceTimersByTimeAsync(10_000);
    const f1 = found('u1');
    const f2 = found('u2');
    expect(f1?.tableId).toBeDefined();
    expect(f2?.tableId).toBe(f1?.tableId);

    const room = rooms.get(String(f1!.tableId))!;
    expect(room.meta.matchmade).toBe(true);
    expect(room.meta.isPrivate).toBe(false);
    expect(room.meta.stakeId).toBe('low');
    expect(room.config.buyIn).toBe(1000);
    expect(botCount(room)).toBe(4);
    expect(room.emptySeatCount()).toBe(2);
    expect(mm.queueSize()).toBe(0);
  });

  it('keeps a separate queue and table per stake, using the preset config', async () => {
    const { rooms, mm, sent, found } = await setup();
    mm.join('u1', 'Alice', 'mid');
    mm.join('u2', 'Bob', 'high');
    mm.join('u3', 'Cara', 'mid');
    const status = sent.filter((s) => s.userId === 'u3' && s.msg.type === 'matchmaking_status');
    expect(status.at(-1)?.msg).toMatchObject({ stakeId: 'mid', humansWaiting: 2 });
    expect(mm.queueSize('mid')).toBe(2);
    expect(mm.queueSize('high')).toBe(1);

    await vi.advanceTimersByTimeAsync(15_000);
    const mid = rooms.get(String(found('u1')!.tableId))!;
    const high = rooms.get(String(found('u2')!.tableId))!;
    expect(found('u3')?.tableId).toBe(mid.meta.id);
    expect(high.meta.id).not.toBe(mid.meta.id);
    expect(mid.meta.stakeId).toBe('mid');
    expect(mid.config).toMatchObject({ smallBlind: 10, bigBlind: 25, buyIn: 2500 });
    expect(high.config).toMatchObject({ smallBlind: 25, bigBlind: 50, buyIn: 5000 });
  });

  it('only backfills into live tables of the same stake', async () => {
    const { rooms, mm, found } = await setup();
    mm.join('u1', 'Alice', 'micro');
    mm.join('u2', 'Bob', 'micro');
    await vi.advanceTimersByTimeAsync(15_000);
    const micro = rooms.get(String(found('u1')!.tableId))!;
    expect((await micro.autoSit('u1', 'Alice')).ok).toBe(true);
    // u2 never arrives; their held seat frees up once the reservation lapses.
    await vi.advanceTimersByTimeAsync(30_000);
    expect(micro.emptySeatCount()).toBe(1);

    mm.join('u3', 'Cara', 'high');
    expect(found('u3')).toBeUndefined();
    expect(mm.queueSize('high')).toBe(1);

    mm.join('u4', 'Dan', 'micro');
    expect(found('u4')?.tableId).toBe(micro.meta.id);
  });

  it('moves a player to the new queue when they switch stakes', async () => {
    const { mm } = await setup();
    mm.join('u1', 'Alice', 'low');
    mm.join('u1', 'Alice', 'high');
    expect(mm.queueSize('low')).toBe(0);
    expect(mm.queueSize('high')).toBe(1);
    expect(mm.isQueued('u1')).toBe(true);
    mm.join('u2', 'Bob', 'nope');
    expect(mm.queueSize('low')).toBe(1);
  });

  it('forms a full human table immediately with no bots', async () => {
    const { rooms, mm, found } = await setup();
    for (let i = 1; i <= 6; i++) mm.join(`u${i}`, `P${i}`);
    const f = found('u1');
    expect(f).toBeDefined();
    for (let i = 2; i <= 6; i++) expect(found(`u${i}`)?.tableId).toBe(f!.tableId);
    expect(botCount(rooms.get(String(f!.tableId))!)).toBe(0);
  });

  it('cancel removes the player from the queue', async () => {
    const { rooms, mm, sent, found } = await setup();
    mm.join('u1', 'Alice');
    expect(mm.cancel('u1')).toBe(true);
    expect(sent.at(-1)?.msg.type).toBe('matchmaking_cancelled');
    expect(mm.cancel('u1')).toBe(false);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(found('u1')).toBeUndefined();
    expect(rooms.listMatchmade()).toHaveLength(0);
  });

  it('fills every seat a matched player is not taking with bots', async () => {
    const { rooms, mm, found } = await setup();
    mm.join('u1', 'Alice');
    await vi.advanceTimersByTimeAsync(15_000);
    const room = rooms.get(String(found('u1')!.tableId))!;
    expect(botCount(room)).toBe(5);
    expect((await room.autoSit('u1', 'Alice')).ok).toBe(true);
    expect(room.emptySeatCount()).toBe(0);

    // Full table: the next player gets queued rather than backfilled.
    mm.join('u2', 'Bob');
    expect(found('u2')).toBeUndefined();
    expect(mm.isQueued('u2')).toBe(true);
  });

  it('backfills a freed seat, respecting seats held for arriving players', async () => {
    const { rooms, mm, found } = await setup();
    mm.join('u1', 'Alice');
    mm.join('u2', 'Bob');
    await vi.advanceTimersByTimeAsync(15_000);
    const tableId = String(found('u1')!.tableId);
    const room = rooms.get(tableId)!;
    expect((await room.autoSit('u1', 'Alice')).ok).toBe(true);
    expect(room.emptySeatCount()).toBe(1);

    // The one open seat is still held for u2.
    mm.join('u3', 'Cara');
    expect(found('u3')).toBeUndefined();
    expect(mm.cancel('u3')).toBe(true);

    await vi.advanceTimersByTimeAsync(30_000);
    mm.join('u4', 'Dan');
    expect(found('u4')?.tableId).toBe(tableId);
    // Now held for u4.
    mm.join('u5', 'Eve');
    expect(found('u5')).toBeUndefined();
  });

  it('snapshots timings per table; admin changes only affect new tables', async () => {
    const { kv, rooms, mm, found, setTimings } = await setup();
    mm.join('u1', 'Alice');
    await vi.advanceTimersByTimeAsync(15_000);
    const first = rooms.get(String(found('u1')!.tableId))!;
    expect(JSON.parse((await kv.get(tableTimingsKey(first.meta.id)))!)).toEqual(
      DEFAULT_PUBLIC_TABLE_TIMINGS_MS,
    );

    setTimings({ nextHandMs: 3_000, botFillMs: 5_000, turnMs: 9_000 });
    mm.join('u2', 'Bob');
    // Backfill skips `first` (no human present yet), so u2 waits the new 5s fill.
    await vi.advanceTimersByTimeAsync(5_000);
    const second = rooms.get(String(found('u2')!.tableId))!;
    expect(second.meta.id).not.toBe(first.meta.id);

    expect(first.timings().nextHandMs).toBe(10_000);
    expect(second.timings().nextHandMs).toBe(3_000);
    expect(second.config.turnTimeMs).toBe(9_000);

    rooms.destroy(first.meta.id);
    expect(await kv.get(tableTimingsKey(first.meta.id))).toBeNull();
  });
});

describe('Matchmade rooms', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  function cashConfig() {
    return { maxSeats: 6, smallBlind: 5, bigBlind: 10, buyIn: 1000, turnTimeMs: 20_000 };
  }

  it('auto-deals after nextHandMs with no Ready, and rejects set_ready', async () => {
    const rooms = new RoomManager(new MemoryKv(), await createHistoryStore());
    const meta = rooms.create({
      name: 'Public table',
      hostUserId: 'felt-house',
      isPrivate: false,
      matchmade: true,
      timings: { ...DEFAULT_PUBLIC_TABLE_TIMINGS_MS, nextHandMs: 4_000 },
      config: cashConfig(),
    });
    const room = rooms.get(meta.id)!;
    expect(room.seatSystemBots(1).ok).toBe(true);
    expect(room.addBot('u1', undefined, 1000, 1).ok).toBe(false);
    expect((await room.autoSit('u1', 'Alice')).ok).toBe(true);
    expect(room.setReady('u1', true).ok).toBe(false);

    await vi.advanceTimersByTimeAsync(3_000);
    expect(room.state.street).toBe('waiting');
    await vi.advanceTimersByTimeAsync(1_500);
    expect(room.state.street).not.toBe('waiting');
    expect(room.state.street).not.toBe('payout');
  });

  it('private tables still wait for Ready', async () => {
    const rooms = new RoomManager(new MemoryKv(), await createHistoryStore());
    const meta = rooms.create({
      name: 'Home',
      hostUserId: 'u1',
      isPrivate: true,
      config: cashConfig(),
    });
    const room = rooms.get(meta.id)!;
    expect((await room.sit('u1', 'Alice', 0, 1000)).ok).toBe(true);
    expect((await room.sit('u2', 'Bob', 1, 1000)).ok).toBe(true);
    await vi.advanceTimersByTimeAsync(30_000);
    expect(room.state.street).toBe('waiting');
    expect(room.seatSystemBots(1).ok).toBe(false);
  });

  it('closes empty matchmade tables after their own idle window', async () => {
    const rooms = new RoomManager(new MemoryKv(), await createHistoryStore());
    const pub = rooms.create({
      name: 'Public table',
      hostUserId: 'felt-house',
      isPrivate: false,
      matchmade: true,
      timings: { ...DEFAULT_PUBLIC_TABLE_TIMINGS_MS, idleCloseMs: 60_000 },
      config: cashConfig(),
    });
    const priv = rooms.create({
      name: 'Home',
      hostUserId: 'u9',
      isPrivate: true,
      config: cashConfig(),
    });
    const room = rooms.get(pub.id)!;
    expect((await room.sit('u1', 'Alice', 0, 1000)).ok).toBe(true);
    room.leave('u1');

    const closed = rooms.terminateIdleRooms(Date.now() + 60_000, 15 * 60_000);
    expect(closed).toEqual([pub.id]);
    expect(rooms.get(priv.id)).toBeDefined();
  });

  it('hydrates timings from KV when a matchmade room has no in-memory snapshot', async () => {
    const kv = new MemoryKv();
    const history = await createHistoryStore();
    const cached = { ...DEFAULT_PUBLIC_TABLE_TIMINGS_MS, nextHandMs: 7_000 };
    await kv.set(tableTimingsKey('t1'), JSON.stringify(cached));
    const room = new Room(
      {
        id: 't1',
        inviteCode: '123456',
        name: 'Public table',
        hostUserId: 'felt-house',
        isPrivate: false,
        matchmade: true,
        config: cashConfig(),
        createdAt: Date.now(),
      },
      kv,
      history,
    );
    expect(room.timings()).toEqual(DEFAULT_PUBLIC_TABLE_TIMINGS_MS);
    await vi.advanceTimersByTimeAsync(0);
    expect(room.timings().nextHandMs).toBe(7_000);
  });
});
