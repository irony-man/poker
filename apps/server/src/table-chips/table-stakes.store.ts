import type { Queryable } from '../database/queryable.js';
import type { WalletStore } from '../wallet/wallet.constants.js';

export interface TableStake {
  tableId: string;
  userId: string;
  stack: number;
}

/**
 * Durable record of wallet chips sitting on hosted tables. Rooms live only in this process,
 * so any stake still recorded at boot belongs to a process that died without cashing out.
 * Assumes a single server process owns every live table.
 */
export interface TableStakeStore {
  /** Record the stack a player has on a table (0 or less clears it). */
  hold(tableId: string, userId: string, stack: number): Promise<void>;
  /** Remove a player's stake, returning what was recorded (null if none). */
  release(tableId: string, userId: string): Promise<number | null>;
  /** Remove and return every recorded stake. */
  takeAll(): Promise<TableStake[]>;
}

function key(tableId: string, userId: string): string {
  return `${tableId}:${userId}`;
}

function toStack(stack: number): number {
  return Number.isFinite(stack) ? Math.max(0, Math.floor(stack)) : 0;
}

/** In-memory store (tests / no Postgres). */
export class MemoryTableStakeStore implements TableStakeStore {
  private stakes = new Map<string, TableStake>();

  async hold(tableId: string, userId: string, stack: number): Promise<void> {
    const amount = toStack(stack);
    if (amount <= 0) {
      this.stakes.delete(key(tableId, userId));
      return;
    }
    this.stakes.set(key(tableId, userId), { tableId, userId, stack: amount });
  }

  async release(tableId: string, userId: string): Promise<number | null> {
    const k = key(tableId, userId);
    const stake = this.stakes.get(k);
    this.stakes.delete(k);
    return stake ? stake.stack : null;
  }

  async takeAll(): Promise<TableStake[]> {
    const all = [...this.stakes.values()];
    this.stakes.clear();
    return all;
  }
}

/** Postgres-backed stakes (production). */
export class PostgresTableStakeStore implements TableStakeStore {
  constructor(private readonly pool: Queryable) {}

  async hold(tableId: string, userId: string, stack: number): Promise<void> {
    const amount = toStack(stack);
    if (amount <= 0) {
      await this.release(tableId, userId);
      return;
    }
    await this.pool.query(
      `INSERT INTO table_stakes (user_id, table_id, stack, updated_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (user_id, table_id)
       DO UPDATE SET stack = EXCLUDED.stack, updated_at = NOW()`,
      [userId, tableId, amount],
    );
  }

  async release(tableId: string, userId: string): Promise<number | null> {
    const res = await this.pool.query(
      `DELETE FROM table_stakes WHERE user_id = $1 AND table_id = $2 RETURNING stack`,
      [userId, tableId],
    );
    const row = res.rows[0] as { stack?: unknown } | undefined;
    if (!row) return null;
    const n = Number(row.stack);
    return Number.isFinite(n) ? Math.floor(n) : null;
  }

  async takeAll(): Promise<TableStake[]> {
    const res = await this.pool.query(
      `DELETE FROM table_stakes RETURNING user_id, table_id, stack`,
    );
    return (res.rows as Array<{ user_id: string; table_id: string; stack: unknown }>)
      .map((r) => ({ tableId: r.table_id, userId: r.user_id, stack: Number(r.stack) }))
      .filter((s) => Number.isFinite(s.stack) && s.stack > 0);
  }
}

/**
 * Boot-time refund of stakes left behind by a crashed process. A stake whose credit fails is
 * recorded again so the next boot retries it.
 */
export async function recoverTableStakes(
  stakes: TableStakeStore,
  wallet: WalletStore,
): Promise<{ refunded: number; chips: number; failed: number }> {
  const result = { refunded: 0, chips: 0, failed: 0 };
  for (const stake of await stakes.takeAll()) {
    try {
      await wallet.credit(stake.userId, stake.stack, 'table_cash_out', stake.tableId);
      result.refunded += 1;
      result.chips += stake.stack;
    } catch (err) {
      result.failed += 1;
      console.error('[wallet] table stake recovery failed', stake.tableId, stake.userId, err);
      try {
        await stakes.hold(stake.tableId, stake.userId, stake.stack);
      } catch (holdErr) {
        console.error('[wallet] could not restore table stake', stake.tableId, stake.userId, holdErr);
      }
    }
  }
  return result;
}
