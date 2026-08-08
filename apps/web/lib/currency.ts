/** In-app money unit (play-money bankroll, buy-ins, stacks, pots). */
export const MONEY_TOKEN = 'Wuffies';

/** Compact amount for tables / pots (e.g. 10k, 1.2M). No currency symbol. */
export function formatMoneyAmount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M`;
  if (n >= 10_000) return `${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k`;
  return n.toLocaleString();
}

/** Full amount with token (e.g. "12,450 Wuffies"). */
export function formatMoneyLabel(n: number): string {
  return `${Math.max(0, Math.floor(n)).toLocaleString()} ${MONEY_TOKEN}`;
}
