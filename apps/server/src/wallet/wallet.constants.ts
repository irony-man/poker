/** Wuffies granted on signup / when backfilling legacy accounts (default). */
export const STARTING_CHIP_GRANT = 25_000;
/** Claim free Wuffies when balance is strictly below this (default). */
export const REFILL_THRESHOLD = 1_000;
/** Amount added on a successful free refill claim (default). */
export const REFILL_GRANT = 5_000;

export type EconomySnapshot = {
  startingChipGrant: number;
  refillThreshold: number;
  refillGrant: number;
};

export function defaultEconomy(): EconomySnapshot {
  return {
    startingChipGrant: STARTING_CHIP_GRANT,
    refillThreshold: REFILL_THRESHOLD,
    refillGrant: REFILL_GRANT,
  };
}

export type EconomyProvider = () => EconomySnapshot;

export type WalletReason =
  | 'signup_grant'
  | 'free_refill'
  | 'buy_in'
  | 'cash_out'
  | 'top_up'
  | 'contest_prize'
  | 'admin_credit';

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
  refillInfo(userId: string): {
    balance: number;
    eligible: boolean;
    threshold: number;
    grant: number;
  };
}

export interface WalletBalanceOwner {
  getChipBalance(userId: string): number | undefined;
  setChipBalance(userId: string, balance: number): Promise<void>;
  hasUser(userId: string): boolean;
}
