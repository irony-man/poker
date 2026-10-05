/** Balance history ("trail") for the global chip wallet and Whuffie rating. */
export type WalletCurrency = 'chips' | 'whuffies';

export const WALLET_CURRENCIES: readonly WalletCurrency[] = ['chips', 'whuffies'] as const;

export type WalletTrailReason =
  | 'opening_balance'
  | 'signup_grant'
  | 'free_refill'
  | 'buy_in'
  | 'cash_out'
  | 'top_up'
  | 'hand_win'
  | 'hand_loss'
  | 'contest_prize'
  | 'offline_win'
  | 'admin_credit'
  | 'admin_reset';

export interface WalletTrailEntry {
  id: string;
  currency: WalletCurrency;
  /** Signed change; negative for debits. */
  delta: number;
  /** Null for entries recorded before per-entry balances were stored. */
  balanceAfter: number | null;
  reason: WalletTrailReason | (string & {});
  /** Table or contest id the change relates to, or empty. */
  refId: string;
  /** Unix ms. */
  createdAt: number;
}

export interface WalletTrailPage {
  entries: WalletTrailEntry[];
  /** Pass as `before` to load older entries; null when there are none. */
  nextCursor: string | null;
}

export const WALLET_TRAIL_DEFAULT_LIMIT = 25;
export const WALLET_TRAIL_MAX_LIMIT = 100;
