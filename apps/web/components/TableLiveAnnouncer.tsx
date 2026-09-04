'use client';

import { useEffect, useRef, useState } from 'react';
import { speakCard } from '@/components/PlayingCard';
import { formatMoneyAmount } from '@/lib/currency';
import { useSession, type PublicTable } from '@/lib/store';

function streetLabel(street: string): string {
  if (!street) return '';
  return street.charAt(0).toUpperCase() + street.slice(1);
}

function summarizeTable(table: PublicTable, userId: string | null | undefined): string {
  if (table.street === 'waiting') return 'Waiting for players';
  const parts: string[] = [streetLabel(table.street)];
  if (table.community.length > 0) {
    parts.push(table.community.map(speakCard).join(', '));
  }
  parts.push(`Pot ${formatMoneyAmount(table.pot)}`);
  if (table.toAct != null) {
    const actor = table.players.find((p) => p.seat === table.toAct);
    if (actor?.userId && actor.userId === userId) parts.push('Your turn');
    else if (actor?.name) parts.push(`${actor.name} to act`);
  }
  return parts.filter(Boolean).join('. ');
}

/** Visually hidden live region for street, pot, turn, and last seat action. */
export function TableLiveAnnouncer({
  table: tableProp,
  userId: userIdProp,
}: {
  table?: PublicTable | null;
  userId?: string | null;
}) {
  const storeTable = useSession((s) => s.table);
  const storeUser = useSession((s) => s.userId);
  const burst = useSession((s) => s.actionBurst);
  const table = tableProp !== undefined ? tableProp : storeTable;
  const userId = userIdProp !== undefined ? userIdProp : storeUser;
  const [text, setText] = useState('');
  const lastKey = useRef('');

  useEffect(() => {
    if (!table) return;
    const summary = summarizeTable(table, userId);
    const action =
      burst && Date.now() - burst.at < 8_000
        ? table.players.find((p) => p.seat === burst.seat)?.name
          ? `${table.players.find((p) => p.seat === burst.seat)!.name} ${burst.label}`
          : burst.label
        : '';
    const next = [summary, action].filter(Boolean).join('. ');
    const key = `${table.handId}:${table.actionSeq}:${burst?.at ?? 0}:${next}`;
    if (key === lastKey.current) return;
    lastKey.current = key;
    setText(next);
  }, [table, userId, burst]);

  return (
    <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
      {text}
    </div>
  );
}
