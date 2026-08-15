'use client';

import { PlayingCard } from '@/components/PlayingCard';
import type { NodeBadgeKind, NodeStatus } from './progress';
import type { PlayedHandLevel } from './playedHand';

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path
        d="M5 12.5 10 17.5 19 7.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="3.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ChipBadge() {
  return (
    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border-2 border-brass/40 bg-sidebar text-[10px] font-extrabold text-brass-light">
      ♣
    </span>
  );
}

function SpadeBadge() {
  return (
    <span className="inline-flex h-6 w-6 items-center justify-center text-base text-mushroom">♠</span>
  );
}

function HeartBadge() {
  return (
    <span className="inline-flex h-6 w-6 items-center justify-center text-base text-card-red">♥</span>
  );
}

function NodeBadge({ kind, plus }: { kind: NodeBadgeKind; plus?: number }) {
  return (
    <div className="absolute -top-9 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1 rounded-lg border border-mushroom/20 bg-sidebar/90 px-2 py-1 shadow-[0_8px_20px_rgb(0_0_0_/_0.35)] backdrop-blur-sm">
      {kind === 'chip' ? <ChipBadge /> : null}
      {kind === 'spade' ? <SpadeBadge /> : null}
      {kind === 'heart' ? <HeartBadge /> : null}
      {kind === 'plus' ? (
        <>
          <ChipBadge />
          <span className="pr-0.5 text-xs font-extrabold tabular-nums text-mushroom">+{plus ?? 5}</span>
        </>
      ) : null}
    </div>
  );
}

function MiniHoleFan({
  cards,
  faceDown,
  dimmed,
}: {
  cards: [string, string] | null;
  faceDown?: boolean;
  dimmed?: boolean;
}) {
  const left = cards?.[0];
  const right = cards?.[1] ?? cards?.[0];
  return (
    <div className="relative h-[3.55rem] w-[3.6rem]">
      <div
        className="absolute bottom-0 left-1/2 origin-bottom"
        style={{ transform: 'translateX(-78%) rotate(-14deg)' }}
      >
        <PlayingCard
          code={left}
          faceDown={faceDown || !left}
          size="handSm"
          dealDelay={0}
          dimmed={dimmed}
        />
      </div>
      <div
        className="absolute bottom-0 left-1/2 z-[1] origin-bottom"
        style={{ transform: 'translateX(-22%) rotate(12deg)' }}
      >
        <PlayingCard
          code={right}
          faceDown={faceDown || !right}
          size="handSm"
          dealDelay={0}
          dimmed={dimmed}
        />
      </div>
    </div>
  );
}

export function LevelNode({
  status,
  badge,
  current,
  checked,
  hand,
  level,
}: {
  status: NodeStatus;
  badge: NodeBadgeKind | null;
  current?: boolean;
  checked?: boolean;
  hand?: PlayedHandLevel | null;
  level: number;
}) {
  const showCheck = checked ?? (status === 'completed' || (status === 'current' && !!hand));
  const locked = status === 'locked';
  const faceDown = locked || !hand?.holeCards;

  return (
    <div
      className={`relative flex h-[88px] w-[86px] flex-col items-center justify-end ${
        current ? 'drop-shadow-[0_0_18px_rgb(var(--brass)/0.55)]' : ''
      }`}
    >
      {badge ? <NodeBadge kind={badge} plus={5} /> : null}
      <div
        className={`relative flex h-[4.35rem] w-full items-end justify-center ${
          locked ? 'opacity-55 grayscale-[0.35]' : ''
        }`}
      >
        <MiniHoleFan cards={hand?.holeCards ?? null} faceDown={faceDown} dimmed={locked} />
        {showCheck && !locked ? (
          <div
            className={`pointer-events-none absolute -right-0.5 -top-1 z-[2] flex h-5 w-5 items-center justify-center rounded-full border border-white/30 shadow-sm ${
              hand?.won ? 'bg-brass text-sidebar' : 'bg-sidebar text-mushroom'
            }`}
          >
            <CheckIcon className="h-3 w-3" />
          </div>
        ) : null}
      </div>
      <span
        className={`mt-0.5 font-display text-[10px] font-extrabold tabular-nums tracking-wide ${
          locked ? 'text-mushroom/40' : 'text-mushroom/85'
        }`}
      >
        {level}
      </span>
      {current ? <span className="sr-only">Current hand level</span> : null}
    </div>
  );
}
