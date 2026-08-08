'use client';

import Image from 'next/image';

/**
 * Shared loading state: poker-chip-shuffle mark + optional label.
 * Use full for page shells; compact for cards, Suspense, and table boot.
 */
export function LoadingScreen({
  label = 'Loading…',
  compact = false,
  className = '',
}: {
  label?: string;
  compact?: boolean;
  className?: string;
}) {
  const size = compact ? 88 : 144;

  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className={[
        'flex flex-col items-center justify-center gap-3 text-center',
        compact ? 'py-6' : 'min-h-[12rem] w-full py-12 sm:min-h-[14rem] sm:py-16',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <span className="loading-chip-shuffle relative block" style={{ width: size, height: size }}>
        <Image
          src="/poker-chip-shuffle.svg"
          alt=""
          width={size}
          height={size}
          unoptimized
          priority
          className="h-full w-full object-contain drop-shadow-[0_8px_18px_rgb(29_4_50/0.14)]"
        />
      </span>
      {label ? (
        <p
          className={
            compact
              ? 'text-xs font-medium text-ink-strong-muted'
              : 'text-sm font-medium text-ink-strong-muted sm:text-base'
          }
        >
          {label}
        </p>
      ) : (
        <span className="sr-only">Loading</span>
      )}
    </div>
  );
}
