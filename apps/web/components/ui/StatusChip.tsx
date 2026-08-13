import type { HTMLAttributes, ReactNode } from 'react';

const tones = {
  neutral: 'border-sidebar/20 bg-sidebar/8 text-sidebar',
  muted: 'border-sidebar/15 bg-mushroom/70 text-ink-strong-muted',
  danger: 'border-danger/30 bg-danger/10 text-danger',
  positive: 'border-positive/30 bg-positive/10 text-positive',
  running: 'border-positive/30 bg-positive/10 text-positive',
  brass: 'border-brass/30 bg-brass/10 text-brass-dim',
  amber: 'border-amber-500/35 bg-amber-500/10 text-amber-800',
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
