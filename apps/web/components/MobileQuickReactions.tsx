'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { AppleEmoji } from '@/components/AppleEmoji';

/** Fast-tap reactions for the mobile table (also used as chat frequent row). */
export const QUICK_REACTIONS = [
  '🔥',
  '😂',
  '👏',
  '😮',
  '💀',
  '😎',
  '👀',
  '🤙',
  '🤠',
  '🃏',
  '👍',
  '👎',
  '❤️',
  '💯',
  '🎉',
  '😤',
  '😭',
  '💪',
  '🙏',
  '🏆',
] as const;

const MORE_REACTIONS = [
  '🙌',
  '🤝',
  '🤣',
  '😅',
  '😏',
  '😬',
  '😱',
  '😈',
  '👻',
  '💰',
  '💵',
  '💸',
  '♠️',
  '♥️',
  '♦️',
  '♣️',
  '🎲',
  '⚡',
  '💥',
  '✨',
  '🫡',
  '🫠',
  '🥴',
  '🤔',
  '☠️',
] as const;

/**
 * Quick reactions bar above the mobile action dock — no need to open chat.
 */
export function MobileQuickReactions({ onEmoji }: { onEmoji: (emoji: string) => void }) {
  const [moreOpen, setMoreOpen] = useState(false);
  const panelId = useId();
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!moreOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMoreOpen(false);
    };
    const onPointer = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setMoreOpen(false);
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('pointerdown', onPointer);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('pointerdown', onPointer);
    };
  }, [moreOpen]);

  const react = (emoji: string) => {
    onEmoji(emoji);
    setMoreOpen(false);
  };

  const moreList = [...new Set([...QUICK_REACTIONS, ...MORE_REACTIONS])];

  return (
    <div ref={rootRef} className="relative z-30 shrink-0 px-1.5 pb-1 pt-0.5">
      {moreOpen && (
        <div
          id={panelId}
          role="dialog"
          aria-label="More reactions"
          className="glass-sheet absolute bottom-[calc(100%+0.35rem)] left-1.5 right-1.5 z-40 max-h-[min(40dvh,14rem)] overflow-hidden rounded-xl border border-sidebar/15 shadow-[0_12px_36px_rgb(29_4_50/0.18)]"
        >
          <div className="hud-popup-header">
            <span className="font-kicker-sidebar">
              React
            </span>
            <button
              type="button"
              onClick={() => setMoreOpen(false)}
              className="rounded px-1.5 py-0.5 text-[10px] font-display font-semibold uppercase tracking-wider text-ink-strong-muted hover:text-sidebar"
            >
              Close
            </button>
          </div>
          <div className="grid max-h-[min(34dvh,12rem)] grid-cols-6 gap-0.5 overflow-y-auto overscroll-contain p-2 sm:grid-cols-8">
            {moreList.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => react(e)}
                className="flex h-11 items-center justify-center rounded-lg transition active:scale-90 hover:bg-sidebar/8"
                aria-label={`React ${e}`}
              >
                <AppleEmoji emoji={e} size={26} decorative />
              </button>
            ))}
          </div>
        </div>
      )}

      <div
        className={`glass-sheet flex items-center gap-1 rounded-full border py-1 pl-1.5 pr-1 shadow-[0_6px_20px_rgb(29_4_50/0.1)] backdrop-blur-md ${
          moreOpen ? 'border-sidebar/30 ring-1 ring-sidebar/10' : 'border-sidebar/15'
        }`}
      >
        <div className="flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto overscroll-x-contain [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {QUICK_REACTIONS.slice(0, 10).map((e) => (
            <button
              key={e}
              type="button"
              onClick={() => react(e)}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition active:scale-90 hover:bg-sidebar/8"
              aria-label={`React ${e}`}
            >
              <AppleEmoji emoji={e} size={22} decorative />
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setMoreOpen((v) => !v)}
          aria-expanded={moreOpen}
          aria-controls={panelId}
          className={`shrink-0 rounded-full px-2.5 py-1.5 text-[10px] font-display font-bold uppercase tracking-wider transition ${
            moreOpen
              ? 'bg-sidebar text-mushroom'
              : 'bg-sidebar/8 text-sidebar hover:bg-sidebar/12'
          }`}
        >
          {moreOpen ? 'Done' : 'More'}
        </button>
      </div>
    </div>
  );
}
