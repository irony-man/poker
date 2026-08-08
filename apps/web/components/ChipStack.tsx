'use client';

import { formatMoneyAmount } from '@/lib/currency';

/** Classic casino colors — no purple clutter at table scale. */
const CHIP_STYLES = [
  { min: 1000, face: '#1a1a1a', rim: '#e0b43a', ink: '#ffe29a' },
  { min: 500, face: '#0b3d2e', rim: '#2aff9a', ink: '#d8ffe9' },
  { min: 100, face: '#0c1a33', rim: '#e8eef5', ink: '#ffffff' },
  { min: 25, face: '#14532d', rim: '#86efac', ink: '#ecfdf5' },
  { min: 10, face: '#1e3a8a', rim: '#93c5fd', ink: '#eff6ff' },
  { min: 5, face: '#991b1b', rim: '#fca5a5', ink: '#fef2f2' },
  { min: 1, face: '#e7e5e4', rim: '#78716c', ink: '#292524' },
] as const;

function styleForAmount(amount: number) {
  for (const s of CHIP_STYLES) {
    if (amount >= s.min) return s;
  }
  return CHIP_STYLES[CHIP_STYLES.length - 1]!;
}

/** @deprecated Prefer formatMoneyAmount — kept for table stack imports. */
export function formatChips(n: number): string {
  return formatMoneyAmount(n);
}

/** Single polished casino chip (SVG). */
export function ChipDisc({
  amount,
  size = 28,
  showValue = false,
}: {
  amount: number;
  size?: number;
  showValue?: boolean;
}) {
  const s = styleForAmount(amount);
  const id = `chip-${amount}-${size}-${s.face.replace('#', '')}`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      className="shrink-0 drop-shadow-[0_2px_4px_rgba(0,0,0,0.55)]"
      aria-hidden
    >
      <defs>
        <radialGradient id={`${id}-face`} cx="35%" cy="30%" r="70%">
          <stop offset="0%" stopColor={s.rim} stopOpacity="0.35" />
          <stop offset="45%" stopColor={s.face} />
          <stop offset="100%" stopColor="#000" stopOpacity="0.45" />
        </radialGradient>
        <linearGradient id={`${id}-shine`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#fff" stopOpacity="0.35" />
          <stop offset="40%" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* outer rim */}
      <circle cx="32" cy="32" r="30" fill={s.rim} />
      <circle cx="32" cy="32" r="26" fill={`url(#${id}-face)`} />
      {/* inner ring */}
      <circle cx="32" cy="32" r="22" fill="none" stroke={s.rim} strokeWidth="2.2" opacity="0.9" />
      {/* edge dashes */}
      {Array.from({ length: 12 }).map((_, i) => {
        const a = (i * 30 * Math.PI) / 180;
        const x1 = 32 + Math.cos(a) * 27.2;
        const y1 = 32 + Math.sin(a) * 27.2;
        const x2 = 32 + Math.cos(a) * 30;
        const y2 = 32 + Math.sin(a) * 30;
        return (
          <line
            key={i}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke={s.face}
            strokeWidth="3.2"
            strokeLinecap="round"
            opacity="0.85"
          />
        );
      })}
      <circle cx="32" cy="32" r="14" fill={s.face} stroke={s.rim} strokeWidth="1.5" />
      <ellipse cx="24" cy="22" rx="10" ry="6" fill={`url(#${id}-shine)`} />
      {showValue && (
        <text
          x="32"
          y="36"
          textAnchor="middle"
          fill={s.ink}
          fontSize="11"
          fontWeight="700"
          fontFamily="Oxanium, sans-serif"
        >
          {amount >= 1000 ? `${Math.round(amount / 1000)}k` : amount}
        </text>
      )}
    </svg>
  );
}

/** Short visual stack of identical discs for pot / bet emphasis. */
function StackVisual({ amount, size, count }: { amount: number; size: number; count: number }) {
  const n = Math.max(1, Math.min(count, 5));
  const step = Math.max(3, size * 0.14);
  return (
    <div className="relative" style={{ width: size, height: size + (n - 1) * step }}>
      {Array.from({ length: n }).map((_, i) => (
        <div
          key={i}
          className="absolute left-0"
          style={{ bottom: i * step, zIndex: n - i }}
        >
          <ChipDisc amount={amount} size={size} showValue={i === n - 1 && size >= 30} />
        </div>
      ))}
    </div>
  );
}

export function ChipStack({
  amount,
  size = 'md',
  label,
  compact,
}: {
  amount: number;
  size?: 'sm' | 'md' | 'lg';
  /** Show numeric label (default true). */
  label?: boolean;
  /** Force single-chip + text (used on seats). */
  compact?: boolean;
}) {
  if (amount <= 0) return null;

  const showLabel = label !== false;
  const isCompact = compact || size === 'sm';

  if (isCompact) {
    const disc = size === 'lg' ? 28 : size === 'md' ? 22 : 18;
    return (
      <div className="inline-flex items-center gap-1.5">
        <ChipDisc amount={amount} size={disc} />
        {showLabel && (
          <span
            className={`font-display font-bold tabular-nums tracking-wide ${
              size === 'sm' ? 'text-[12px]' : size === 'lg' ? 'text-base' : 'text-sm'
            }`}
          >
            {formatChips(amount)}
          </span>
        )}
      </div>
    );
  }

  const disc = size === 'lg' ? 36 : 26;
  const stackCount = amount >= 200 ? 4 : amount >= 50 ? 3 : amount >= 20 ? 2 : 1;

  return (
    <div className="inline-flex items-end gap-2.5">
      <StackVisual amount={amount} size={disc} count={stackCount} />
      {showLabel && (
        <span
          className={`pb-0.5 font-display font-bold tabular-nums tracking-wide ${
            size === 'lg' ? 'text-lg text-gold-light' : 'text-sm'
          }`}
        >
          {formatChips(amount)}
        </span>
      )}
    </div>
  );
}
