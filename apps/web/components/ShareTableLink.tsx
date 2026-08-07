'use client';

import { useCallback, useEffect, useState } from 'react';
import { buildTableJoinLink, buildTableJoinShareText } from '@/lib/tableLink';

export function ShareTableLink({
  tableId,
  inviteCode,
  compact = false,
}: {
  tableId: string;
  inviteCode: string;
  compact?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const [canShare, setCanShare] = useState(false);

  useEffect(() => {
    setCanShare(typeof navigator !== 'undefined' && typeof navigator.share === 'function');
  }, []);

  const link = buildTableJoinLink(tableId, inviteCode);

  const copyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(link);
    } catch {
      const el = document.createElement('textarea');
      el.value = link;
      el.setAttribute('readonly', '');
      el.style.position = 'absolute';
      el.style.left = '-9999px';
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }, [link]);

  const copyCode = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(inviteCode);
    } catch {
      /* ignore */
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }, [inviteCode]);

  const share = useCallback(async () => {
    const text = buildTableJoinShareText(tableId, inviteCode);
    if (canShare) {
      try {
        await navigator.share({
          title: 'Join my poker table',
          text,
          url: link,
        });
        return;
      } catch {
        /* cancelled or failed — fall through to copy */
      }
    }
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      void copyLink();
    }
  }, [canShare, copyLink, inviteCode, link, tableId]);

  return (
    <div className="flex flex-wrap items-center gap-1 sm:gap-1.5">
      {compact ? (
        <button
          type="button"
          onClick={() => void (canShare ? share() : copyLink())}
          className="btn-ghost px-2 py-1 font-mono text-[10px]"
          title={link}
        >
          {copied ? 'Copied!' : inviteCode}
        </button>
      ) : (
        <>
          <span
            className="status-chip border-mushroom/25 bg-mushroom/10 font-mono text-[10px] text-mushroom"
            title="Invite code"
          >
            {inviteCode}
          </span>
          <button
            type="button"
            onClick={() => void copyLink()}
            className="btn-ghost text-xs py-1.5 px-2.5"
            title={link}
          >
            {copied ? 'Copied!' : 'Copy link'}
          </button>
          <button
            type="button"
            onClick={() => void copyCode()}
            className="btn-ghost text-xs py-1.5 px-2.5 hidden sm:inline-flex"
            title="Copy invite code only"
          >
            Copy code
          </button>
          {canShare && (
            <button type="button" onClick={() => void share()} className="btn-ghost text-xs py-1.5 px-2.5">
              Share
            </button>
          )}
        </>
      )}
    </div>
  );
}
