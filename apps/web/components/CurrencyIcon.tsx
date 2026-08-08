'use client';

import { coerceMoney, formatMoneyAmount } from '@/lib/currency';

/**
 * In-app money unit mark (public/currency.svg). Sits after amounts like the old "chips" label.
 */
export function CurrencyIcon({
  size = 14,
  className = '',
  title,
}: {
  size?: number | 'em';
  className?: string;
  /** Accessible name when the icon is not decorative. */
  title?: string;
}) {
  const useEm = size === 'em';
  const px = useEm ? undefined : size;
  const height = useEm ? undefined : Math.round((size as number) * (1392 / 1674));

  return (
    // eslint-disable-next-line @next/next/no-img-element -- static public asset
    <img
      src="/currency.svg"
      alt={title ?? ''}
      width={useEm ? undefined : px}
      height={useEm ? undefined : height || px}
      className={`inline-block shrink-0 object-contain ${
        useEm ? 'h-[0.65em] w-auto' : ''
      } ${className}`.trim()}
      aria-hidden={title ? undefined : true}
      draggable={false}
    />
  );
}

/** Chip stack mark shown before bankroll amounts (public/chips-stack.png). */
export function ChipsImage({ className = '' }: { className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- static public asset
    <img
      src="/chips-stack.png"
      alt=""
      width={64}
      height={43}
      className={`h-8 w-auto shrink-0 object-contain sm:h-9 ${className}`.trim()}
      aria-hidden
      draggable={false}
    />
  );
}

/**
 * Amount layout: [chips image?] [prefix][number] [currency.svg]
 * Currency mark is sized like a small unit label (e.g. old “chips” word).
 */
export function MoneyAmount({
  amount,
  className = '',
  iconClassName = '',
  prefix = '',
  compact = false,
  showChips = false,
  chipsClassName = '',
}: {
  /** Accepts null/undefined from incomplete API payloads. */
  amount: number | null | undefined;
  className?: string;
  /** Classes on the trailing currency.svg (unit mark). */
  iconClassName?: string;
  /** e.g. "+" for prizes / wins */
  prefix?: string;
  /** Compact table-style numbers (10k, 1.2M) */
  compact?: boolean;
  /** Poker-chip sticker before the amount (profile / bankroll). */
  showChips?: boolean;
  chipsClassName?: string;
}) {
  const n = coerceMoney(amount);
  const text = compact ? formatMoneyAmount(n) : n.toLocaleString();

  return (
    <span
      className={`inline-flex items-center gap-2 tabular-nums ${className}`.trim()}
      title={n.toLocaleString()}
    >
      {showChips ? <ChipsImage className={chipsClassName} /> : null}
      <span className="inline-flex items-baseline gap-1.5 leading-none">
        <span>
          {prefix}
          {text}
        </span>
        <CurrencyIcon size="em" className={`translate-y-px opacity-90 ${iconClassName}`.trim()} />
      </span>
    </span>
  );
}
