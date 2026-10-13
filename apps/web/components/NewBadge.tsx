import { cn } from '@/lib/cn';

/**
 * Small "New" marker for features players haven't opened yet.
 * dark = sidebar/purple chrome; light = paper panels and profile tabs.
 */
export function NewBadge({
  variant = 'pill',
  tone = 'dark',
  className,
}: {
  variant?: 'pill' | 'dot';
  tone?: 'dark' | 'light';
  className?: string;
}) {
  const toneClass = tone === 'light' ? 'bg-danger text-on-chrome' : 'bg-brass text-sidebar';
  if (variant === 'dot') {
    return (
      <span
        className={cn('block h-2.5 w-2.5 rounded-full ring-2 ring-sidebar', toneClass, className)}
        role="img"
        aria-label="New"
      />
    );
  }
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center rounded-full px-1.5 py-0.5 font-display text-[9px] font-bold uppercase leading-none tracking-[0.08em]',
        toneClass,
        className,
      )}
    >
      New
    </span>
  );
}
