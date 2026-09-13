'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { buildCourtpieceJoinLink, buildCourtpieceJoinShareText } from '@/lib/courtpieceLink';
import { buildLudoJoinLink, buildLudoJoinShareText } from '@/lib/ludoLink';
import { buildMemoryJoinLink, buildMemoryJoinShareText } from '@/lib/memoryLink';
import { buildSnakesJoinLink, buildSnakesJoinShareText } from '@/lib/snakesLink';
import { buildTableJoinLink, buildTableJoinShareText } from '@/lib/tableLink';

type RoomKind = 'table' | 'ludo' | 'snakes' | 'memory' | 'courtpiece';

function shareText(kind: RoomKind, id: string, inviteCode: string): string {
  switch (kind) {
    case 'ludo':
      return buildLudoJoinShareText(id, inviteCode);
    case 'snakes':
      return buildSnakesJoinShareText(id, inviteCode);
    case 'memory':
      return buildMemoryJoinShareText(id, inviteCode);
    case 'courtpiece':
      return buildCourtpieceJoinShareText(id, inviteCode);
    default:
      return buildTableJoinShareText(id, inviteCode);
  }
}

function shareLink(kind: RoomKind, id: string, inviteCode: string): string {
  switch (kind) {
    case 'ludo':
      return buildLudoJoinLink(id, inviteCode);
    case 'snakes':
      return buildSnakesJoinLink(id, inviteCode);
    case 'memory':
      return buildMemoryJoinLink(id, inviteCode);
    case 'courtpiece':
      return buildCourtpieceJoinLink(id, inviteCode);
    default:
      return buildTableJoinLink(id, inviteCode);
  }
}

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
  kind?: RoomKind;
}) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const copy = useCallback(async () => {
    const text = shareText(kind, tableId, inviteCode);
    const link = shareLink(kind, tableId, inviteCode);
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
      <span className="font-display text-[9px] font-bold uppercase tracking-[0.16em] text-current opacity-60">
        {copied ? 'Copied' : 'Code'}
      </span>
      <span className="tabular-nums tracking-wider text-current">{inviteCode}</span>
    </Button>
  );
}
