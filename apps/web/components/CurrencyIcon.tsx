'use client';

import { coerceMoney, formatMoneyAmount, formatMoneyLabel } from '@/lib/currency';

const CURRENCY_ASPECT = 1674 / 1392;

/**
 * Whuffies mark (public/currency.svg). Follows `currentColor` so it matches
 * surrounding text on light profile surfaces and the dark sidebar.
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
  const width = useEm ? undefined : size;
  const height = useEm ? undefined : Math.round((size as number) / CURRENCY_ASPECT);

  return (
    <span
      role={title ? 'img' : undefined}
      aria-label={title}
      title={title}
      aria-hidden={title ? undefined : true}
      className={`inline-block shrink-0 bg-current ${
        useEm ? 'h-[0.85em] w-[1.02em] translate-y-px' : ''
      } ${className}`.trim()}
      style={{
        width: useEm ? undefined : width,
        height: useEm ? undefined : height || width,
        WebkitMaskImage: 'url(/currency.svg)',
        maskImage: 'url(/currency.svg)',
        WebkitMaskSize: 'contain',
        maskSize: 'contain',
        WebkitMaskRepeat: 'no-repeat',
        maskRepeat: 'no-repeat',
        WebkitMaskPosition: 'center',
        maskPosition: 'center',
        maskMode: 'alpha',
      }}
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
 * Amount layout: [chips image?] [prefix][number] [currency.svg when Whuffies]
 */
export function MoneyAmount({
  amount,
  className = '',
  iconClassName = '',
  prefix = '',
  compact = false,
  showChips = false,
  chipsClassName = '',
  showWhuffies = false,
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
  showWhuffies?: boolean;
  chipsClassName?: string;
}) {
  const n = coerceMoney(amount);
  const text = compact ? formatMoneyAmount(n) : formatMoneyLabel(n);
  const label = showWhuffies ? `${formatMoneyLabel(n)} Whuffies` : formatMoneyLabel(n);

  return (
    <span
      className={`inline-flex items-center gap-1 tabular-nums ${className}`.trim()}
      title={label}
    >
      {showChips ? <ChipsImage className={chipsClassName} /> : null}
      <span className="inline-flex items-baseline gap-1.5 leading-none">
        <span>
          {prefix}
          {text}
        </span>
        {showWhuffies ? <CurrencyIcon size="em" className={iconClassName} /> : null}
      </span>
    </span>
  );
}
