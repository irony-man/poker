'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { PlayingCard } from './PlayingCard';

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
    body: 'Between hands: Ready starts the next deal. Sit out skips hands; sit in when you want the next hand. Mid-hand you can request “Sit out next hand” and still finish this one. Chat and voice sit in the toolbar. Broke stacks can Top up between hands from your bankroll.',
  },
];

/** Strongest → weakest. `dimmed` codes are kickers / non-scoring cards. */
const HAND_RANKINGS: {
  name: string;
  desc: string;
  cards: { code: string; dimmed?: boolean }[];
}[] = [
  {
    name: 'Royal flush',
    desc: 'A, K, Q, J, 10, all of the same suit',
    cards: [
      { code: 'As' },
      { code: 'Ks' },
      { code: 'Qs' },
      { code: 'Js' },
      { code: 'Ts' },
    ],
  },
  {
    name: 'Straight flush',
    desc: '5 cards of the same suit in sequence',
    cards: [
      { code: 'Th' },
      { code: '9h' },
      { code: '8h' },
      { code: '7h' },
      { code: '6h' },
    ],
  },
  {
    name: 'Four of a kind',
    desc: '4 cards of equal value',
    cards: [
      { code: 'Qh' },
      { code: 'Qs' },
      { code: 'Qd' },
      { code: 'Qc' },
      { code: '5d', dimmed: true },
    ],
  },
  {
    name: 'Full house',
    desc: 'Three of a kind with a pair',
    cards: [
      { code: 'Ad' },
      { code: 'As' },
      { code: 'Ah' },
      { code: '7c' },
      { code: '7d' },
    ],
  },
  {
    name: 'Flush',
    desc: 'Any 5 cards of the same suit',
    cards: [
      { code: 'Ad' },
      { code: 'Jd' },
      { code: '8d' },
      { code: '5d' },
      { code: '7d' },
    ],
  },
  {
    name: 'Straight',
    desc: '5 cards in a sequence',
    cards: [
      { code: 'Th' },
      { code: '9s' },
      { code: '8d' },
      { code: '7d' },
      { code: '6s' },
    ],
  },
  {
    name: 'Three of a kind',
    desc: '3 cards of the same value',
    cards: [
      { code: 'Qh' },
      { code: 'Qs' },
      { code: 'Qd' },
      { code: '7c', dimmed: true },
      { code: '6s', dimmed: true },
    ],
  },
  {
    name: 'Two pair',
    desc: '2 different pairs',
    cards: [
      { code: 'Jh' },
      { code: 'Jc' },
      { code: '9d' },
      { code: '9c' },
      { code: '2d', dimmed: true },
    ],
  },
  {
    name: 'One pair',
    desc: '2 cards of the same value',
    cards: [
      { code: 'Qs' },
      { code: 'Qh' },
      { code: '6d', dimmed: true },
      { code: '9c', dimmed: true },
      { code: '2d', dimmed: true },
    ],
  },
  {
    name: 'High card',
    desc: 'No pair — highest card plays',
    cards: [
      { code: 'Ah' },
      { code: 'Qs', dimmed: true },
      { code: '6s', dimmed: true },
      { code: '5d', dimmed: true },
      { code: 'Ts', dimmed: true },
    ],
  },
];

function RankingExample({
  cards,
}: {
  cards: { code: string; dimmed?: boolean }[];
}) {
  return (
    <div className="flex w-full items-stretch gap-1.5 sm:gap-2" aria-hidden>
      {cards.map(({ code, dimmed }) => (
        <div
          key={`${code}-${dimmed ? 'd' : 'h'}`}
          className="flex min-w-0 flex-1 justify-center [&>div]:!h-[4.5rem] [&>div]:!w-full [&>div]:!max-w-none sm:[&>div]:!h-[5.25rem]"
        >
          <PlayingCard code={code} size="sm" dimmed={dimmed} />
        </div>
      ))}
    </div>
  );
}

/** Compact “How to play” help for table chrome (popover, not browser title tooltip). */
export function HowToPlayHelp({ className = '' }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<'basics' | 'rankings'>('rankings');
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
      <Button
        type="button"
        variant="chrome"
        size="icon"
        aria-expanded={open}
        aria-controls={panelId}
        aria-haspopup="dialog"
        onClick={() => setOpen((v) => !v)}
        title="How to play"
      >
        <span aria-hidden className="text-[13px] leading-none">
          ?
        </span>
      </Button>

      {open && (
        <div
          id={panelId}
          role="dialog"
          aria-label="How to play"
          className="absolute right-0 top-[calc(100%+0.4rem)] z-[60] flex max-h-[min(70dvh,32rem)] w-[min(calc(100vw-1rem),22rem)] flex-col overflow-hidden rounded-xl border border-sidebar/12 bg-white shadow-[0_12px_40px_rgba(29,4,50,0.12)] sm:w-[24rem]"
        >
          <div className="flex shrink-0 items-center justify-between gap-2 border-b border-sidebar/10 px-3 py-2.5 sm:px-4">
            <h3 className="font-display text-sm font-bold uppercase tracking-wider text-sidebar">
              How to play
            </h3>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded px-1.5 py-0.5 text-xs text-ink-strong-muted hover:text-sidebar"
              aria-label="Close help"
            >
              Close
            </button>
          </div>

          <div className="flex shrink-0 gap-1 border-b border-sidebar/10 px-3 py-2 sm:px-4">
            {(
              [
                ['rankings', 'Hand rankings'],
                ['basics', 'Basics'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className={`rounded px-2.5 py-1 text-[10px] font-display font-semibold uppercase tracking-wider transition ${
                  tab === id
                    ? 'bg-sidebar text-mushroom'
                    : 'text-ink-strong-muted hover:bg-sidebar/8 hover:text-sidebar'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            {tab === 'basics' ? (
              <div className="px-3 py-3 sm:px-4">
                <ul className="space-y-2.5">
                  {TIPS.map((tip) => (
                    <li key={tip.title}>
                      <p className="text-[11px] font-display font-semibold uppercase tracking-wider text-sidebar/70">
                        {tip.title}
                      </p>
                      <p className="mt-0.5 text-xs leading-relaxed text-ink-strong-muted">
                        {tip.body}
                      </p>
                    </li>
                  ))}
                </ul>
                <p className="mt-3 border-t border-sidebar/10 pt-2 text-[10px] leading-snug text-ink-strong-muted">
                  Texas Hold&apos;em · highest hand wins · use your two cards + five community
                  cards
                </p>
              </div>
            ) : (
              <>
                <p className="px-3 pb-2 pt-3 text-[11px] leading-relaxed text-ink-strong-muted sm:px-4">
                  Strongest at the top. Dimmed cards are kickers (not part of the core hand).
                </p>
                <ol className="divide-y divide-sidebar/10 border-y border-sidebar/10">
                  {HAND_RANKINGS.map((hand, i) => (
                    <li
                      key={hand.name}
                      className="w-full bg-mushroom/40 px-3 py-2.5 sm:px-4"
                    >
                      <div className="flex w-full items-start gap-2.5">
                        <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-sidebar text-[9px] font-display font-bold text-mushroom">
                          {i + 1}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-[11px] font-display font-bold uppercase tracking-wider text-sidebar">
                            {hand.name}
                          </p>
                          <p className="mt-0.5 text-[11px] leading-snug text-ink-strong-muted">
                            {hand.desc}
                          </p>
                          <div className="mt-2 w-full">
                            <RankingExample cards={hand.cards} />
                          </div>
                        </div>
                      </div>
                    </li>
                  ))}
                </ol>
                <p className="px-3 py-3 text-[10px] leading-snug text-ink-strong-muted sm:px-4">
                  Texas Hold&apos;em · best 5-card hand from 2 hole cards + board
                </p>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
