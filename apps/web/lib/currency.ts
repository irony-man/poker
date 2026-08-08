/**
 * In-app money unit name (play-money bankroll, buy-ins, stacks, pots).
 * Prefer `CurrencyIcon` / `MoneyAmount` in UI instead of rendering this string.
 */
export const MONEY_TOKEN = 'Wuffies';

/** Public path for the money mark (use with CurrencyIcon). */
export const CURRENCY_ICON_SRC = '/currency.svg';

/** Compact amount for tables / pots (e.g. 10k, 1.2M). No currency symbol. */
export function formatMoneyAmount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M`;
  if (n >= 10_000) return `${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k`;
  return n.toLocaleString();
}

/** Full plain-text amount for titles / a11y (not for primary UI labels). */
export function formatMoneyLabel(n: number): string {
  return Math.max(0, Math.floor(n)).toLocaleString();
}
