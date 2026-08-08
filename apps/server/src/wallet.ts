import { nanoid } from 'nanoid';
import type { AuthStore } from './auth.js';
import { isBotUserId } from './bot.js';

/** Wuffies granted on signup / when backfilling legacy accounts. */
export const STARTING_CHIP_GRANT = 10_000;
/** Claim free Wuffies when balance is strictly below this. */
export const REFILL_THRESHOLD = 1_000;
/** Amount added on a successful free refill claim. */
export const REFILL_GRANT = 5_000;

export type WalletReason =
  | 'signup_grant'
  | 'free_refill'
  | 'buy_in'
  | 'cash_out'
  | 'top_up';

export class WalletError extends Error {
  constructor(
    public readonly code: 'insufficient' | 'not_eligible' | 'unknown_user' | 'invalid_amount',
    message: string,
  ) {
    super(message);
    this.name = 'WalletError';
  }
}

export interface WalletMutationResult {
  ok: true;
  balance: number;
}

export interface WalletStore {
  getBalance(userId: string): number;
  /** Ensure legacy users without a balance get the starting grant (persisted once). */
  ensureStartingBalance(userId: string): Promise<number>;
  debit(
    userId: string,
    amount: number,
    reason: WalletReason,
    tableId?: string,
  ): Promise<WalletMutationResult>;
  credit(
    userId: string,
    amount: number,
    reason: WalletReason,
    tableId?: string,
  ): Promise<WalletMutationResult>;
  claimRefill(userId: string): Promise<WalletMutationResult>;
  /** Profile helper: whether the user may claim free Wuffies. */
  refillInfo(userId: string): {
    balance: number;
    eligible: boolean;
    threshold: number;
    grant: number;
  };
}

/** Mutable balance owner (AuthStore implements this). */
export interface WalletBalanceOwner {
  getChipBalance(userId: string): number | undefined;
  setChipBalance(userId: string, balance: number): Promise<void>;
  /** True when the user exists in the auth store. */
  hasUser(userId: string): boolean;
}

/**
 * Durable global chip wallet. Persists balances via AuthStore;
 * optional Postgres ledger for audit.
 */
export class AuthWalletStore implements WalletStore {
  private chain: Promise<void> = Promise.resolve();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private pool: any | null = null;

  constructor(private readonly owner: WalletBalanceOwner) {}

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  setPool(pool: any | null): void {
    this.pool = pool;
  }

  getBalance(userId: string): number {
    if (isBotUserId(userId)) return Number.MAX_SAFE_INTEGER;
    const bal = this.owner.getChipBalance(userId);
    if (bal === undefined) return 0;
    return bal;
  }

  async ensureStartingBalance(userId: string): Promise<number> {
    if (isBotUserId(userId)) return Number.MAX_SAFE_INTEGER;
    return this.serialized(async () => {
      if (!this.owner.hasUser(userId)) {
        throw new WalletError('unknown_user', 'Unknown user');
      }
      const current = this.owner.getChipBalance(userId);
      if (current !== undefined && current !== null && Number.isFinite(current)) {
        return Math.max(0, Math.floor(current));
      }
      await this.owner.setChipBalance(userId, STARTING_CHIP_GRANT);
      await this.appendLedger(userId, STARTING_CHIP_GRANT, 'signup_grant', '');
      return STARTING_CHIP_GRANT;
    });
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
    return this.serialized(async () => {
      if (!this.owner.hasUser(userId)) {
        throw new WalletError('unknown_user', 'Unknown user');
      }
      let bal = this.owner.getChipBalance(userId);
      if (bal === undefined || bal === null || !Number.isFinite(bal)) {
        bal = STARTING_CHIP_GRANT;
        await this.owner.setChipBalance(userId, bal);
        await this.appendLedger(userId, STARTING_CHIP_GRANT, 'signup_grant', '');
      }
      bal = Math.max(0, Math.floor(bal));
      if (bal < n) {
        throw new WalletError(
          'insufficient',
          `Need ${n} Wuffies (you have ${bal})`,
        );
      }
      const next = bal - n;
      await this.owner.setChipBalance(userId, next);
      await this.appendLedger(userId, -n, reason, tableId);
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
    return this.serialized(async () => {
      if (!this.owner.hasUser(userId)) {
        throw new WalletError('unknown_user', 'Unknown user');
      }
      let bal = this.owner.getChipBalance(userId);
      if (bal === undefined || bal === null || !Number.isFinite(bal)) {
        bal = STARTING_CHIP_GRANT;
      }
      bal = Math.max(0, Math.floor(bal));
      const next = bal + n;
      await this.owner.setChipBalance(userId, next);
      await this.appendLedger(userId, n, reason, tableId);
      return { ok: true as const, balance: next };
    });
  }

  async claimRefill(userId: string): Promise<WalletMutationResult> {
    if (isBotUserId(userId)) {
      throw new WalletError('not_eligible', 'Bots cannot claim Wuffies');
    }
    return this.serialized(async () => {
      if (!this.owner.hasUser(userId)) {
        throw new WalletError('unknown_user', 'Unknown user');
      }
      let bal = this.owner.getChipBalance(userId);
      if (bal === undefined || bal === null || !Number.isFinite(bal)) {
        bal = STARTING_CHIP_GRANT;
        await this.owner.setChipBalance(userId, bal);
        await this.appendLedger(userId, STARTING_CHIP_GRANT, 'signup_grant', '');
      }
      bal = Math.max(0, Math.floor(bal));
      if (bal >= REFILL_THRESHOLD) {
        throw new WalletError(
          'not_eligible',
          `Refill available when balance is below ${REFILL_THRESHOLD}`,
        );
      }
      const next = bal + REFILL_GRANT;
      await this.owner.setChipBalance(userId, next);
      await this.appendLedger(userId, REFILL_GRANT, 'free_refill', '');
      return { ok: true as const, balance: next };
    });
  }

  refillInfo(userId: string): {
    balance: number;
    eligible: boolean;
    threshold: number;
    grant: number;
  } {
    const balance = this.getBalance(userId);
    return {
      balance,
      eligible: !isBotUserId(userId) && balance < REFILL_THRESHOLD,
      threshold: REFILL_THRESHOLD,
      grant: REFILL_GRANT,
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
    userId: string,
    delta: number,
    reason: WalletReason,
    tableId: string,
  ): Promise<void> {
    if (!this.pool) return;
    try {
      await this.pool.query(
        `INSERT INTO chip_ledger (id, user_id, table_id, delta, reason, created_at)
         VALUES ($1, $2, $3, $4, $5, NOW())`,
        [nanoid(12), userId, tableId || '', delta, reason],
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
  async ensureStartingBalance(_userId: string): Promise<number> {
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
