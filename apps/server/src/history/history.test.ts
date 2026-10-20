import { mkdir, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  FileHistoryStore,
  PostgresHistoryStore,
  playerUserIdsFromResult,
} from './history.store.js';
import {
  HistoryService,
  redactForAnalysis,
  redactUnrevealedHoleCards,
} from './history.service.js';
import { parseHandReviews, runTableCoach, type CoachReviewRow } from './hand-coach.js';
import type { HandHistoryRow } from '@poker/db';

describe('playerUserIdsFromResult', () => {
  it('returns unique seated user ids', () => {
    expect(
      playerUserIdsFromResult({
        players: [
          { seat: 0, userId: 'a' },
          { seat: 1, userId: 'b' },
          { seat: 2, userId: 'a' },
          { seat: 3, userId: null },
        ],
      }),
    ).toEqual(['a', 'b']);
  });

  it('returns empty for malformed results', () => {
    expect(playerUserIdsFromResult(null)).toEqual([]);
    expect(playerUserIdsFromResult({})).toEqual([]);
  });
});

describe('redactUnrevealedHoleCards', () => {
  it('keeps revealed hole cards and strips the rest', () => {
    const json = JSON.stringify({
      players: [
        { userId: 'a', revealed: true, holeCards: [{ rank: 14, suit: 'h' }] },
        { userId: 'b', revealed: false, holeCards: [{ rank: 13, suit: 's' }] },
      ],
    });
    const out = JSON.parse(redactUnrevealedHoleCards(json)) as {
      players: Array<{ userId: string; holeCards: unknown }>;
    };
    expect(out.players[0]?.holeCards).toEqual([{ rank: 14, suit: 'h' }]);
    expect(out.players[1]?.holeCards).toBeNull();
  });

  it('keeps the viewer hole cards even when unrevealed', () => {
    const json = JSON.stringify({
      players: [
        { userId: 'a', revealed: false, holeCards: [{ rank: 14, suit: 'h' }] },
        { userId: 'b', revealed: false, holeCards: [{ rank: 13, suit: 's' }] },
      ],
    });
    const out = JSON.parse(redactUnrevealedHoleCards(json, 'a')) as {
      players: Array<{ userId: string; holeCards: unknown }>;
    };
    expect(out.players[0]?.holeCards).toEqual([{ rank: 14, suit: 'h' }]);
    expect(out.players[1]?.holeCards).toBeNull();
  });
});

describe('redactForAnalysis', () => {
  it('keeps the viewer, revealed and bot hole cards only', () => {
    const json = JSON.stringify({
      players: [
        { userId: 'a', revealed: false, holeCards: [{ rank: 14, suit: 'h' }] },
        { userId: 'b', revealed: false, holeCards: [{ rank: 13, suit: 's' }] },
        { userId: 'c', revealed: true, holeCards: [{ rank: 12, suit: 's' }] },
        { userId: 'bot:nit:x', revealed: false, holeCards: [{ rank: 2, suit: 'c' }] },
      ],
    });
    const out = JSON.parse(redactForAnalysis(json, 'a')) as {
      players: Array<{ userId: string; holeCards: unknown }>;
    };
    expect(out.players.map((p) => p.holeCards !== null)).toEqual([true, false, true, true]);
  });
});

describe('FileHistoryStore hand counts', () => {
  let dir: string;
  let store: FileHistoryStore;

  beforeEach(async () => {
    dir = path.join(os.tmpdir(), `felt-hist-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await mkdir(dir, { recursive: true });
    store = new FileHistoryStore(dir);
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('counts hands a user was dealt into', async () => {
    await store.recordHand({
      tableId: 't1',
      handId: 'h1',
      startedAt: 1,
      endedAt: 2,
      result: { players: [{ userId: 'alice' }, { userId: 'bob' }] },
    });
    await store.recordHand({
      tableId: 't1',
      handId: 'h2',
      startedAt: 3,
      endedAt: 4,
      result: { players: [{ userId: 'alice' }] },
    });

    expect(await store.countHandsForUser('alice')).toBe(2);
    expect(await store.countHandsForUser('bob')).toBe(1);
    expect(await store.countHandsForUser('carol')).toBe(0);

    const byUser = await store.countHandsByUser();
    expect(byUser.get('alice')).toBe(2);
    expect(byUser.get('bob')).toBe(1);
  });

  it('is idempotent on tableId+handId', async () => {
    const first = await store.recordHand({
      tableId: 't1',
      handId: 'h1',
      startedAt: 1,
      endedAt: 2,
      result: { players: [{ userId: 'alice' }] },
    });
    const second = await store.recordHand({
      tableId: 't1',
      handId: 'h1',
      startedAt: 3,
      endedAt: 4,
      result: { players: [{ userId: 'alice' }] },
    });
    expect(first).toBe(true);
    expect(second).toBe(false);
    expect(await store.countHandsForUser('alice')).toBe(1);
  });

  it('pages a user hands by table and time bounds', async () => {
    for (const [handId, tableId, startedAt] of [
      ['h1', 't1', 100],
      ['h2', 't1', 200],
      ['h3', 't2', 300],
      ['h4', 't1', 400],
    ] as const) {
      await store.recordHand({
        tableId,
        handId,
        startedAt,
        endedAt: startedAt + 1,
        result: { players: [{ userId: 'alice' }] },
      });
    }
    const t1 = await store.listHandsForUserPage({ userId: 'alice', tableId: 't1' });
    expect(t1.map((h) => h.handId)).toEqual(['h4', 'h2', 'h1']);
    const window = await store.listHandsForUserPage({ userId: 'alice', since: 200, before: 400 });
    expect(window.map((h) => h.handId)).toEqual(['h3', 'h2']);
    expect(await store.listHandsForUserPage({ userId: 'bob' })).toEqual([]);
  });

  it('fills an analysis page of player hands behind many bot hands', async () => {
    const card = (rank: number, suit: string) => ({ rank, suit });
    for (let i = 0; i < 260; i++) {
      await store.recordHand({
        tableId: 'bots',
        handId: `b${i}`,
        startedAt: 10_000 + i,
        endedAt: 10_001 + i,
        result: {
          players: [
            { seat: 0, userId: 'alice', revealed: false, holeCards: [card(14, 'h'), card(13, 'h')] },
            { seat: 1, userId: 'bot:nit:x', name: 'Nit', revealed: false, holeCards: [card(2, 'c'), card(7, 'd')] },
          ],
          actions: [],
        },
      });
    }
    for (let i = 0; i < 3; i++) {
      await store.recordHand({
        tableId: 'people',
        handId: `p${i}`,
        startedAt: 1_000 + i,
        endedAt: 1_001 + i,
        result: {
          players: [
            { seat: 0, userId: 'alice', revealed: true, holeCards: [card(14, 'h'), card(13, 'h')] },
            { seat: 1, userId: 'bob', name: 'Bob', revealed: true, holeCards: [card(2, 'c'), card(7, 'd')] },
          ],
          actions: [],
        },
      });
    }
    const service = new HistoryService({} as never, {} as never, {} as never);
    (service as unknown as { store: FileHistoryStore }).store = store;

    const players = await service.listAnalysisHands('alice', { opponents: 'players', limit: 30 });
    expect(players.hands.map((h) => h.handId)).toEqual(['p2', 'p1', 'p0']);
    expect(players.nextBefore).toBeNull();

    const bots = await service.listAnalysisHands('alice', { opponents: 'bots', limit: 30 });
    expect(bots.hands).toHaveLength(30);
    expect(bots.nextBefore).not.toBeNull();

    const tables = await service.listAnalysisTables('alice', {});
    expect(tables.tables.map((t) => [t.tableId, t.opponents, t.hands])).toEqual([
      ['bots', 'bots', 260],
      ['people', 'players', 3],
    ]);
    expect(tables.nextBefore).toBeNull();
    expect(tables.tables.map((t) => t.players)).toEqual([
      [{ userId: 'bot:nit:x', name: 'Nit', isBot: true }],
      [{ userId: 'bob', name: 'Bob', isBot: false }],
    ]);

    const firstPage = await service.listAnalysisTables('alice', { limit: 1 });
    expect(firstPage.tables.map((t) => t.tableId)).toEqual(['bots']);
    const secondPage = await service.listAnalysisTables('alice', {
      limit: 1,
      before: firstPage.nextBefore!,
    });
    expect(secondPage.tables.map((t) => [t.tableId, t.hands])).toEqual([['people', 3]]);
  });

  it('counts hands the viewer won per table', async () => {
    const card = (rank: number, suit: string) => ({ rank, suit });
    for (let i = 0; i < 4; i++) {
      await store.recordHand({
        tableId: 't',
        handId: `h${i}`,
        startedAt: 100 + i,
        endedAt: 101 + i,
        result: {
          winners: [{ seat: i % 2, amount: 10 }],
          players: [
            { seat: 0, userId: 'alice', revealed: false, holeCards: [card(14, 'h'), card(13, 'h')] },
            { seat: 1, userId: 'bot:nit:x', revealed: false, holeCards: [card(2, 'c'), card(7, 'd')] },
          ],
          actions: [],
        },
      });
    }
    const service = new HistoryService({} as never, {} as never, {} as never);
    (service as unknown as { store: FileHistoryStore }).store = store;
    const { tables } = await service.listAnalysisTables('alice', {});
    expect(tables[0]).toMatchObject({ tableId: 't', hands: 4, handsWon: 2, firstAt: 100, lastAt: 103 });
  });

  it('stores chat and lists by table', async () => {
    await store.recordChat({
      tableId: 't1',
      userId: 'alice',
      name: 'Alice',
      text: 'hi',
      at: 10,
      kind: 'user',
    });
    await store.recordChat({
      tableId: 't1',
      userId: 'system',
      name: 'Dealer',
      text: 'flop',
      at: 20,
      kind: 'system',
    });
    const chat = await store.listChat({ tableId: 't1' });
    expect(chat.map((c) => c.text)).toEqual(['hi', 'flop']);
  });
});

describe('PostgresHistoryStore.recordTable', () => {
  const meta = {
    id: 'ZihnkqRbdi',
    inviteCode: '373533',
    name: 'Mid stakes',
    hostUserId: 'felt-house',
    isPrivate: false,
    config: {
      maxSeats: 6,
      smallBlind: 10,
      bigBlind: 25,
      buyIn: 2500,
      turnTimeMs: 20_000,
    },
    createdAt: 1,
  };

  it('retries with a disambiguated invite code when the unique constraint fires', async () => {
    const inserts: unknown[][] = [];
    const pool = {
      async query(_sql: string, params?: unknown[]) {
        if (_sql.includes('INSERT INTO tables')) {
          inserts.push(params ?? []);
          if (inserts.length === 1) {
            const err = Object.assign(new Error('duplicate key'), { code: '23505' });
            throw err;
          }
        }
        return { rows: [] };
      },
    };
    const store = new PostgresHistoryStore(pool);
    await store.recordTable(meta);
    expect(inserts).toHaveLength(2);
    expect(inserts[0]?.[1]).toBe('373533');
    expect(inserts[1]?.[1]).toBe('373533:ZihnkqRbdi');
  });
});

describe('runTableCoach', () => {
  const hand = (tableId: string, handId: string): HandHistoryRow => ({
    id: handId,
    tableId,
    handId,
    contestId: null,
    source: 'online',
    startedAt: new Date(1_000),
    endedAt: new Date(2_000),
    resultJson: JSON.stringify({
      community: [{ rank: 14, suit: 's' }, { rank: 9, suit: 'd' }, { rank: 2, suit: 'c' }],
      winners: [{ seat: 0, amount: 40, handName: 'One Pair' }],
      players: [
        {
          seat: 0,
          userId: 'alice',
          name: 'Alice',
          stack: 1000,
          revealed: true,
          holeCards: [{ rank: 14, suit: 'h' }, { rank: 14, suit: 'd' }],
        },
        {
          seat: 1,
          userId: 'bob',
          name: 'Bob',
          stack: 900,
          revealed: true,
          holeCards: [{ rank: 13, suit: 'c' }, { rank: 13, suit: 'd' }],
        },
      ],
      actions: [
        { type: 'blinds_posted', sb: 10, bb: 20, sbSeat: 0, bbSeat: 1 },
        { type: 'action', seat: 0, action: 'raise', amount: 60 },
        { type: 'action', seat: 1, action: 'call', amount: 40 },
      ],
    }),
  });

  function harness() {
    const rows: CoachReviewRow[] = [];
    const calls: string[] = [];
    const save = async (row: CoachReviewRow) => {
      const i = rows.findIndex((r) => r.tableId === row.tableId);
      if (i >= 0) rows[i] = row;
      else rows.push(row);
    };
    const coach = (tableId: string, handId = 'h1') =>
      runTableCoach({
        userId: 'alice',
        tableId,
        day: '2026-10-18',
        hands: [hand(tableId, handId)],
        truncated: false,
        rows,
        save,
        limit: 3,
        complete: async (_system, user) => {
          calls.push(user);
          return {
            text: JSON.stringify({
              summary: `Summary ${tableId}`,
              hands: [{ n: 1, text: `Note ${tableId}` }],
            }),
            error: null,
          };
        },
      });
    return { rows, calls, coach };
  }

  it('maps hand numbers onto the hand ids from the notes', () => {
    const raw = 'Here you go.\n{"hands":[{"n":2,"text":"Call less."},{"n":1,"text":"Raise."}]}';
    expect(parseHandReviews(raw, ['early', 'late'])).toEqual({
      early: 'Raise.',
      late: 'Call less.',
    });
    expect(parseHandReviews('not json', ['early'])).toBeNull();
    expect(
      parseHandReviews('{"hands":[{"n":1,"text":"Fold."}]} trailing } note', ['h1']),
    ).toEqual({ h1: 'Fold.' });
  });

  it('allows three tables, blocks the fourth, and repeats the first for free', async () => {
    const { calls, coach } = harness();
    const first = await coach('t1');
    const second = await coach('t2');
    const third = await coach('t3');
    expect(first.ok && first.used).toBe(1);
    expect(first.ok && first.reviews.h1).toBe('Note t1');
    expect(first.ok && first.summary).toBe('Summary t1');
    expect(second.ok && second.remaining).toBe(1);
    expect(third.ok && third.remaining).toBe(0);
    expect(calls).toHaveLength(3);

    const fourth = await coach('t4');
    expect(fourth.ok).toBe(false);
    if (!fourth.ok) expect(fourth.code).toBe('limit');
    expect(calls).toHaveLength(3);

    const again = await coach('t1');
    expect(again.ok && again.cached).toBe(true);
    expect(again.ok && again.summary).toBe('Summary t1');
    expect(again.ok && again.used).toBe(3);
    expect(calls).toHaveLength(3);
  });

  it('regenerates a coached table when its hands change without using a new slot', async () => {
    const { calls, coach } = harness();
    await coach('t1', 'h1');
    await coach('t2');
    await coach('t3');
    const updated = await coach('t1', 'h2');
    expect(updated.ok && updated.cached).toBe(false);
    expect(updated.ok && updated.used).toBe(3);
    expect(updated.ok && updated.reviews.h2).toBe('Note t1');
    expect(calls).toHaveLength(4);
    expect(calls.at(-1)).toContain('Ah');
  });
});
