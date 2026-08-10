/** Chips granted on signup / when backfilling legacy accounts (default). */
export const STARTING_CHIP_GRANT = 25_000;
/** Claim free chips when balance is strictly below this (default). */
export const REFILL_THRESHOLD = 1_000;
/** Amount added on a successful free refill claim (default). */
export const REFILL_GRANT = 5_000;
/** Whuffies (rating) granted on signup (default 0 — purely earned). */
export const STARTING_WHUFFIE_GRANT = 0;

export type EconomySnapshot = {
  startingChipGrant: number;
  refillThreshold: number;
  refillGrant: number;
  startingWhuffieGrant: number;
};

export function defaultEconomy(): EconomySnapshot {
  return {
    startingChipGrant: STARTING_CHIP_GRANT,
    refillThreshold: REFILL_THRESHOLD,
    refillGrant: REFILL_GRANT,
    startingWhuffieGrant: STARTING_WHUFFIE_GRANT,
  };
}

export type EconomyProvider = () => EconomySnapshot;

export type WalletReason =
  | 'signup_grant'
  | 'free_refill'
  | 'buy_in'
  | 'cash_out'
  | 'top_up'
  | 'admin_credit'
  | 'admin_reset';

/** Reasons for Whuffie (rating) mutations — not spent at tables. */
export type WhuffieReason = 'signup_grant' | 'contest_prize' | 'admin_credit' | 'admin_reset';

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
  getWhuffieBalance(userId: string): number;
  ensureStartingWhuffies(userId: string): Promise<number>;
  creditWhuffies(
    userId: string,
    amount: number,
    reason: WhuffieReason,
    tableId?: string,
  ): Promise<WalletMutationResult>;
  debitWhuffies(
    userId: string,
    amount: number,
    reason: WhuffieReason,
    tableId?: string,
  ): Promise<WalletMutationResult>;
}

export interface WalletBalanceOwner {
  getChipBalance(userId: string): number | undefined;
  setChipBalance(userId: string, balance: number): Promise<void>;
  getWhuffieBalance(userId: string): number | undefined;
  setWhuffieBalance(userId: string, balance: number): Promise<void>;
  hasUser(userId: string): boolean;
}
