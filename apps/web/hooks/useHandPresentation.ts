'use client';

import { useMemo } from 'react';
import type { PublicTable } from '@/lib/store';

export type WinBySeat = Map<number, { amount: number; handName?: string }>;

/** Aggregate winner pots and showdown metadata shared by online + offline table UIs. */
export function useHandPresentation(
  table: PublicTable | null | undefined,
  userId: string | null | undefined,
  dismissedWinHandId: string | null,
) {
  const winBySeat = useMemo(() => {
    const map: WinBySeat = new Map();
    for (const w of table?.winners ?? []) {
      const prev = map.get(w.seat);
      const handName =
        w.handName && w.handName !== 'Uncontested' ? w.handName : prev?.handName;
      map.set(w.seat, {
        amount: (prev?.amount ?? 0) + w.amount,
        handName,
      });
    }
    return map;
  }, [table?.winners]);

  const handNameBySeat = useMemo(() => {
    const map = new Map<number, string>();
    for (const h of table?.showdownHands ?? []) map.set(h.seat, h.handName);
    for (const [seat, w] of winBySeat) {
      if (w.handName && !map.has(seat)) map.set(seat, w.handName);
    }
    return map;
  }, [table?.showdownHands, winBySeat]);

  const winningCards = useMemo(() => {
    const codes = new Set<string>();
    if (!table || (table.street !== 'payout' && table.street !== 'showdown')) return codes;
    const winnerSeats = new Set(table.winners.map((w) => w.seat));
    for (const h of table.showdownHands ?? []) {
      if (!winnerSeats.has(h.seat)) continue;
      for (const c of h.cards ?? []) codes.add(c);
    }
    return codes;
  }, [table]);

  const highlightMode = winningCards.size > 0;
  const showWinModal =
    table?.street === 'payout' &&
    (table.winners?.length ?? 0) > 0 &&
    table.handId !== dismissedWinHandId;
  const youWon = !!table?.winners.some((w) => table.players[w.seat]?.userId === userId);

  return {
    winBySeat,
    handNameBySeat,
    winningCards,
    highlightMode,
    showWinModal,
    youWon,
  };
}
