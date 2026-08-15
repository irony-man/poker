import { mkdir, readFile, appendFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { nanoid } from 'nanoid';
import type {
  ChatMessageKind,
  ChatMessageRow,
  HandHistoryRow,
  HandHistorySource,
} from '@poker/db';
import type { TableMeta } from '../rooms/room.js';

export type { HandHistorySource, ChatMessageKind };

export interface RecordHandInput {
  tableId: string;
  handId: string;
  startedAt: number;
  endedAt: number;
  result: unknown;
  contestId?: string | null;
  source?: HandHistorySource;
}

export interface RecordChatInput {
  tableId: string;
  contestId?: string | null;
  handId?: string | null;
  userId: string;
  name: string;
  text: string;
  at: number;
  kind: ChatMessageKind;
  source?: HandHistorySource;
}

export interface ListChatQuery {
  tableId?: string;
  contestId?: string;
  handId?: string;
  limit?: number;
  before?: number;
}

export interface ListHandsPageQuery {
  page?: number;
  pageSize?: number;
  source?: HandHistorySource;
  tableId?: string;
  contestId?: string;
  q?: string;
}

export interface HandHistoryPage {
  items: HandHistoryRow[];
  total: number;
  page: number;
  pageSize: number;
}

export interface HandHistoryStore {
  recordTable(meta: TableMeta): Promise<void>;
  /** Returns true when a new row was inserted. */
  recordHand(input: RecordHandInput): Promise<boolean>;
  recordChat(input: RecordChatInput): Promise<void>;
  listHands(tableId: string, limit?: number): Promise<HandHistoryRow[]>;
  listHandsForContest(contestId: string, limit?: number): Promise<HandHistoryRow[]>;
  listHandsForUser(userId: string, limit?: number): Promise<HandHistoryRow[]>;
  listHandsPage(query: ListHandsPageQuery): Promise<HandHistoryPage>;
  getHandById(id: string): Promise<HandHistoryRow | null>;
  listChat(query: ListChatQuery): Promise<ChatMessageRow[]>;
  countHandsForUser(userId: string): Promise<number>;
  countHandsByUser(): Promise<Map<string, number>>;
}

export function playerUserIdsFromResult(result: unknown): string[] {
  if (!result || typeof result !== 'object') return [];
  const players = (result as { players?: unknown }).players;
  if (!Array.isArray(players)) return [];
  const seen = new Set<string>();
  for (const p of players) {
    if (!p || typeof p !== 'object') continue;
    const id = (p as { userId?: unknown }).userId;
    if (typeof id === 'string' && id) seen.add(id);
  }
  return [...seen];
}

function playerUserIdsFromResultJson(resultJson: string): string[] {
  try {
    return playerUserIdsFromResult(JSON.parse(resultJson) as unknown);
  } catch {
    return [];
  }
}

function asSource(raw: unknown): HandHistorySource {
  return raw === 'offline' ? 'offline' : 'online';
}

function asKind(raw: unknown): ChatMessageKind {
  if (raw === 'system' || raw === 'emoji') return raw;
  return 'user';
}

function normalizeHandRow(o: HandHistoryRow): HandHistoryRow {
  return {
    ...o,
    contestId: o.contestId ?? null,
    source: asSource(o.source),
    startedAt: new Date(o.startedAt),
    endedAt: o.endedAt ? new Date(o.endedAt) : null,
  };
}

function normalizeChatRow(o: ChatMessageRow): ChatMessageRow {
  return {
    ...o,
    contestId: o.contestId ?? null,
    handId: o.handId ?? null,
    kind: asKind(o.kind),
    source: asSource(o.source),
    at: new Date(o.at),
  };
}

function matchesPageQuery(hand: HandHistoryRow, query: ListHandsPageQuery): boolean {
  if (query.source && asSource(hand.source) !== query.source) return false;
  if (query.tableId && hand.tableId !== query.tableId) return false;
  if (query.contestId && (hand.contestId ?? null) !== query.contestId) return false;
  const q = query.q?.trim().toLowerCase();
  if (!q) return true;
  const hay = [
    hand.tableId,
    hand.handId,
    hand.contestId ?? '',
    hand.source,
    hand.resultJson,
  ]
    .join(' ')
    .toLowerCase();
  return hay.includes(q);
}

export function clampPageSize(raw?: number, fallback = 25): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(100, Math.max(1, Math.floor(n)));
}

export function clampPage(raw?: number): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return 1;
  return Math.max(1, Math.floor(n));
}

/** No-op store for unit tests that do not persist history. */
export function memoryHistoryStore(): HandHistoryStore {
  return {
    async recordTable() {},
    async recordHand() {
      return true;
    },
    async recordChat() {},
    async listHands() {
      return [];
    },
    async listHandsForContest() {
      return [];
    },
    async listHandsForUser() {
      return [];
    },
    async listHandsPage() {
      return { items: [], total: 0, page: 1, pageSize: 25 };
    },
    async getHandById() {
      return null;
    },
    async listChat() {
      return [];
    },
    async countHandsForUser() {
      return 0;
    },
    async countHandsByUser() {
      return new Map();
    },
  };
}

/** File-backed history when DATABASE_URL is unset. */
export class FileHistoryStore implements HandHistoryStore {
  private dir: string;
  private hands: HandHistoryRow[] = [];
  private chats: ChatMessageRow[] = [];
  private loaded = false;

  constructor(dir = path.join(process.cwd(), 'data')) {
    this.dir = dir;
  }

  private async ensure(): Promise<void> {
    if (this.loaded) return;
    await mkdir(this.dir, { recursive: true });
    try {
      const raw = await readFile(path.join(this.dir, 'hands.jsonl'), 'utf8');
      this.hands = raw
        .split('\n')
        .filter(Boolean)
        .map((line) => normalizeHandRow(JSON.parse(line) as HandHistoryRow));
    } catch {
      this.hands = [];
    }
    try {
      const raw = await readFile(path.join(this.dir, 'chat.jsonl'), 'utf8');
      this.chats = raw
        .split('\n')
        .filter(Boolean)
        .map((line) => normalizeChatRow(JSON.parse(line) as ChatMessageRow));
    } catch {
      this.chats = [];
    }
    this.loaded = true;
  }

  async recordTable(meta: TableMeta): Promise<void> {
    await this.ensure();
    await appendFile(
      path.join(this.dir, 'tables.jsonl'),
      JSON.stringify(meta) + '\n',
      'utf8',
    );
  }

  async recordHand(input: RecordHandInput): Promise<boolean> {
    await this.ensure();
    if (this.hands.some((h) => h.tableId === input.tableId && h.handId === input.handId)) {
      return false;
    }
    const row: HandHistoryRow = {
      id: nanoid(12),
      tableId: input.tableId,
      handId: input.handId,
      contestId: input.contestId ?? null,
      source: input.source ?? 'online',
      startedAt: new Date(input.startedAt),
      endedAt: new Date(input.endedAt),
      resultJson: JSON.stringify(input.result),
    };
    this.hands.push(row);
    await appendFile(path.join(this.dir, 'hands.jsonl'), JSON.stringify(row) + '\n', 'utf8');
    return true;
  }

  async recordChat(input: RecordChatInput): Promise<void> {
    await this.ensure();
    const row: ChatMessageRow = {
      id: nanoid(12),
      tableId: input.tableId,
      contestId: input.contestId ?? null,
      handId: input.handId ?? null,
      userId: input.userId,
      name: input.name,
      text: input.text,
      at: new Date(input.at),
      kind: input.kind,
      source: input.source ?? 'online',
    };
    this.chats.push(row);
    await appendFile(path.join(this.dir, 'chat.jsonl'), JSON.stringify(row) + '\n', 'utf8');
  }

  async listHands(tableId: string, limit = 50): Promise<HandHistoryRow[]> {
    await this.ensure();
    return this.hands.filter((h) => h.tableId === tableId).slice(-limit).reverse();
  }

  async listHandsForContest(contestId: string, limit = 50): Promise<HandHistoryRow[]> {
    await this.ensure();
    return this.hands.filter((h) => h.contestId === contestId).slice(-limit).reverse();
  }

  async listHandsForUser(userId: string, limit = 50): Promise<HandHistoryRow[]> {
    await this.ensure();
    const matched = this.hands.filter((h) => playerUserIdsFromResultJson(h.resultJson).includes(userId));
    return matched.slice(-limit).reverse();
  }

  async listHandsPage(query: ListHandsPageQuery): Promise<HandHistoryPage> {
    await this.ensure();
    const page = clampPage(query.page);
    const pageSize = clampPageSize(query.pageSize);
    const matched = this.hands
      .filter((h) => matchesPageQuery(h, query))
      .slice()
      .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());
    const start = (page - 1) * pageSize;
    return {
      items: matched.slice(start, start + pageSize),
      total: matched.length,
      page,
      pageSize,
    };
  }

  async getHandById(id: string): Promise<HandHistoryRow | null> {
    await this.ensure();
    return this.hands.find((h) => h.id === id) ?? null;
  }

  async listChat(query: ListChatQuery): Promise<ChatMessageRow[]> {
    await this.ensure();
    const limit = clampPageSize(query.limit, 80);
    let rows = this.chats;
    if (query.tableId) rows = rows.filter((c) => c.tableId === query.tableId);
    if (query.contestId) rows = rows.filter((c) => c.contestId === query.contestId);
    if (query.handId) rows = rows.filter((c) => c.handId === query.handId);
    if (query.before) {
      const before = query.before;
      rows = rows.filter((c) => c.at.getTime() < before);
    }
    return rows
      .slice()
      .sort((a, b) => b.at.getTime() - a.at.getTime())
      .slice(0, limit)
      .reverse();
  }

  async countHandsForUser(userId: string): Promise<number> {
    const byUser = await this.countHandsByUser();
    return byUser.get(userId) ?? 0;
  }

  async countHandsByUser(): Promise<Map<string, number>> {
    await this.ensure();
    const counts = new Map<string, number>();
    for (const hand of this.hands) {
      for (const userId of playerUserIdsFromResultJson(hand.resultJson)) {
        counts.set(userId, (counts.get(userId) ?? 0) + 1);
      }
    }
    return counts;
  }
}

function pgHandSelect(): string {
  return `id, table_id as "tableId", hand_id as "handId", contest_id as "contestId",
          COALESCE(source, 'online') as "source", started_at as "startedAt",
          ended_at as "endedAt", result_json as "resultJson"`;
}

function pgChatSelect(): string {
  return `id, table_id as "tableId", contest_id as "contestId", hand_id as "handId",
          user_id as "userId", name, text, at, kind, COALESCE(source, 'online') as "source"`;
}

/** Postgres-backed store when DATABASE_URL is set (uses shared pool). */
export class PostgresHistoryStore implements HandHistoryStore {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private pool: any;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(pool: any) {
    this.pool = pool;
  }

  async recordTable(meta: TableMeta): Promise<void> {
    // Ensure host exists so FK (if present on older DBs) never blocks history.
    await this.pool.query(
      `INSERT INTO users (id, name) VALUES ($1, $2)
       ON CONFLICT (id) DO NOTHING`,
      [meta.hostUserId, meta.hostUserId],
    );
    await this.pool.query(
      `INSERT INTO tables (id, invite_code, name, small_blind, big_blind, min_buy_in, max_buy_in, turn_time_ms, max_seats, is_private, host_user_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       ON CONFLICT (id) DO NOTHING`,
      [
        meta.id,
        meta.inviteCode,
        meta.name,
        meta.config.smallBlind,
        meta.config.bigBlind,
        meta.config.buyIn,
        meta.config.buyIn,
        meta.config.turnTimeMs,
        meta.config.maxSeats,
        meta.isPrivate,
        meta.hostUserId,
      ],
    );
  }

  async recordHand(input: RecordHandInput): Promise<boolean> {
    const res = await this.pool.query(
      `INSERT INTO hand_history (id, table_id, hand_id, contest_id, source, started_at, ended_at, result_json)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT (table_id, hand_id) DO NOTHING
       RETURNING id`,
      [
        nanoid(12),
        input.tableId,
        input.handId,
        input.contestId ?? null,
        input.source ?? 'online',
        new Date(input.startedAt),
        new Date(input.endedAt),
        JSON.stringify(input.result),
      ],
    );
    return Array.isArray(res.rows) && res.rows.length > 0;
  }

  async recordChat(input: RecordChatInput): Promise<void> {
    await this.pool.query(
      `INSERT INTO chat_messages (id, table_id, contest_id, hand_id, user_id, name, text, at, kind, source)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [
        nanoid(12),
        input.tableId,
        input.contestId ?? null,
        input.handId ?? null,
        input.userId,
        input.name,
        input.text,
        new Date(input.at),
        input.kind,
        input.source ?? 'online',
      ],
    );
  }

  async listHands(tableId: string, limit = 50): Promise<HandHistoryRow[]> {
    const res = await this.pool.query(
      `SELECT ${pgHandSelect()}
       FROM hand_history WHERE table_id = $1 ORDER BY started_at DESC LIMIT $2`,
      [tableId, limit],
    );
    return res.rows;
  }

  async listHandsForContest(contestId: string, limit = 50): Promise<HandHistoryRow[]> {
    const res = await this.pool.query(
      `SELECT ${pgHandSelect()}
       FROM hand_history WHERE contest_id = $1 ORDER BY started_at DESC LIMIT $2`,
      [contestId, limit],
    );
    return res.rows;
  }

  async listHandsForUser(userId: string, limit = 50): Promise<HandHistoryRow[]> {
    const res = await this.pool.query(
      `SELECT ${pgHandSelect()}
       FROM hand_history h
       WHERE EXISTS (
         SELECT 1 FROM jsonb_array_elements(
           CASE
             WHEN h.result_json IS NULL THEN '[]'::jsonb
             WHEN jsonb_typeof(h.result_json::jsonb -> 'players') = 'array'
               THEN h.result_json::jsonb -> 'players'
             ELSE '[]'::jsonb
           END
         ) p
         WHERE p->>'userId' = $1
       )
       ORDER BY started_at DESC LIMIT $2`,
      [userId, limit],
    );
    return res.rows;
  }

  async listHandsPage(query: ListHandsPageQuery): Promise<HandHistoryPage> {
    const page = clampPage(query.page);
    const pageSize = clampPageSize(query.pageSize);
    const q = query.q?.trim() ? `%${query.q.trim()}%` : null;
    const params = [
      query.source ?? null,
      query.tableId ?? null,
      query.contestId ?? null,
      q,
    ];
    const where = `
      WHERE ($1::text IS NULL OR COALESCE(source, 'online') = $1)
        AND ($2::text IS NULL OR table_id = $2)
        AND ($3::text IS NULL OR contest_id = $3)
        AND ($4::text IS NULL OR (
          table_id ILIKE $4 OR hand_id ILIKE $4
          OR COALESCE(contest_id, '') ILIKE $4
          OR result_json ILIKE $4
        ))`;
    const countRes = await this.pool.query(
      `SELECT COUNT(*)::int AS n FROM hand_history ${where}`,
      params,
    );
    const total = Number(countRes.rows[0]?.n ?? 0);
    const res = await this.pool.query(
      `SELECT ${pgHandSelect()}
       FROM hand_history ${where}
       ORDER BY started_at DESC
       LIMIT $5 OFFSET $6`,
      [...params, pageSize, (page - 1) * pageSize],
    );
    return { items: res.rows, total, page, pageSize };
  }

  async getHandById(id: string): Promise<HandHistoryRow | null> {
    const res = await this.pool.query(
      `SELECT ${pgHandSelect()} FROM hand_history WHERE id = $1 LIMIT 1`,
      [id],
    );
    return (res.rows[0] as HandHistoryRow | undefined) ?? null;
  }

  async listChat(query: ListChatQuery): Promise<ChatMessageRow[]> {
    const limit = clampPageSize(query.limit, 80);
    const before = query.before ? new Date(query.before) : null;
    const res = await this.pool.query(
      `SELECT ${pgChatSelect()}
       FROM chat_messages
       WHERE ($1::text IS NULL OR table_id = $1)
         AND ($2::text IS NULL OR contest_id = $2)
         AND ($3::text IS NULL OR hand_id = $3)
         AND ($4::timestamptz IS NULL OR at < $4)
       ORDER BY at DESC
       LIMIT $5`,
      [query.tableId ?? null, query.contestId ?? null, query.handId ?? null, before, limit],
    );
    return [...(res.rows as ChatMessageRow[])].reverse();
  }

  async countHandsForUser(userId: string): Promise<number> {
    const res = await this.pool.query(
      `SELECT COUNT(DISTINCT h.id)::int AS n
       FROM hand_history h
       CROSS JOIN LATERAL jsonb_array_elements(
         CASE
           WHEN h.result_json IS NULL THEN '[]'::jsonb
           WHEN jsonb_typeof(h.result_json::jsonb -> 'players') = 'array'
             THEN h.result_json::jsonb -> 'players'
           ELSE '[]'::jsonb
         END
       ) p
       WHERE p->>'userId' = $1`,
      [userId],
    );
    return Number(res.rows[0]?.n ?? 0);
  }

  async countHandsByUser(): Promise<Map<string, number>> {
    const res = await this.pool.query(
      `SELECT p->>'userId' AS user_id, COUNT(DISTINCT h.id)::int AS n
       FROM hand_history h
       CROSS JOIN LATERAL jsonb_array_elements(
         CASE
           WHEN h.result_json IS NULL THEN '[]'::jsonb
           WHEN jsonb_typeof(h.result_json::jsonb -> 'players') = 'array'
             THEN h.result_json::jsonb -> 'players'
           ELSE '[]'::jsonb
         END
       ) p
       WHERE COALESCE(p->>'userId', '') <> ''
       GROUP BY 1`,
    );
    const counts = new Map<string, number>();
    for (const row of res.rows as { user_id: string; n: number }[]) {
      counts.set(row.user_id, Number(row.n));
    }
    return counts;
  }
}

export async function createHistoryStore(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  pool?: any | null,
): Promise<HandHistoryStore> {
  if (pool) {
    return new PostgresHistoryStore(pool);
  }
  return new FileHistoryStore(process.env.DATA_DIR ?? path.join(process.cwd(), 'data'));
}

/** Optional schema note for ops (entities now managed by TypeORM). */
export async function writeSchemaDoc(dir: string): Promise<void> {
  await mkdir(dir, { recursive: true });
  await writeFile(
    path.join(dir, 'schema.note'),
    'Schema is managed by TypeORM entities in @poker/db\n',
    'utf8',
  );
}
