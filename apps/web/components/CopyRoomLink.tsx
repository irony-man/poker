'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { buildTableJoinLink, buildTableJoinShareText } from '@/lib/tableLink';

/** Shows the room code; click copies the join link (+ code text). */
export function CopyRoomLink({
  tableId,
  inviteCode,
  compact = false,
}: {
  tableId: string;
  inviteCode: string;
  compact?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const copy = useCallback(async () => {
    const text = buildTableJoinShareText(tableId, inviteCode);
    const link = buildTableJoinLink(tableId, inviteCode);
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      try {
        await navigator.clipboard.writeText(link);
      } catch {
        const el = document.createElement('textarea');
        el.value = text;
        el.setAttribute('readonly', '');
        el.style.position = 'fixed';
        el.style.left = '-9999px';
        document.body.appendChild(el);
        el.select();
        try {
          document.execCommand('copy');
        } catch {
          /* ignore */
        }
        document.body.removeChild(el);
      }
    }
    setCopied(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 1800);
  }, [tableId, inviteCode]);

  return (
    <button
      type="button"
      onClick={() => void copy()}
      title={copied ? 'Copied' : `Copy link · room code ${inviteCode}`}
      className={`inline-flex items-center gap-1.5 rounded-full border border-sidebar/20 bg-white font-mono font-semibold text-sidebar shadow-[0_2px_8px_rgb(29_4_50/0.06)] transition hover:border-sidebar/40 hover:bg-sidebar/5 ${
        compact
          ? 'min-h-9 px-2.5 py-1 text-[10px] tracking-wider'
          : 'min-h-9 px-3 py-1.5 text-xs tracking-widest'
      }`}
    >
      <span className="font-display text-[9px] font-bold uppercase tracking-[0.14em] text-ink-strong-muted">
        {copied ? 'Copied' : 'Code'}
      </span>
      <span className="tabular-nums">{inviteCode}</span>
    </button>
  );
}
