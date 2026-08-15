import { cn } from '@/lib/cn';

export type ChoiceStyle = 'chip' | 'segmented' | 'pill' | 'underline';

const option = {
  chip: {
    idle: 'choice-chip',
    selected: 'choice-chip choice-chip-selected',
  },
  segmented: {
    idle: 'relative flex min-h-10 flex-1 cursor-pointer items-center justify-center rounded-lg px-3 py-2 text-center font-display text-xs font-bold uppercase tracking-[0.14em] transition text-ink-strong-muted hover:bg-sidebar/[0.06] hover:text-sidebar disabled:opacity-50',
    selected:
      'relative flex min-h-10 flex-1 cursor-pointer items-center justify-center rounded-lg px-3 py-2 text-center font-display text-xs font-bold uppercase tracking-[0.14em] transition bg-sidebar text-mushroom shadow-[0_4px_14px_rgb(29_4_50/0.18)] disabled:opacity-50',
  },
  pill: {
    idle: 'rounded-full border border-sidebar/15 bg-mushroom/50 px-2.5 py-1 text-[11px] font-semibold text-sidebar transition hover:border-sidebar/30 hover:bg-sidebar/8 disabled:opacity-50',
    selected:
      'rounded-full border border-sidebar/40 bg-sidebar px-2.5 py-1 text-[11px] font-semibold text-mushroom transition disabled:opacity-50',
  },
  underline: {
    idle: 'relative inline-flex items-center gap-2 py-3.5 text-sm font-display font-bold tracking-wide transition text-ink-strong-muted hover:text-sidebar/80 disabled:opacity-50',
    selected:
      'relative inline-flex items-center gap-2 py-3.5 text-sm font-display font-bold tracking-wide transition text-sidebar disabled:opacity-50',
  },
} as const;

const track = {
  chip: 'flex flex-wrap gap-2',
  segmented: 'flex rounded-xl border border-sidebar/15 bg-mushroom/50 p-1',
  pill: 'flex flex-nowrap items-center gap-1.5',
  underline: 'flex flex-nowrap gap-6 overflow-x-auto border-t border-sidebar/10',
} as const;

export function choiceTrackClass(style: ChoiceStyle, className = ''): string {
  return cn(track[style], className);
}

export function choiceOptionClass(
  style: ChoiceStyle,
  selected: boolean,
  className = '',
): string {
  return cn(selected ? option[style].selected : option[style].idle, className);
}
