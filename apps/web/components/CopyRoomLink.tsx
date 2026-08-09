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
      className={`play-chrome-control font-mono ${
        compact ? 'min-w-0 px-2 text-[11px]' : 'px-2.5 text-xs tracking-wide'
      }`}
    >
      <span className="font-display text-[9px] font-bold uppercase tracking-[0.16em] text-sidebar/55">
        {copied ? 'Copied' : 'Code'}
      </span>
      <span className="tabular-nums tracking-wider text-sidebar">{inviteCode}</span>
    </button>
  );
}
