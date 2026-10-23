'use client';

import { useEffect, useState } from 'react';
import { analyzeHand, type HandAnalysis } from '@poker/engine';
import { MoneyAmount } from '@/components/CurrencyIcon';
import { PlayingCard } from '@/components/PlayingCard';
import { formatHandWhen } from '@/features/progress/playedHand';
import { formatMoneyAmount } from '@/lib/currency';
import { STREET_LABEL, type AnalysisHandRow } from './analysisHand';
import { EquityTimeline } from './EquityTimeline';

/** Runs after the hand is opened so a long table stays cheap until then. */
function useDeferredAnalysis(
  hand: AnalysisHandRow,
  userId: string,
  enabled: boolean,
): HandAnalysis | null {
  const [analysis, setAnalysis] = useState<HandAnalysis | null>(null);
  useEffect(() => {
    if (!enabled) return;
    setAnalysis(null);
    const id = window.setTimeout(() => {
      setAnalysis(analyzeHand(hand.result, userId, { seed: hand.row.id }));
    }, 0);
    return () => window.clearTimeout(id);
  }, [enabled, hand.result, hand.row.id, userId]);
  return analysis;
}

export function HandAnalysisCard({
  hand,
  handNumber,
  userId,
  review,
}: {
  hand: AnalysisHandRow;
  handNumber?: number;
  userId: string;
  /** This hand's note from the table coaching call. */
  review?: string | null;
}) {
  const { played } = hand;
  const [open, setOpen] = useState(false);
  const analysis = useDeferredAnalysis(hand, userId, open);
  const when = formatHandWhen(played.startedAt);
  const resultLabel = played.won
    ? 'You won'
    : played.winnerName
      ? `${played.winnerName} won`
      : 'Hand complete';
  const lastStreet =
    played.community.length >= 5
      ? STREET_LABEL.river
      : played.community.length === 4
        ? STREET_LABEL.turn
        : played.community.length === 3
          ? STREET_LABEL.flop
          : STREET_LABEL.preflop;

  const handName =
    played.handName && played.handName !== 'Uncontested' ? played.handName : null;

  return (
    <li className="overflow-hidden rounded-2xl border border-sidebar/12 bg-white shadow-[0_4px_16px_rgb(var(--ds-brand-ink)_/_0.04)]">
      <button
        type="button"
        className="flex w-full items-center gap-3 p-3 text-left transition-colors hover:bg-sidebar/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-sidebar/30 sm:gap-4 sm:p-4"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <div className="flex shrink-0 gap-0.5">
          <PlayingCard code={played.holeCards?.[0]} faceDown={!played.holeCards} size="xs" dealDelay={0} />
          <PlayingCard code={played.holeCards?.[1]} faceDown={!played.holeCards} size="xs" dealDelay={0} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-primary">
            {handNumber != null ? (
              <span className="mr-1.5 font-mono text-xs font-semibold text-muted">#{handNumber}</span>
            ) : null}
            <span className={played.won ? 'text-positive' : 'text-sidebar'}>{resultLabel}</span>
            {handName ? <span className="font-medium text-muted"> with {handName}</span> : null}
          </p>
          <p className="mt-0.5 truncate text-xs text-muted">
            {when || 'Unknown time'} · {lastStreet}
            <span className="text-sidebar/40"> · </span>
            {hand.vsBots ? 'Vs bots' : 'Showdown'}
          </p>
          {played.returnedToViewer > 0 ? (
            <p className="mt-0.5 text-xs leading-snug text-muted">
              {formatMoneyAmount(played.returnedToViewer)} of your bet was returned uncalled
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {played.won && played.viewerWinAmount ? (
            <MoneyAmount
              amount={played.viewerWinAmount}
              prefix="+"
              showChips
              compact
              className="text-xs font-semibold text-sidebar"
              chipsClassName="!h-4 !w-auto sm:!h-4"
            />
          ) : null}
          <svg
            viewBox="0 0 20 20"
            aria-hidden
            className={`h-4 w-4 shrink-0 text-muted transition-transform ${open ? 'rotate-180' : ''}`}
          >
            <path
              d="M5 7.5 10 12.5 15 7.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      </button>
      {open ? (
        <div className="border-t border-sidebar/10 bg-sidebar/[0.05] p-3 sm:p-4">
          {review ? (
            <p className="mb-4 border-l-2 border-sidebar/25 pl-3 text-sm leading-relaxed text-primary whitespace-pre-wrap">
              {review}
            </p>
          ) : null}
          {!analysis ? (
            <p className="text-sm text-muted">Working out the odds…</p>
          ) : analysis.streets.length === 0 ? (
            <p className="text-sm text-muted">Not enough detail was saved to analyse this hand.</p>
          ) : (
            <EquityTimeline analysis={analysis} />
          )}
        </div>
      ) : null}
    </li>
  );
}
