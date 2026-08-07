'use client';

import { useEffect, useId, useRef, useState } from 'react';

const TIPS: { title: string; body: string }[] = [
  {
    title: 'Goal',
    body: 'Make the best 5-card hand using your 2 hole cards and the community cards. Last non-folder or best showdown hand wins the pot.',
  },
  {
    title: 'Hands & streets',
    body: 'Each hand posts blinds, deals 2 cards, then runs preflop → flop (3 cards) → turn → river. Act when the timer and action buttons light up for your seat.',
  },
  {
    title: 'Actions',
    body: 'Fold gives up the hand. Check passes with no bet to call. Call matches the current bet. Bet / raise add money to the pot. All-in commits your stack.',
  },
  {
    title: 'Table tools',
    body: 'Host can Start hand between rounds. Sit out to skip hands. Chat and voice sit in the toolbar. Broke stacks can Top up between hands (cash games only).',
  },
];

/** Compact “How to play” help for table chrome (popover, not browser title tooltip). */
export function HowToPlayHelp({ className = '' }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    const onPointer = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('pointerdown', onPointer);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('pointerdown', onPointer);
    };
  }, [open]);

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        aria-haspopup="dialog"
        onClick={() => setOpen((v) => !v)}
        className="flex h-11 items-center gap-1.5 rounded-full border border-cream/20 bg-ink/80 px-2.5 text-xs font-display font-semibold uppercase tracking-wider text-cream/75 hover:border-gold/40 hover:text-gold sm:h-9 sm:px-3"
        title="How to play"
      >
        <span
          aria-hidden
          className="flex h-5 w-5 items-center justify-center rounded-full border border-cream/25 text-[11px] font-bold leading-none"
        >
          ?
        </span>
        <span className="hidden sm:inline">How to play</span>
      </button>

      {open && (
        <div
          id={panelId}
          role="dialog"
          aria-label="How to play"
          className="absolute right-0 top-[calc(100%+0.4rem)] z-[60] w-[min(calc(100vw-1.5rem),20rem)] rounded-xl border border-cream/15 bg-ink-panel/98 p-3 shadow-[0_12px_40px_rgba(0,0,0,0.55)] backdrop-blur-md sm:w-[22rem] sm:p-4"
        >
          <div className="mb-2.5 flex items-center justify-between gap-2">
            <h3 className="font-display text-sm font-bold uppercase tracking-wider text-gold">
              How to play
            </h3>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded px-1.5 py-0.5 text-xs text-cream/45 hover:text-cream/80"
              aria-label="Close help"
            >
              Close
            </button>
          </div>
          <ul className="space-y-2.5">
            {TIPS.map((tip) => (
              <li key={tip.title}>
                <p className="text-[11px] font-display font-semibold uppercase tracking-wider text-cyan/80">
                  {tip.title}
                </p>
                <p className="mt-0.5 text-xs leading-relaxed text-cream/70">{tip.body}</p>
              </li>
            ))}
          </ul>
          <p className="mt-3 border-t border-cream/10 pt-2 text-[10px] leading-snug text-cream/40">
            Texas Hold&apos;em · highest hand wins · use your two cards + five community cards
          </p>
        </div>
      )}
    </div>
  );
}
