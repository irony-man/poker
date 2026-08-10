import { nanoid } from 'nanoid';
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

/**
 * Durable global chip wallet + Whuffie rating store.
 * Persists balances via AuthStore; optional Postgres chip ledger for audit.
 */
export class AuthWalletStore implements WalletStore {
  private chain: Promise<void> = Promise.resolve();
  private pool: Queryable | null = null;
  private economyProvider: EconomyProvider = defaultEconomy;

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
    return this.serialized(async () => {
      if (!this.owner.hasUser(userId)) {
        throw new WalletError('unknown_user', 'Unknown user');
      }
      const current = this.owner.getChipBalance(userId);
      if (current !== undefined && current !== null && Number.isFinite(current)) {
        return Math.max(0, Math.floor(current));
      }
      const grant = this.economy().startingChipGrant;
      await this.owner.setChipBalance(userId, grant);
      await this.appendLedger(userId, grant, 'signup_grant', '');
      return grant;
    });
  }

  async ensureStartingWhuffies(userId: string): Promise<number> {
    if (isBotUserId(userId)) return Number.MAX_SAFE_INTEGER;
    return this.serialized(async () => {
      if (!this.owner.hasUser(userId)) {
        throw new WalletError('unknown_user', 'Unknown user');
      }
      const current = this.owner.getWhuffieBalance(userId);
      if (current !== undefined && current !== null && Number.isFinite(current)) {
        return Math.max(0, Math.floor(current));
      }
      const grant = this.economy().startingWhuffieGrant;
      await this.owner.setWhuffieBalance(userId, grant);
      return grant;
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
        bal = this.economy().startingChipGrant;
        await this.owner.setChipBalance(userId, bal);
        await this.appendLedger(userId, bal, 'signup_grant', '');
      }
      bal = Math.max(0, Math.floor(bal));
      if (bal < n) {
        throw new WalletError('insufficient', `Need ${n} chips (you have ${bal})`);
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
        bal = this.economy().startingChipGrant;
      }
      bal = Math.max(0, Math.floor(bal));
      const next = bal + n;
      await this.owner.setChipBalance(userId, next);
      await this.appendLedger(userId, n, reason, tableId);
      return { ok: true as const, balance: next };
    });
  }

  async creditWhuffies(
    userId: string,
    amount: number,
    _reason: WhuffieReason,
    _tableId = '',
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
      return { ok: true as const, balance: next };
    });
  }

  async debitWhuffies(
    userId: string,
    amount: number,
    _reason: WhuffieReason,
    _tableId = '',
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
      let bal = this.owner.getWhuffieBalance(userId);
      if (bal === undefined || bal === null || !Number.isFinite(bal)) {
        bal = this.economy().startingWhuffieGrant;
        await this.owner.setWhuffieBalance(userId, bal);
      }
      bal = Math.max(0, Math.floor(bal));
      if (bal < n) {
        throw new WalletError('insufficient', `Need ${n} Whuffies (you have ${bal})`);
      }
      const next = bal - n;
      await this.owner.setWhuffieBalance(userId, next);
      return { ok: true as const, balance: next };
    });
  }

  async claimRefill(userId: string): Promise<WalletMutationResult> {
    if (isBotUserId(userId)) {
      throw new WalletError('not_eligible', 'Bots cannot claim chips');
    }
    return this.serialized(async () => {
      if (!this.owner.hasUser(userId)) {
        throw new WalletError('unknown_user', 'Unknown user');
      }
      const eco = this.economy();
      let bal = this.owner.getChipBalance(userId);
      if (bal === undefined || bal === null || !Number.isFinite(bal)) {
        bal = eco.startingChipGrant;
        await this.owner.setChipBalance(userId, bal);
        await this.appendLedger(userId, eco.startingChipGrant, 'signup_grant', '');
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
      await this.appendLedger(userId, eco.refillGrant, 'free_refill', '');
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
