import type { WalletCurrency, WalletTrailEntry } from '@poker/protocol';

const REASON_LABELS: Record<string, string> = {
  opening_balance: 'Starting balance',
  free_refill: 'Free refill',
  buy_in: 'Table buy-in',
  top_up: 'Table top-up',
  cash_out: 'Contest refund',
  hand_win: 'Hand won',
  hand_loss: 'Hand lost',
  admin_credit: 'Bonus from staff',
  admin_reset: 'Balance reset',
  contest_prize: 'Contest prize',
  offline_win: 'Beat the bots',
};

function titleCase(reason: string): string {
  return reason
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((w) => w[0]!.toUpperCase() + w.slice(1))
    .join(' ');
}

export function walletReasonLabel(reason: string, currency: WalletCurrency): string {
  if (reason === 'signup_grant') {
    return currency === 'chips' ? 'Welcome chips' : 'Welcome Whuffies';
  }
  return REASON_LABELS[reason] ?? titleCase(reason);
}

/** Contest page for entries tied to a contest, else null. */
export function walletEntryHref(entry: Pick<WalletTrailEntry, 'reason' | 'refId'>): string | null {
  if (!entry.refId) return null;
  if (entry.reason === 'contest_prize' || entry.reason === 'cash_out') {
    return `/contest/${encodeURIComponent(entry.refId)}`;
  }
  return null;
}

export function parseWalletCurrency(raw: string | null | undefined): WalletCurrency {
  return raw === 'whuffies' ? 'whuffies' : 'chips';
}
