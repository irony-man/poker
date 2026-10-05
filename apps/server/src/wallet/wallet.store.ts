import { nanoid } from 'nanoid';
import {
  WALLET_TRAIL_DEFAULT_LIMIT,
  WALLET_TRAIL_MAX_LIMIT,
  type WalletCurrency,
  type WalletTrailEntry,
  type WalletTrailPage,
} from '@poker/protocol';
import { isBotUserId } from '../bot.js';
import type { Queryable } from '../database/queryable.js';
import {
  defaultEconomy,
  type EconomyProvider,
  type EconomySnapshot,
  REFILL_GRANT,
  REFILL_THRESHOLD,
  STARTING_CHIP_GRANT,
  WalletError,
  type WalletBalanceOwner,
  type WalletMutationResult,
  type WalletReason,
  type WalletStore,
  type WhuffieReason,
} from './wallet.constants.js';

export {
  WalletError,
  REFILL_GRANT,
  REFILL_THRESHOLD,
  STARTING_CHIP_GRANT,
  STARTING_WHUFFIE_GRANT,
  defaultEconomy,
  type EconomyProvider,
  type EconomySnapshot,
  type WalletBalanceOwner,
  type WalletMutationResult,
  type WalletReason,
  type WhuffieReason,
  type WalletStore,
} from './wallet.constants.js';

const LEDGER_TABLE: Record<WalletCurrency, string> = {
  chips: 'chip_ledger',
  whuffies: 'whuffie_ledger',
};

type LedgerRow = {
  id: string;
  table_id: string | null;
  delta: number | string;
  reason: string;
  balance_after: number | string | null;
  created_at: Date | string;
  cursor_ts: string;
};

export function encodeTrailCursor(ts: string, id: string): string {
  return Buffer.from(`${ts}|${id}`, 'utf8').toString('base64url');
}

/** Null when the cursor is malformed. */
export function decodeTrailCursor(cursor: string): { ts: string; id: string } | null {
  let raw: string;
  try {
    raw = Buffer.from(cursor, 'base64url').toString('utf8');
  } catch {
    return null;
  }
  const sep = raw.lastIndexOf('|');
  if (sep <= 0 || sep === raw.length - 1) return null;
  const ts = raw.slice(0, sep);
  const id = raw.slice(sep + 1);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,6})?Z$/.test(ts)) return null;
  return { ts, id };
}

function toNumberOrNull(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * Durable global chip wallet + Whuffie rating store.
 * Persists balances via AuthStore; optional Postgres ledgers (chips + Whuffies) back the
 * user-visible balance trail.
 */
export class AuthWalletStore implements WalletStore {
  private chain: Promise<void> = Promise.resolve();
  private pool: Queryable | null = null;
  private economyProvider: EconomyProvider = defaultEconomy;
  /** `${currency}:${userId}` already checked for an opening ledger entry this process. */
  private readonly openingChecked = new Set<string>();

  constructor(private readonly owner: WalletBalanceOwner) {}

  setPool(pool: Queryable | null): void {
    this.pool = pool;
  }

  setEconomyProvider(provider: EconomyProvider): void {
    this.economyProvider = provider;
  }

  private economy(): EconomySnapshot {
    return this.economyProvider();
  }

  getBalance(userId: string): number {
    if (isBotUserId(userId)) return Number.MAX_SAFE_INTEGER;
    const bal = this.owner.getChipBalance(userId);
    if (typeof bal !== 'number' || !Number.isFinite(bal)) return 0;
    return Math.max(0, Math.floor(bal));
  }

  getWhuffieBalance(userId: string): number {
    if (isBotUserId(userId)) return Number.MAX_SAFE_INTEGER;
    const bal = this.owner.getWhuffieBalance(userId);
    if (typeof bal !== 'number' || !Number.isFinite(bal)) return 0;
    return Math.max(0, Math.floor(bal));
  }

  async ensureStartingBalance(userId: string): Promise<number> {
    if (isBotUserId(userId)) return Number.MAX_SAFE_INTEGER;
    const balance = await this.serialized(async () => {
      if (!this.owner.hasUser(userId)) {
        throw new WalletError('unknown_user', 'Unknown user');
      }
      const current = this.owner.getChipBalance(userId);
      if (current !== undefined && current !== null && Number.isFinite(current)) {
        return Math.max(0, Math.floor(current));
      }
      const grant = this.economy().startingChipGrant;
      await this.owner.setChipBalance(userId, grant);
      await this.appendLedger('chips', userId, grant, 'signup_grant', '', grant);
      return grant;
    });
    await this.ensureOpeningEntry(userId, 'chips');
    return balance;
  }

  async ensureStartingWhuffies(userId: string): Promise<number> {
    if (isBotUserId(userId)) return Number.MAX_SAFE_INTEGER;
    const balance = await this.serialized(async () => {
      if (!this.owner.hasUser(userId)) {
        throw new WalletError('unknown_user', 'Unknown user');
      }
      const current = this.owner.getWhuffieBalance(userId);
      if (current !== undefined && current !== null && Number.isFinite(current)) {
        return Math.max(0, Math.floor(current));
      }
      const grant = this.economy().startingWhuffieGrant;
      await this.owner.setWhuffieBalance(userId, grant);
      if (grant > 0) {
        await this.appendLedger('whuffies', userId, grant, 'signup_grant', '', grant);
      }
      return grant;
    });
    await this.ensureOpeningEntry(userId, 'whuffies');
    return balance;
  }

  /**
   * Accounts get their starting balance from the auth store (no ledger row), and older
   * accounts predate the ledger. Anchor the trail with the current balance the first time
   * we see a user with no entries for this currency.
   */
  async ensureOpeningEntry(userId: string, currency: WalletCurrency): Promise<void> {
    const pool = this.pool;
    if (!pool || isBotUserId(userId)) return;
    const key = `${currency}:${userId}`;
    if (this.openingChecked.has(key)) return;
    await this.serialized(async () => {
      if (this.openingChecked.has(key) || !this.owner.hasUser(userId)) return;
      try {
        const res = await pool.query(
          `SELECT 1 FROM ${LEDGER_TABLE[currency]} WHERE user_id = $1 LIMIT 1`,
          [userId],
        );
        if (res.rows.length === 0) {
          const balance =
            currency === 'chips' ? this.getBalance(userId) : this.getWhuffieBalance(userId);
          if (balance > 0) {
            await this.appendLedger(currency, userId, balance, 'opening_balance', '', balance);
          }
        }
        this.openingChecked.add(key);
      } catch (err) {
        console.error('[wallet] opening ledger check failed', err);
      }
    });
  }

  /** Newest-first page of balance changes for one currency. */
  async listTrail(
    userId: string,
    currency: WalletCurrency,
    opts: { before?: string | null; limit?: number } = {},
  ): Promise<WalletTrailPage> {
    const pool = this.pool;
    if (!pool || isBotUserId(userId)) return { entries: [], nextCursor: null };
    const limit = Math.min(
      WALLET_TRAIL_MAX_LIMIT,
      Math.max(1, Math.floor(opts.limit ?? WALLET_TRAIL_DEFAULT_LIMIT)),
    );
    const params: unknown[] = [userId];
    let where = 'user_id = $1';
    if (opts.before) {
      const cursor = decodeTrailCursor(opts.before);
      if (!cursor) throw new WalletError('invalid_cursor', 'Invalid cursor');
      params.push(cursor.ts, cursor.id);
      where += ' AND (created_at, id) < ($2::timestamptz, $3)';
    }
    params.push(limit + 1);
    const res = await pool.query(
      `SELECT id, table_id, delta, reason, balance_after, created_at,
              to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS cursor_ts
       FROM ${LEDGER_TABLE[currency]}
       WHERE ${where}
       ORDER BY created_at DESC, id DESC
       LIMIT $${params.length}`,
      params,
    );
    const rows = res.rows as LedgerRow[];
    const page = rows.slice(0, limit);
    const entries: WalletTrailEntry[] = page.map((r) => ({
      id: r.id,
      currency,
      delta: Number(r.delta) || 0,
      balanceAfter: toNumberOrNull(r.balance_after),
      reason: r.reason,
      refId: r.table_id ?? '',
      createdAt: new Date(r.created_at).getTime(),
    }));
    const last = page[page.length - 1];
    return {
      entries,
      nextCursor: rows.length > limit && last ? encodeTrailCursor(last.cursor_ts, last.id) : null,
    };
  }

  async debit(
    userId: string,
    amount: number,
    reason: WalletReason,
    tableId = '',
  ): Promise<WalletMutationResult> {
    if (isBotUserId(userId)) {
      return { ok: true, balance: Number.MAX_SAFE_INTEGER };
    }
    const n = Math.floor(amount);
    if (!Number.isFinite(n) || n <= 0) {
      throw new WalletError('invalid_amount', 'Invalid debit amount');
    }
    await this.ensureOpeningEntry(userId, 'chips');
    return this.serialized(async () => {
      if (!this.owner.hasUser(userId)) {
        throw new WalletError('unknown_user', 'Unknown user');
      }
      let bal = this.owner.getChipBalance(userId);
      if (bal === undefined || bal === null || !Number.isFinite(bal)) {
        bal = this.economy().startingChipGrant;
        await this.owner.setChipBalance(userId, bal);
        await this.appendLedger('chips', userId, bal, 'signup_grant', '', bal);
      }
      bal = Math.max(0, Math.floor(bal));
      if (bal < n) {
        throw new WalletError('insufficient', `Need ${n} chips (you have ${bal})`);
      }
      const next = bal - n;
      await this.owner.setChipBalance(userId, next);
      await this.appendLedger('chips', userId, -n, reason, tableId, next);
      return { ok: true as const, balance: next };
    });
  }

  async credit(
    userId: string,
    amount: number,
    reason: WalletReason,
    tableId = '',
  ): Promise<WalletMutationResult> {
    if (isBotUserId(userId)) {
      return { ok: true, balance: Number.MAX_SAFE_INTEGER };
    }
    const n = Math.floor(amount);
    if (!Number.isFinite(n) || n < 0) {
      throw new WalletError('invalid_amount', 'Invalid credit amount');
    }
    if (n === 0) {
      return { ok: true, balance: this.getBalance(userId) };
    }
    await this.ensureOpeningEntry(userId, 'chips');
    return this.serialized(async () => {
      if (!this.owner.hasUser(userId)) {
        throw new WalletError('unknown_user', 'Unknown user');
      }
      let bal = this.owner.getChipBalance(userId);
      if (bal === undefined || bal === null || !Number.isFinite(bal)) {
        bal = this.economy().startingChipGrant;
      }
      bal = Math.max(0, Math.floor(bal));
      const next = bal + n;
      await this.owner.setChipBalance(userId, next);
      await this.appendLedger('chips', userId, n, reason, tableId, next);
      return { ok: true as const, balance: next };
    });
  }

  async creditWhuffies(
    userId: string,
    amount: number,
    reason: WhuffieReason,
    tableId = '',
  ): Promise<WalletMutationResult> {
    if (isBotUserId(userId)) {
      return { ok: true, balance: Number.MAX_SAFE_INTEGER };
    }
    const n = Math.floor(amount);
    if (!Number.isFinite(n) || n < 0) {
      throw new WalletError('invalid_amount', 'Invalid credit amount');
    }
    if (n === 0) {
      return { ok: true, balance: this.getWhuffieBalance(userId) };
    }
    await this.ensureOpeningEntry(userId, 'whuffies');
    return this.serialized(async () => {
      if (!this.owner.hasUser(userId)) {
        throw new WalletError('unknown_user', 'Unknown user');
      }
      let bal = this.owner.getWhuffieBalance(userId);
      if (bal === undefined || bal === null || !Number.isFinite(bal)) {
        bal = this.economy().startingWhuffieGrant;
      }
      bal = Math.max(0, Math.floor(bal));
      const next = bal + n;
      await this.owner.setWhuffieBalance(userId, next);
      await this.appendLedger('whuffies', userId, n, reason, tableId, next);
      return { ok: true as const, balance: next };
    });
  }

  async debitWhuffies(
    userId: string,
    amount: number,
    reason: WhuffieReason,
    tableId = '',
  ): Promise<WalletMutationResult> {
    if (isBotUserId(userId)) {
      return { ok: true, balance: Number.MAX_SAFE_INTEGER };
    }
    const n = Math.floor(amount);
    if (!Number.isFinite(n) || n <= 0) {
      throw new WalletError('invalid_amount', 'Invalid debit amount');
    }
    await this.ensureOpeningEntry(userId, 'whuffies');
    return this.serialized(async () => {
      if (!this.owner.hasUser(userId)) {
        throw new WalletError('unknown_user', 'Unknown user');
      }
      let bal = this.owner.getWhuffieBalance(userId);
      if (bal === undefined || bal === null || !Number.isFinite(bal)) {
        bal = this.economy().startingWhuffieGrant;
        await this.owner.setWhuffieBalance(userId, bal);
        if (bal > 0) {
          await this.appendLedger('whuffies', userId, bal, 'signup_grant', '', bal);
        }
      }
      bal = Math.max(0, Math.floor(bal));
      if (bal < n) {
        throw new WalletError('insufficient', `Need ${n} Whuffies (you have ${bal})`);
      }
      const next = bal - n;
      await this.owner.setWhuffieBalance(userId, next);
      await this.appendLedger('whuffies', userId, -n, reason, tableId, next);
      return { ok: true as const, balance: next };
    });
  }

  async claimRefill(userId: string): Promise<WalletMutationResult> {
    if (isBotUserId(userId)) {
      throw new WalletError('not_eligible', 'Bots cannot claim chips');
    }
    await this.ensureOpeningEntry(userId, 'chips');
    return this.serialized(async () => {
      if (!this.owner.hasUser(userId)) {
        throw new WalletError('unknown_user', 'Unknown user');
      }
      const eco = this.economy();
      let bal = this.owner.getChipBalance(userId);
      if (bal === undefined || bal === null || !Number.isFinite(bal)) {
        bal = eco.startingChipGrant;
        await this.owner.setChipBalance(userId, bal);
        await this.appendLedger('chips', userId, bal, 'signup_grant', '', bal);
      }
      bal = Math.max(0, Math.floor(bal));
      if (bal >= eco.refillThreshold) {
        throw new WalletError(
          'not_eligible',
          `Refill available when balance is below ${eco.refillThreshold}`,
        );
      }
      const next = bal + eco.refillGrant;
      await this.owner.setChipBalance(userId, next);
      await this.appendLedger('chips', userId, eco.refillGrant, 'free_refill', '', next);
      return { ok: true as const, balance: next };
    });
  }

  refillInfo(userId: string): {
    balance: number;
    eligible: boolean;
    threshold: number;
    grant: number;
  } {
    const eco = this.economy();
    const balance = this.getBalance(userId);
    return {
      balance,
      eligible: !isBotUserId(userId) && balance < eco.refillThreshold,
      threshold: eco.refillThreshold,
      grant: eco.refillGrant,
    };
  }

  private serialized<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.chain.then(fn, fn);
    this.chain = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  private async appendLedger(
    currency: WalletCurrency,
    userId: string,
    delta: number,
    reason: WalletReason | WhuffieReason,
    tableId: string,
    balanceAfter: number,
  ): Promise<void> {
    if (!this.pool) return;
    try {
      await this.pool.query(
        `INSERT INTO ${LEDGER_TABLE[currency]} (id, user_id, table_id, delta, reason, balance_after, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, clock_timestamp())`,
        [nanoid(12), userId, tableId || '', delta, reason, balanceAfter],
      );
    } catch (err) {
      console.error('[wallet] ledger write failed', err);
    }
  }
}

/** Unlimited wallet for unit tests that ignore bankroll. */
export class UnlimitedWalletStore implements WalletStore {
  getBalance(_userId: string): number {
    return Number.MAX_SAFE_INTEGER;
  }
  getWhuffieBalance(_userId: string): number {
    return Number.MAX_SAFE_INTEGER;
  }
  async ensureStartingBalance(_userId: string): Promise<number> {
    return Number.MAX_SAFE_INTEGER;
  }
  async ensureStartingWhuffies(_userId: string): Promise<number> {
    return Number.MAX_SAFE_INTEGER;
  }
  async debit(
    _userId: string,
    _amount: number,
    _reason: WalletReason,
    _tableId?: string,
  ): Promise<WalletMutationResult> {
    return { ok: true, balance: Number.MAX_SAFE_INTEGER };
  }
  async credit(
    _userId: string,
    _amount: number,
    _reason: WalletReason,
    _tableId?: string,
  ): Promise<WalletMutationResult> {
    return { ok: true, balance: Number.MAX_SAFE_INTEGER };
  }
  async creditWhuffies(
    _userId: string,
    _amount: number,
    _reason: WhuffieReason,
    _tableId?: string,
  ): Promise<WalletMutationResult> {
    return { ok: true, balance: Number.MAX_SAFE_INTEGER };
  }
  async debitWhuffies(
    _userId: string,
    _amount: number,
    _reason: WhuffieReason,
    _tableId?: string,
  ): Promise<WalletMutationResult> {
    return { ok: true, balance: Number.MAX_SAFE_INTEGER };
  }
  async claimRefill(_userId: string): Promise<WalletMutationResult> {
    return { ok: true, balance: Number.MAX_SAFE_INTEGER };
  }
  refillInfo(_userId: string) {
    return {
      balance: Number.MAX_SAFE_INTEGER,
      eligible: false,
      threshold: REFILL_THRESHOLD,
      grant: REFILL_GRANT,
    };
  }
}
