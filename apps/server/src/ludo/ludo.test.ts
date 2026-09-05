import { LudoPublicViewSchema } from '@poker/protocol';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LUDO_INACTIVITY_MS, LudoRoomManager } from './ludo-room.js';

function createBoard(
  mgr: LudoRoomManager,
  extra?: { inviteCode?: string; maxSeats?: 2 | 3 | 4; turnTimeMs?: number },
) {
  return mgr.create({
    name: 'Test Ludo',
    hostUserId: 'host',
    maxSeats: extra?.maxSeats ?? 4,
    inviteCode: extra?.inviteCode,
    turnTimeMs: extra?.turnTimeMs,
  });
}

describe('LudoRoomManager', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('creates a board and resolves invite codes', () => {
    const mgr = new LudoRoomManager();
    const meta = createBoard(mgr, { inviteCode: '4242' });
    expect(meta.inviteCode).toBe('4242');
    expect(mgr.getByInvite('4242')?.meta.id).toBe(meta.id);
    expect(mgr.get(meta.id)?.toPublicView().status).toBe('waiting');
  });

  it('rejects invite codes used by poker/contests', () => {
    const mgr = new LudoRoomManager();
    mgr.setExternalInviteTaken((code) => code === '111111');
    expect(() => createBoard(mgr, { inviteCode: '111111' })).toThrow('already in use');
    const meta = createBoard(mgr);
    expect(meta.inviteCode).toMatch(/^\d{6}$/);
    expect(meta.inviteCode).not.toBe('111111');
  });

  it('sits, readies, starts, and rematches', () => {
    const mgr = new LudoRoomManager();
    const meta = createBoard(mgr, { maxSeats: 2 });
    const room = mgr.get(meta.id)!;

    expect(room.sit('u1', 'Ada', 0).ok).toBe(true);
    expect(room.sit('u2', 'Ben', 1).ok).toBe(true);
    expect(room.setReady('u1', true).ok).toBe(true);
    expect(room.state.phase).toBe('lobby');
    expect(room.setReady('u2', true).ok).toBe(true);
    expect(room.state.phase).toBe('rolling');
    expect(room.state.toAct).toBe(0);

    const view = room.toPublicView();
    expect(view.status).toBe('playing');
    expect(view.die).toBeNull();
    expect(view.seq).toBeGreaterThan(0);
    expect(LudoPublicViewSchema.safeParse(view).success).toBe(true);

    // Force finished so rematch can start via ready-up.
    room.state.phase = 'finished';
    room.state.winnerSeat = 0;
    room.state.toAct = null;
    for (const s of room.state.seats) {
      if (s.status === 'seated' && !s.isBot) s.ready = false;
    }
    expect(room.setReady('u1', true).ok).toBe(true);
    expect(room.state.phase).toBe('finished');
    expect(room.setReady('u2', true).ok).toBe(true);
    expect(room.state.phase).toBe('rolling');
    expect(room.state.winnerSeat).toBeNull();
  });

  it('maps engine main-track tokens to protocol track positions', () => {
    const mgr = new LudoRoomManager();
    const meta = createBoard(mgr);
    const room = mgr.get(meta.id)!;
    room.sit('u1', 'Ada', 0);
    room.state.seats[0]!.tokens[0]!.pos = { kind: 'main', index: 13 };
    const token = room.toPublicView().seats[0]!.tokens[0]!;
    expect(token.pos).toEqual({ kind: 'track', index: 13 });
    expect(LudoPublicViewSchema.safeParse(room.toPublicView()).success).toBe(true);
  });

  it('keeps a chat buffer and includes you.seat + legalMoves on sync', () => {
    const mgr = new LudoRoomManager();
    const meta = createBoard(mgr, { maxSeats: 2 });
    const room = mgr.get(meta.id)!;
    const inbox: unknown[] = [];
    room.attach({
      userId: 'u1',
      name: 'Ada',
      avatarId: 0,
      avatarUrl: null,
      send: (msg) => inbox.push(msg),
    });
    room.sit('u1', 'Ada', 0);
    room.sit('u2', 'Ben', 1);
    room.setReady('u1', true);
    room.setReady('u2', true);
    room.chat('u1', 'Ada', 'hello board');

    const chat = room.listChat();
    expect(chat.some((m) => m.text === 'hello board')).toBe(true);

    const syncs = inbox.filter(
      (m): m is { type: string; you: { seat: number | null }; legalMoves?: { tokenIndex: number }[] } =>
        Boolean(m && typeof m === 'object' && (m as { type?: string }).type === 'ludo_state_sync'),
    );
    const last = syncs.at(-1);
    expect(last?.you.seat).toBe(0);
    expect(last?.legalMoves).toEqual([]);
  });

  it('auto-plays the first legal move after a human turn timeout', () => {
    vi.useFakeTimers();
    const mgr = new LudoRoomManager();
    const meta = createBoard(mgr, { maxSeats: 2, turnTimeMs: 50 });
    const room = mgr.get(meta.id)!;
    room.sit('u1', 'Ada', 0);
    room.sit('u2', 'Ben', 1);
    room.setReady('u1', true);
    room.setReady('u2', true);
    expect(room.state.phase).toBe('rolling');
    expect(room.state.toAct).toBe(0);

    const seqBefore = room.state.actionSeq;
    vi.advanceTimersByTime(60);
    expect(room.state.actionSeq).toBeGreaterThan(seqBefore);
    expect(room.state.toAct === 0 || room.state.toAct === 1).toBe(true);
  });

  it('vacates a lobby seat after disconnect grace and closes idle boards', () => {
    vi.useFakeTimers();
    const mgr = new LudoRoomManager();
    const meta = createBoard(mgr);
    const room = mgr.get(meta.id)!;
    const send = () => undefined;
    room.attach({ userId: 'u1', name: 'Ada', avatarId: 0, avatarUrl: null, send });
    room.sit('u1', 'Ada', 0);
    expect(room.state.seats[0]!.userId).toBe('u1');

    room.detachIfActive('u1', send);
    room.scheduleDisconnect('u1');
    vi.advanceTimersByTime(120_000);
    expect(room.state.seats[0]!.status).toBe('empty');

    const closed = mgr.terminateIdleRooms(Date.now() + LUDO_INACTIVITY_MS, LUDO_INACTIVITY_MS);
    expect(closed).toContain(meta.id);
    expect(mgr.get(meta.id)).toBeUndefined();
  });

  it('seats bots from the shared name pool', () => {
    const mgr = new LudoRoomManager();
    const meta = createBoard(mgr, { maxSeats: 3 });
    const room = mgr.get(meta.id)!;
    const result = room.addBot('host', undefined, 2, ['AceBot', 'RiverRat']);
    expect(result.ok).toBe(true);
    expect(result.added).toBe(2);
    const bots = room.state.seats.filter((s) => s.isBot);
    expect(bots).toHaveLength(2);
    expect(bots.every((b) => b.ready)).toBe(true);
    expect(bots.every((b) => b.userId?.startsWith('bot:'))).toBe(true);
  });

  it('does not start a match from bots alone; host must sit and ready', () => {
    const mgr = new LudoRoomManager();
    const meta = createBoard(mgr, { maxSeats: 4 });
    const room = mgr.get(meta.id)!;
    expect(room.addBot('host', undefined, 2).ok).toBe(true);
    expect(room.state.phase).toBe('lobby');

    expect(room.autoSit('host', 'Ada').ok).toBe(true);
    expect(room.state.phase).toBe('lobby');
    expect(room.setReady('host', true).ok).toBe(true);
    expect(room.state.phase).toBe('rolling');
    expect(room.toPublicView().status).toBe('playing');
  });
});
