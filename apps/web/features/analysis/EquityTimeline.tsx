'use client';

import type { AnalysisPlayer, HandAnalysis, StreetAction, StreetSnapshot } from '@poker/engine';
import { PlayingCard } from '@/components/PlayingCard';
import { cn } from '@/lib/cn';
import { formatMoneyAmount } from '@/lib/currency';
import { ACTION_LABEL, ACTION_LABEL_YOU, STREET_LABEL } from './analysisHand';

function formatPct(pct: number | null): string {
  if (pct === null) return '—';
  return `${pct >= 10 || pct === 0 ? Math.round(pct) : pct.toFixed(1)}%`;
}

function viewerOf(street: StreetSnapshot): AnalysisPlayer | undefined {
  return street.players.find((p) => p.isViewer);
}

function bestOpponentPct(street: StreetSnapshot): number | null {
  let best: number | null = null;
  for (const p of street.players) {
    if (p.isViewer || p.winPct === null) continue;
    if (best === null || p.winPct > best) best = p.winPct;
  }
  return best;
}

export type EquitySwing = { street: StreetSnapshot['street']; from: number; to: number };

/** Largest change in the viewer's win chance between consecutive streets. */
export function biggestSwing(analysis: HandAnalysis): EquitySwing | null {
  let best: EquitySwing | null = null;
  for (let i = 1; i < analysis.streets.length; i++) {
    const prev = viewerOf(analysis.streets[i - 1]!)?.winPct;
    const next = viewerOf(analysis.streets[i]!)?.winPct;
    if (prev == null || next == null) continue;
    if (!best || Math.abs(next - prev) > Math.abs(best.to - best.from)) {
      best = { street: analysis.streets[i]!.street, from: prev, to: next };
    }
  }
  return best && Math.abs(best.to - best.from) >= 5 ? best : null;
}

function EquityChart({ analysis }: { analysis: HandAnalysis }) {
  const streets = analysis.streets;
  const w = 640;
  const h = 150;
  const padX = 40;
  const padTop = 18;
  const padBottom = 24;
  const plotH = h - padTop - padBottom;
  const step = streets.length > 1 ? (w - padX * 2) / (streets.length - 1) : 0;
  const x = (i: number) => (streets.length > 1 ? padX + i * step : w / 2);
  const y = (pct: number) => padTop + plotH * (1 - pct / 100);

  const series = (pick: (s: StreetSnapshot) => number | null | undefined) => {
    const pts: { i: number; pct: number }[] = [];
    streets.forEach((s, i) => {
      const pct = pick(s);
      if (pct != null) pts.push({ i, pct });
    });
    return pts;
  };
  const hero = series((s) => viewerOf(s)?.winPct);
  const villain = series(bestOpponentPct);
  const path = (pts: { i: number; pct: number }[]) =>
    pts.map((p, k) => `${k === 0 ? 'M' : 'L'} ${x(p.i)} ${y(p.pct)}`).join(' ');

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className="h-auto max-h-48 w-full"
      role="img"
      aria-label="Your win chance on each street"
    >
      {[0, 50, 100].map((g) => (
        <g key={g}>
          <line
            x1={padX}
            x2={w - padX}
            y1={y(g)}
            y2={y(g)}
            stroke="rgb(var(--sidebar) / 0.12)"
            strokeDasharray={g === 50 ? '3 4' : undefined}
          />
          <text x={4} y={y(g) + 3} fontSize="9" fill="rgb(var(--sidebar) / 0.55)">
            {g}%
          </text>
        </g>
      ))}
      {villain.length > 1 ? (
        <path
          d={path(villain)}
          fill="none"
          stroke="rgb(var(--sidebar) / 0.35)"
          strokeWidth="2"
          strokeDasharray="4 4"
        />
      ) : null}
      {hero.length > 1 ? (
        <path d={path(hero)} fill="none" stroke="rgb(var(--sidebar))" strokeWidth="2.5" />
      ) : null}
      {hero.map((p) => (
        <g key={p.i}>
          <circle cx={x(p.i)} cy={y(p.pct)} r="4" fill="rgb(var(--sidebar))" />
          <text
            x={x(p.i)}
            y={y(p.pct) - 7}
            fontSize="10"
            fontWeight="700"
            textAnchor="middle"
            fill="rgb(var(--sidebar))"
          >
            {formatPct(p.pct)}
          </text>
        </g>
      ))}
      {streets.map((s, i) => (
        <text
          key={s.street}
          x={x(i)}
          y={h - 6}
          fontSize="10"
          textAnchor="middle"
          fill="rgb(var(--sidebar) / 0.7)"
        >
          {STREET_LABEL[s.street]}
        </text>
      ))}
    </svg>
  );
}

function PlayerLine({ player }: { player: AnalysisPlayer }) {
  const pct = player.winPct;
  return (
    <li
      className={cn(
        'flex items-center gap-2 rounded-lg bg-sidebar/[0.04] py-1 pl-1 pr-2.5',
        player.isViewer ? 'ring-1 ring-inset ring-sidebar/15' : '',
        player.folded ? 'opacity-50' : '',
      )}
    >
      <div className="flex shrink-0 gap-0.5">
        <PlayingCard code={player.holeCards?.[0]} faceDown={!player.holeCards} size="peek" dealDelay={0} />
        <PlayingCard code={player.holeCards?.[1]} faceDown={!player.holeCards} size="peek" dealDelay={0} />
      </div>
      <div className="min-w-0">
        <p className="flex items-baseline gap-1.5">
          <span
            className={cn(
              'truncate text-xs',
              player.isViewer ? 'font-bold text-sidebar' : 'font-semibold text-primary',
            )}
          >
            {player.isViewer ? 'You' : player.name}
          </span>
          <span className="font-mono text-xs font-bold tabular-nums text-sidebar">
            {player.folded ? 'Folded' : formatPct(pct)}
          </span>
        </p>
        {player.stack !== null ? (
          <p className="font-mono text-[10px] tabular-nums text-muted">{formatMoneyAmount(player.stack)}</p>
        ) : null}
        {player.foldsThisStreet ? (
          <p className="text-[10px] font-medium text-muted">Folds here</p>
        ) : !player.holeCards && !player.folded ? (
          <p className="text-[10px] text-muted">Cards not shown</p>
        ) : null}
      </div>
    </li>
  );
}

function actionText(action: StreetAction): string {
  const label = (action.isViewer ? ACTION_LABEL_YOU : ACTION_LABEL)[action.kind];
  switch (action.kind) {
    case 'fold':
    case 'check':
      return label;
    case 'raise':
      return `${label} ${formatMoneyAmount(action.streetTotal)}`;
    case 'allin':
      return action.streetTotal > action.amount
        ? `${label} ${formatMoneyAmount(action.amount)} (total ${formatMoneyAmount(action.streetTotal)})`
        : `${label} ${formatMoneyAmount(action.amount)}`;
    default:
      return `${label} ${formatMoneyAmount(action.amount)}`;
  }
}

function BettingLog({ street }: { street: StreetSnapshot }) {
  const potEnd = street.actions.length
    ? street.actions[street.actions.length - 1]!.potAfter
    : street.potStart;
  const showBalance = street.actions.some((a) => a.stackAfter !== null);
  const cols = showBalance
    ? 'grid-cols-[minmax(0,1fr)_4.75rem_4.25rem]'
    : 'grid-cols-[minmax(0,1fr)_4.25rem]';
  return (
    <div className="mt-3 border-t border-sidebar/10 pt-2">
      <div
        className={cn(
          'grid items-baseline gap-x-3 px-1 text-[10px] font-semibold uppercase tracking-wide text-muted',
          cols,
        )}
      >
        <span>Action</span>
        {showBalance ? <span className="text-right">Left</span> : null}
        <span className="text-right">Pot</span>
      </div>
      <ol className="mt-1">
        <li className={cn('grid items-baseline gap-x-3 px-1 py-1 text-xs text-muted', cols)}>
          <span>Pot coming in</span>
          {showBalance ? <span /> : null}
          <span className="text-right font-mono tabular-nums">{formatMoneyAmount(street.potStart)}</span>
        </li>
        {street.actions.length === 0 ? (
          <li className="px-1 py-1 text-xs text-muted">No betting on this street</li>
        ) : (
          street.actions.map((a, i) => (
            <li
              key={`${a.seat}-${i}`}
              className={cn(
                'grid items-baseline gap-x-3 rounded px-1 py-1 text-xs',
                cols,
                a.isViewer ? 'bg-sidebar/[0.06]' : '',
              )}
            >
              <span className="min-w-0">
                <span className={a.isViewer ? 'font-bold text-sidebar' : 'font-semibold text-primary'}>
                  {a.isViewer ? 'You' : a.name}
                </span>{' '}
                <span
                  className={cn(
                    a.kind === 'fold' ? 'text-muted' : 'text-primary',
                    (a.kind === 'raise' || a.kind === 'bet' || a.kind === 'allin') && 'font-semibold',
                  )}
                >
                  {actionText(a)}
                </span>
              </span>
              {showBalance ? (
                <span className="text-right font-mono text-[11px] font-semibold tabular-nums text-primary">
                  {a.stackAfter !== null ? formatMoneyAmount(a.stackAfter) : '—'}
                </span>
              ) : null}
              <span className="text-right font-mono text-[11px] tabular-nums text-muted">
                {formatMoneyAmount(a.potAfter)}
              </span>
            </li>
          ))
        )}
        <li className={cn('grid items-baseline gap-x-3 px-1 py-1 text-xs font-semibold text-sidebar', cols)}>
          <span>Pot after {STREET_LABEL[street.street].toLowerCase()}</span>
          {showBalance ? <span /> : null}
          <span className="text-right font-mono tabular-nums">{formatMoneyAmount(potEnd)}</span>
        </li>
      </ol>
    </div>
  );
}

function StreetColumn({ street }: { street: StreetSnapshot }) {
  const players = street.players
    .slice()
    .sort((a, b) => {
      if (a.isViewer !== b.isViewer) return a.isViewer ? -1 : 1;
      if (a.folded !== b.folded) return a.folded ? 1 : -1;
      return (b.winPct ?? -1) - (a.winPct ?? -1);
    });
  const you = viewerOf(street);
  return (
    <section className="rounded-xl bg-white p-3 ring-1 ring-inset ring-sidebar/12 sm:p-4">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <h4 className="text-xs font-display font-bold uppercase tracking-wide text-muted">
            {STREET_LABEL[street.street]}
          </h4>
          <div className="flex gap-0.5">
            {street.board.length > 0 ? (
              street.board.map((code) => <PlayingCard key={code} code={code} size="peek" dealDelay={0} />)
            ) : (
              <p className="text-xs text-muted">No board yet</p>
            )}
          </div>
        </div>
        <p className="font-display text-sm font-bold tabular-nums text-sidebar">
          You {you?.folded ? 'folded' : formatPct(you?.winPct ?? null)}
        </p>
      </div>
      <ul className="mt-3 flex flex-wrap gap-2">
        {players.map((p) => (
          <PlayerLine key={p.seat} player={p} />
        ))}
      </ul>
      <BettingLog street={street} />
    </section>
  );
}

export function EquityTimeline({ analysis }: { analysis: HandAnalysis }) {
  const swing = biggestSwing(analysis);
  return (
    <div className="space-y-3">
      <div className="rounded-xl bg-white p-3 ring-1 ring-inset ring-sidebar/12 sm:p-4">
        <div className="mb-1 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <p className="text-sm font-semibold text-sidebar">Win chance</p>
          <p className="flex items-center gap-3 text-[11px] text-muted">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-0.5 w-4 rounded-full bg-sidebar" />
              You
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-4 border-t border-dashed border-sidebar/50" />
              Best opponent
            </span>
          </p>
        </div>
        {swing ? (
          <p className={cn('text-xs font-semibold', swing.to >= swing.from ? 'text-positive' : 'text-danger')}>
            {STREET_LABEL[swing.street]} moved from {formatPct(swing.from)} to {formatPct(swing.to)}
          </p>
        ) : null}
        <EquityChart analysis={analysis} />
      </div>
      <div className="grid gap-2">
        {analysis.streets.map((s) => (
          <StreetColumn key={s.street} street={s} />
        ))}
      </div>
    </div>
  );
}
