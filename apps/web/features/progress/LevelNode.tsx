import type { NodeBadgeKind, NodeStatus } from './progress';

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
    <span className="inline-flex h-6 w-6 items-center justify-center text-base text-ink-strong">♠</span>
  );
}

function HeartBadge() {
  return (
    <span className="inline-flex h-6 w-6 items-center justify-center text-base text-card-red">♥</span>
  );
}

function NodeBadge({ kind, plus }: { kind: NodeBadgeKind; plus?: number }) {
  return (
    <div className="absolute -top-8 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1 rounded-lg border border-sidebar/12 bg-white px-2 py-1 shadow-[0_8px_20px_rgb(29_4_50_/_0.12)]">
      {kind === 'chip' ? <ChipBadge /> : null}
      {kind === 'spade' ? <SpadeBadge /> : null}
      {kind === 'heart' ? <HeartBadge /> : null}
      {kind === 'plus' ? (
        <>
          <ChipBadge />
          <span className="pr-0.5 text-xs font-extrabold tabular-nums text-sidebar">+{plus ?? 5}</span>
        </>
      ) : null}
    </div>
  );
}

export function LevelNode({
  status,
  badge,
  current,
  checked,
}: {
  status: NodeStatus;
  badge: NodeBadgeKind | null;
  current?: boolean;
  checked?: boolean;
}) {
  const showCheck = checked ?? (status === 'completed' || status === 'current');

  const top =
    status === 'locked' ? 'rgb(var(--mushroom))' : status === 'current' ? 'rgb(var(--sidebar))' : 'rgb(var(--sidebar) / 0.88)';
  const left = status === 'locked' ? 'rgb(var(--ink-strong-muted) / 0.35)' : 'rgb(var(--felt-deep))';
  const right = status === 'locked' ? 'rgb(var(--ink-strong-muted) / 0.28)' : 'rgb(var(--sidebar))';
  const highlight = status === 'current' ? 'rgb(var(--brass) / 0.45)' : 'rgb(var(--brass-light) / 0.25)';

  return (
    <div
      className={`relative h-[70px] w-[86px] ${current ? 'drop-shadow-[0_0_14px_rgb(var(--brass)/0.35)]' : ''}`}
    >
      {badge ? <NodeBadge kind={badge} plus={5} /> : null}
      <svg
        viewBox="0 0 86 70"
        className="h-full w-full drop-shadow-[0_6px_12px_rgb(29_4_50_/_0.14)]"
        aria-hidden
      >
        <polygon points="43,6 82,26 43,46 4,26" fill={top} />
        <polygon points="4,26 43,46 43,64 4,44" fill={left} />
        <polygon points="82,26 43,46 43,64 82,44" fill={right} />
        <polygon points="43,10 74,26 43,42 12,26" fill={highlight} />
        {status === 'locked' ? (
          <polygon points="43,6 82,26 43,46 4,26" fill="white" opacity="0.35" />
        ) : null}
      </svg>
      {showCheck ? (
        <div className="pointer-events-none absolute left-1/2 top-[10px] flex h-9 w-10 -translate-x-1/2 items-center justify-center text-white">
          <CheckIcon className="h-[42%] w-[42%]" />
        </div>
      ) : null}
      {current ? <span className="sr-only">Current hand level</span> : null}
    </div>
  );
}
