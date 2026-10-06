'use client';

import { useMemo } from 'react';
import type { WinLine } from '@/components/WinHandModal';
import { chipsFromOthers } from '@/lib/chipsFromOthers';
import { coerceMoney } from '@/lib/currency';
import type { PublicTable } from '@/lib/store';

export type WinBySeat = Map<number, { amount: number; handName?: string }>;

/** Aggregate winner pots and showdown metadata shared by online + offline table UIs. */
export function useHandPresentation(
  table: PublicTable | null | undefined,
  userId: string | null | undefined,
  dismissedWinHandId: string | null,
  /** Your hole cards from the private view (not public unless shown). */
  myHoleCards?: readonly string[] | null,
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
    // Display chips won from others (exclude the winner's own contribution).
    if (table) {
      for (const [seat, w] of map) {
        map.set(seat, {
          ...w,
          amount: chipsFromOthers(w.amount, table.players[seat]?.committed),
        });
      }
    }
    return map;
  }, [table]);

  /** Players still in at the end of the hand (folds omitted): winners first, then by net. */
  const winLines = useMemo((): WinLine[] => {
    if (!table) return [];
    const wonBySeat = new Map<number, { amount: number; handName?: string }>();
    for (const w of table.winners) {
      const prev = wonBySeat.get(w.seat);
      wonBySeat.set(w.seat, {
        amount: (prev?.amount ?? 0) + w.amount,
        handName: w.handName ?? prev?.handName,
      });
    }
    const stillIn = table.players.filter(
      (p) => wonBySeat.has(p.seat) || p.status === 'active' || p.status === 'allin',
    );
    const lines = stillIn.map((p): WinLine => {
      const won = wonBySeat.get(p.seat);
      const shown = table.showdownHands?.find((h) => h.seat === p.seat);
      const isSelf = !!userId && p.userId === userId;
      const committed = coerceMoney(p.committed);
      return {
        seat: p.seat,
        name: p.name ?? `Seat ${p.seat}`,
        amount: won ? (p.committed == null ? won.amount : won.amount - committed) : -committed,
        handName: shown?.handName ?? won?.handName,
        cards: shown?.cards,
        holeCards: p.holeCards ?? (isSelf && myHoleCards?.length ? [...myHoleCards] : null),
        isSelf,
        isWinner: !!won,
        userId: p.userId,
        avatarId: p.avatarId,
        avatarUrl: p.avatarUrl,
      };
    });
    return lines.sort((a, b) => Number(!!b.isWinner) - Number(!!a.isWinner) || b.amount - a.amount);
  }, [table, userId, myHoleCards]);

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
    winLines,
    handNameBySeat,
    winningCards,
    highlightMode,
    showWinModal,
    youWon,
  };
}
