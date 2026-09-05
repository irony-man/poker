import type { HTMLAttributes, ReactNode } from 'react';

const tones = {
  neutral: 'border-sidebar/20 bg-sidebar/8 text-sidebar',
  muted: 'border-sidebar/15 bg-mushroom/70 text-ink-strong-muted',
  danger: 'border-danger/30 bg-danger/10 text-danger',
  positive: 'border-positive/30 bg-positive/10 text-positive',
  running: 'border-positive/30 bg-positive/10 text-positive',
  brass: 'border-brass/30 bg-brass/10 text-brass-dim',
  amber: 'border-amber-500/35 bg-amber-500/10 text-amber-800',
  /** Dark play HUD — light fill + dark ink for AA contrast. */
  play: 'border-white/35 bg-white/92 text-sidebar',
  playMuted: 'border-white/25 bg-white/80 text-sidebar/80',
  playPositive: 'border-emerald-300/50 bg-emerald-100 text-emerald-900',
  playBrass: 'border-brass/40 bg-[#FFF4D6] text-[#6B4E00]',
} as const;

export type StatusChipTone = keyof typeof tones;

export function StatusChip({
  tone = 'neutral',
  className = '',
  children,
  ...props
}: HTMLAttributes<HTMLSpanElement> & {
  tone?: StatusChipTone;
  children: ReactNode;
}) {
  return (
    <span className={`status-chip ${tones[tone]} ${className}`.trim()} {...props}>
      {children}
    </span>
  );
}
