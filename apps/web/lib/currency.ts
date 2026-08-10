/**
 * In-app play-money unit name (bankroll, buy-ins, stacks, pots).
 * Prefer `CurrencyIcon` / `MoneyAmount` in UI instead of rendering this string.
 * Contest ranking uses Whuffies (rating), not this token.
 */
export const MONEY_TOKEN = 'chips';

/** Public path for the money mark (use with CurrencyIcon). */
export const CURRENCY_ICON_SRC = '/currency.svg';

/** Coerce API/UI amounts that may be null/undefined into a non-negative integer. */
export function coerceMoney(n: unknown): number {
  if (typeof n === 'number' && Number.isFinite(n)) {
    return Math.max(0, Math.floor(n));
  }
  if (typeof n === 'string' && n.trim() !== '') {
    const v = Number(n);
    if (Number.isFinite(v)) return Math.max(0, Math.floor(v));
  }
  return 0;
}

/** Compact amount for tables / pots (e.g. 10k, 1.2M). No currency symbol. */
export function formatMoneyAmount(n: unknown): string {
  const v = coerceMoney(n);
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(v % 1_000_000 === 0 ? 0 : 1)}M`;
  if (v >= 10_000) return `${(v / 1000).toFixed(v % 1000 === 0 ? 0 : 1)}k`;
  return v.toLocaleString();
}

/** Full plain-text amount for titles / a11y (not for primary UI labels). */
export function formatMoneyLabel(n: unknown): string {
  return coerceMoney(n).toLocaleString();
}
