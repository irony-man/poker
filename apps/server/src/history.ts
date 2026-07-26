import { mkdir, readFile, appendFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { nanoid } from 'nanoid';
import { POSTGRES_DDL, type HandHistoryRow } from '@poker/db';
import type { TableMeta } from './room.js';

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
}

/** Postgres-backed store when DATABASE_URL is set (uses pg via dynamic import). */
export class PostgresHistoryStore implements HandHistoryStore {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private pool: any;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(pool: any) {
    this.pool = pool;
  }

  static async create(databaseUrl: string): Promise<PostgresHistoryStore | null> {
    try {
      const mod = (await import('pg')) as unknown as {
        default?: { Pool?: new (o: { connectionString: string }) => { query: (s: string, p?: unknown[]) => Promise<{ rows: unknown[] }> } };
        Pool?: new (o: { connectionString: string }) => { query: (s: string, p?: unknown[]) => Promise<{ rows: unknown[] }> };
      };
      const PoolCtor = mod.Pool ?? mod.default?.Pool;
      if (!PoolCtor) throw new Error('pg.Pool not found');
      const pool = new PoolCtor({ connectionString: databaseUrl });
      await pool.query(POSTGRES_DDL);
      return new PostgresHistoryStore(pool);
    } catch (err) {
      console.warn('[history] Postgres unavailable:', err);
      return null;
    }
  }

  async recordTable(meta: TableMeta): Promise<void> {
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
        meta.config.minBuyIn,
        meta.config.maxBuyIn,
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
}

export async function createHistoryStore(): Promise<HandHistoryStore> {
  const url = process.env.DATABASE_URL;
  if (url) {
    const pg = await PostgresHistoryStore.create(url);
    if (pg) return pg;
  }
  return new FileHistoryStore(process.env.DATA_DIR ?? path.join(process.cwd(), 'data'));
}

/** Ensure DDL file is written for operators. */
export async function writeSchemaDoc(dir: string): Promise<void> {
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, 'schema.sql'), POSTGRES_DDL, 'utf8');
}
