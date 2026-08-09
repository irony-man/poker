import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

/**
 * Durable per-(user, table) chip balances used when a player is removed (kick)
 * and later rejoins the same table — including from another device.
 */
export interface TableChipStore {
  /** Save / overwrite reserved stack for rejoining this table. */
  reserve(tableId: string, userId: string, stack: number): Promise<void>;
  /**
   * Atomically consume a reserved stack (null if none).
   * Call only when seating succeeds path is expected; re-reserve on sit failure.
   */
  take(tableId: string, userId: string): Promise<number | null>;
}

type BalanceMap = Record<string, number>; // `${tableId}:${userId}` -> stack

function key(tableId: string, userId: string): string {
  return `${tableId}:${userId}`;
}

/** In-memory store (tests / no Postgres). */
export class MemoryTableChipStore implements TableChipStore {
  private balances = new Map<string, number>();

  async reserve(tableId: string, userId: string, stack: number): Promise<void> {
    const amount = Number.isFinite(stack) ? Math.max(0, Math.floor(stack)) : 0;
    this.balances.set(key(tableId, userId), amount);
  }

  async take(tableId: string, userId: string): Promise<number | null> {
    const k = key(tableId, userId);
    if (!this.balances.has(k)) return null;
    const stack = this.balances.get(k)!;
    this.balances.delete(k);
    if (!Number.isFinite(stack)) return null;
    return stack;
  }
}

/** File-backed balance for local runs without shared Postgres pool features. */
export class FileTableChipStore implements TableChipStore {
  private file: string;
  private loaded = false;
  private balances: BalanceMap = {};

  constructor(dir = path.join(process.cwd(), 'data')) {
    this.file = path.join(dir, 'table-chip-balances.json');
  }

  private async ensure(): Promise<void> {
    if (this.loaded) return;
    await mkdir(path.dirname(this.file), { recursive: true });
    try {
      const raw = await readFile(this.file, 'utf8');
      this.balances = JSON.parse(raw) as BalanceMap;
    } catch {
      this.balances = {};
    }
    this.loaded = true;
  }

  private async persist(): Promise<void> {
    await writeFile(this.file, JSON.stringify(this.balances), 'utf8');
  }

  async reserve(tableId: string, userId: string, stack: number): Promise<void> {
    await this.ensure();
    const amount = Number.isFinite(stack) ? Math.max(0, Math.floor(stack)) : 0;
    this.balances[key(tableId, userId)] = amount;
    await this.persist();
  }

  async take(tableId: string, userId: string): Promise<number | null> {
    await this.ensure();
    const k = key(tableId, userId);
    if (!(k in this.balances)) return null;
    const stack = this.balances[k]!;
    delete this.balances[k];
    await this.persist();
    if (!Number.isFinite(stack)) return null;
    return stack;
  }
}

/** Postgres-backed balances (production). */
export class PostgresTableChipStore implements TableChipStore {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private pool: any;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(pool: any) {
    this.pool = pool;
  }

  async reserve(tableId: string, userId: string, stack: number): Promise<void> {
    const amount = Number.isFinite(stack) ? Math.max(0, Math.floor(stack)) : 0;
    await this.pool.query(
      `INSERT INTO table_chip_balances (user_id, table_id, stack, updated_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (user_id, table_id)
       DO UPDATE SET stack = EXCLUDED.stack, updated_at = NOW()`,
      [userId, tableId, amount],
    );
  }

  async take(tableId: string, userId: string): Promise<number | null> {
    const res = await this.pool.query(
      `DELETE FROM table_chip_balances
       WHERE user_id = $1 AND table_id = $2
       RETURNING stack`,
      [userId, tableId],
    );
    const row = res.rows?.[0] as { stack?: unknown } | unknown[] | number | undefined;
    if (row == null) return null;
    const raw =
      typeof row === 'number'
        ? row
        : Array.isArray(row)
          ? row[0]
          : (row as { stack?: unknown }).stack;
    const n = Number(raw);
    if (!Number.isFinite(n)) return null;
    return Math.floor(n);
  }
}

export async function createTableChipStore(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  pool?: any | null,
  dataDir?: string,
): Promise<TableChipStore> {
  if (pool) return new PostgresTableChipStore(pool);
  if (dataDir) return new FileTableChipStore(dataDir);
  return new MemoryTableChipStore();
}
