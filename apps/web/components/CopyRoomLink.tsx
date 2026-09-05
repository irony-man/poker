'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { buildLudoJoinLink, buildLudoJoinShareText } from '@/lib/ludoLink';
import { buildTableJoinLink, buildTableJoinShareText } from '@/lib/tableLink';

/** Shows the room code; click copies the join link (+ code text). */
export function CopyRoomLink({
  tableId,
  inviteCode,
  compact = false,
  kind = 'table',
}: {
  tableId: string;
  inviteCode: string;
  compact?: boolean;
  kind?: 'table' | 'ludo';
}) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const copy = useCallback(async () => {
    const text =
      kind === 'ludo'
        ? buildLudoJoinShareText(tableId, inviteCode)
        : buildTableJoinShareText(tableId, inviteCode);
    const link =
      kind === 'ludo'
        ? buildLudoJoinLink(tableId, inviteCode)
        : buildTableJoinLink(tableId, inviteCode);
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
  }, [tableId, inviteCode, kind]);

  return (
    <Button
      type="button"
      variant="chrome"
      onClick={() => void copy()}
      title={copied ? 'Copied' : `Copy link · room code ${inviteCode}`}
      className={`font-mono ${
        compact ? 'min-w-0 px-2 text-[11px]' : 'px-2.5 text-xs tracking-wide'
      }`}
    >
      <span className="font-display text-[9px] font-bold uppercase tracking-[0.16em] text-sidebar/55">
        {copied ? 'Copied' : 'Code'}
      </span>
      <span className="tabular-nums tracking-wider text-sidebar">{inviteCode}</span>
    </Button>
  );
}
