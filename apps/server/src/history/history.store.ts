import { mkdir, readFile, appendFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { nanoid } from 'nanoid';
import type { HandHistoryRow } from '@poker/db';
import type { TableMeta } from '../rooms/room.js';

export interface HandHistoryStore {
  recordTable(meta: TableMeta): Promise<void>;
  recordHand(input: {
    tableId: string;
    handId: string;
    startedAt: number;
    endedAt: number;
    result: unknown;
  }): Promise<void>;
  listHands(tableId: string, limit?: number): Promise<HandHistoryRow[]>;
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

/** File-backed history when DATABASE_URL is unset. */
export class FileHistoryStore implements HandHistoryStore {
  private dir: string;
  private hands: HandHistoryRow[] = [];
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
        .map((line) => {
          const o = JSON.parse(line) as HandHistoryRow;
          return {
            ...o,
            startedAt: new Date(o.startedAt),
            endedAt: o.endedAt ? new Date(o.endedAt) : null,
          };
        });
    } catch {
      this.hands = [];
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

  async recordHand(input: {
    tableId: string;
    handId: string;
    startedAt: number;
    endedAt: number;
    result: unknown;
  }): Promise<void> {
    await this.ensure();
    const row: HandHistoryRow = {
      id: nanoid(12),
      tableId: input.tableId,
      handId: input.handId,
      startedAt: new Date(input.startedAt),
      endedAt: new Date(input.endedAt),
      resultJson: JSON.stringify(input.result),
    };
    this.hands.push(row);
    await appendFile(path.join(this.dir, 'hands.jsonl'), JSON.stringify(row) + '\n', 'utf8');
  }

  async listHands(tableId: string, limit = 50): Promise<HandHistoryRow[]> {
    await this.ensure();
    return this.hands.filter((h) => h.tableId === tableId).slice(-limit).reverse();
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

  async recordHand(input: {
    tableId: string;
    handId: string;
    startedAt: number;
    endedAt: number;
    result: unknown;
  }): Promise<void> {
    await this.pool.query(
      `INSERT INTO hand_history (id, table_id, hand_id, started_at, ended_at, result_json)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [
        nanoid(12),
        input.tableId,
        input.handId,
        new Date(input.startedAt),
        new Date(input.endedAt),
        JSON.stringify(input.result),
      ],
    );
  }

  async listHands(tableId: string, limit = 50): Promise<HandHistoryRow[]> {
    const res = await this.pool.query(
      `SELECT id, table_id as "tableId", hand_id as "handId", started_at as "startedAt", ended_at as "endedAt", result_json as "resultJson"
       FROM hand_history WHERE table_id = $1 ORDER BY started_at DESC LIMIT $2`,
      [tableId, limit],
    );
    return res.rows;
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
