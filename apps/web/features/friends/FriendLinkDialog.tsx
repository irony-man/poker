'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/Button';
import { getFriendLink } from '@/lib/api';
import { useSession } from '@/lib/store';
import { toast } from '@/lib/toast';
import { InviteDialog } from './InviteDialog';
import {
  CheckIcon,
  CopyIcon,
  FacebookIcon,
  LinkIcon,
  ShareIcon,
  WhatsAppIcon,
  XBrandIcon,
} from './icons';

const SHARE_TEXT = 'Join me on Pokr! Add me as a friend:';
const COPIED_RESET_MS = 2000;

function openShareWindow(url: string) {
  window.open(url, '_blank', 'noopener,noreferrer,width=640,height=560');
}

function ShareButton({
  label,
  icon,
  onClick,
}: {
  label: string;
  icon: ReactNode;
  onClick: () => void;
}) {
  return (
    <Button
      variant="chrome"
      onClick={onClick}
      className="inline-flex min-h-11 w-full min-w-0 flex-row items-center justify-center gap-2 px-3"
    >
      {icon}
      <span className="truncate">{label}</span>
    </Button>
  );
}

export function FriendLinkDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const sessionToken = useSession((s) => s.sessionToken);
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [canNativeShare, setCanNativeShare] = useState(false);
  const [copied, setCopied] = useState(false);
  const copiedTimer = useRef<number | null>(null);

  useEffect(() => {
    setCanNativeShare(typeof navigator !== 'undefined' && typeof navigator.share === 'function');
    return () => {
      if (copiedTimer.current) window.clearTimeout(copiedTimer.current);
    };
  }, []);

  useEffect(() => {
    if (!open) setCopied(false);
  }, [open]);

  useEffect(() => {
    if (!open || url || !sessionToken) return;
    let cancelled = false;
    setError(null);
    getFriendLink({ sessionToken, silent: true })
      .then((data) => {
        if (!cancelled) setUrl(data.url);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load your link');
      });
    return () => {
      cancelled = true;
    };
  }, [open, url, sessionToken]);

  async function copy() {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      if (copiedTimer.current) window.clearTimeout(copiedTimer.current);
      copiedTimer.current = window.setTimeout(() => setCopied(false), COPIED_RESET_MS);
      toast.success('Link copied');
    } catch {
      toast.error('Could not copy. Select the link and copy it manually.');
    }
  }

  async function nativeShare() {
    if (!url) return;
    try {
      await navigator.share({ title: 'Pokr', text: SHARE_TEXT, url });
    } catch {
      /* user cancelled */
    }
  }

  const text = url ? `${SHARE_TEXT} ${url}` : '';

  return (
    <InviteDialog
      open={open}
      onClose={onClose}
      icon={<LinkIcon className="h-7 w-7" />}
      title="Friend Link"
      description="Send this link to anyone. When they open it and accept, you become friends."
    >
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2 rounded-xl border border-sidebar/15 bg-raised/60 py-1.5 pl-3 pr-1.5">
          <input
            readOnly
            value={url ?? (error ? '' : 'Loading…')}
            aria-label="Your friend link"
            className="min-w-0 flex-1 truncate bg-transparent text-sm text-primary outline-none"
            onFocus={(e) => e.currentTarget.select()}
          />
          <Button
            variant="ghost"
            size="icon"
            disabled={!url}
            onClick={() => void copy()}
            aria-label={copied ? 'Link copied' : 'Copy link'}
            title={copied ? 'Copied' : 'Copy link'}
          >
            {copied ? (
              <CheckIcon className="h-4 w-4 text-positive" />
            ) : (
              <CopyIcon className="h-4 w-4" />
            )}
          </Button>
        </div>
        {error ? (
          <p role="alert" className="text-xs font-semibold text-danger">
            {error}
          </p>
        ) : null}
        <div className="mt-5 grid grid-cols-2 gap-2 [&>*:last-child:nth-child(odd)]:col-span-2">
          <ShareButton
            label="WhatsApp"
            icon={<WhatsAppIcon className="text-[#25D366]" />}
            onClick={() => url && openShareWindow(`https://wa.me/?text=${encodeURIComponent(text)}`)}
          />
          <ShareButton
            label="Share"
            icon={<FacebookIcon className="text-[#1877F2]" />}
            onClick={() =>
              url &&
              openShareWindow(
                `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
              )
            }
          />
          <ShareButton
            label="Post"
            icon={<XBrandIcon className="text-primary" />}
            onClick={() =>
              url &&
              openShareWindow(
                `https://x.com/intent/post?text=${encodeURIComponent(SHARE_TEXT)}&url=${encodeURIComponent(url)}`,
              )
            }
          />
          {canNativeShare ? (
            <ShareButton
              label="More"
              icon={<ShareIcon className="h-5 w-5" />}
              onClick={() => void nativeShare()}
            />
          ) : null}
        </div>
      </div>
    </InviteDialog>
  );
}
