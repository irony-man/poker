'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useCallback, useState } from 'react';
import { usePathname } from 'next/navigation';
import { authHref } from '@/lib/authRedirect';
import { LOBBY_NAV, isLobbyNavActive } from '@/lib/lobbyNav';
import { useSession } from '@/lib/store';

function CopyIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

export function LobbySidebar({
  open,
  onClose,
  signedIn,
  displayName,
  onLogout,
}: {
  open: boolean;
  onClose: () => void;
  signedIn: boolean;
  displayName: string | null;
  onLogout: () => void;
}) {
  const pathname = usePathname();
  const username = useSession((s) => s.username);
  const [copied, setCopied] = useState(false);

  const onCopyUsername = useCallback(async () => {
    const handle = (username ?? '').trim();
    if (!handle) return;
    try {
      await navigator.clipboard.writeText(handle);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      /* ignore */
    }
  }, [username]);

  const navLinks = (
    <nav className="flex flex-1 flex-col gap-1 px-3 py-4" aria-label="Lobby">
      {LOBBY_NAV.map((t) => {
        const active = isLobbyNavActive(pathname, t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            onClick={onClose}
            className={`rounded-md px-3 py-2.5 text-left text-sm font-display font-semibold uppercase tracking-[0.12em] transition ${
              active
                ? 'bg-mushroom/15 text-mushroom'
                : 'text-mushroom/55 hover:bg-mushroom/10 hover:text-mushroom/90'
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );

  const handle = (username ?? '').trim();

  const footer = (
    <div className="mt-auto border-t border-mushroom/10 px-4 py-4">
      {signedIn ? (
        <div className="space-y-2">
          <div className="min-w-0">
            <p className="text-[10px] font-display uppercase tracking-[0.16em] text-mushroom/45">
              Signed in
            </p>
            {handle ? (
              <div className="flex min-w-0 items-center gap-1">
                <p className="min-w-0 flex-1 truncate font-display font-semibold text-mushroom" title={handle}>
                  {handle || 'Player'}
                </p>
                <button
                  type="button"
                  onClick={() => void onCopyUsername()}
                  className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-mushroom/55 transition hover:bg-mushroom/10 hover:text-mushroom"
                  aria-label={copied ? 'Username copied' : 'Copy username'}
                  title={copied ? 'Copied' : 'Copy username'}
                >
                  {copied ? (
                    <CheckIcon className="h-3.5 w-3.5 text-positive" />
                  ) : (
                    <CopyIcon className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>
            ) : null}
          </div>
          <button
            type="button"
            onClick={() => {
              onLogout();
              onClose();
            }}
            className="w-full rounded-md border border-mushroom/20 px-3 py-2 text-xs font-display font-semibold uppercase tracking-wider text-mushroom/70 transition hover:border-mushroom/40 hover:text-mushroom"
          >
            Sign out
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <Link
            href={authHref('sign-in', pathname)}
            onClick={onClose}
            className="rounded-md border border-mushroom/25 bg-mushroom/10 px-3 py-2.5 text-center text-xs font-display font-bold uppercase tracking-wider text-mushroom transition hover:bg-mushroom/20"
          >
            Sign in
          </Link>
          <Link
            href={authHref('sign-up', pathname)}
            onClick={onClose}
            className="rounded-md px-3 py-2 text-center text-xs font-display font-semibold uppercase tracking-wider text-mushroom/60 transition hover:text-mushroom"
          >
            Create account
          </Link>
        </div>
      )}
    </div>
  );

  const logo = (
    <Link
      href="/"
      onClick={onClose}
      className="group block shrink-0 px-4 pt-5 pb-2 transition hover:opacity-90"
    >
      <Image
        src="/pokr-logo.png"
        alt="POKR"
        width={160}
        height={48}
        className="h-16 w-auto object-contain object-left mix-blend-screen sm:h-11"
        priority
      />
    </Link>
  );

  return (
    <>
      <aside className="lobby-sidebar hidden h-full min-h-0 md:flex md:w-60 md:shrink-0 md:flex-col">
        {logo}
        {navLinks}
        {footer}
      </aside>

      <div
        className={`fixed inset-0 z-50 md:hidden ${open ? 'pointer-events-auto' : 'pointer-events-none'}`}
        aria-hidden={!open}
      >
        <button
          type="button"
          className={`absolute inset-0 bg-sidebar/60 transition-opacity duration-base ${
            open ? 'opacity-100' : 'opacity-0'
          }`}
          aria-label="Close menu"
          onClick={onClose}
        />
        <aside
          className={`lobby-sidebar absolute inset-y-0 left-0 flex w-[min(18rem,86vw)] flex-col shadow-raised transition-transform duration-base ease-out ${
            open ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <div className="flex items-center justify-between pr-2">
            {logo}
            <button
              type="button"
              onClick={onClose}
              className="mr-2 rounded-md px-2 py-1.5 text-mushroom/60 hover:text-mushroom"
              aria-label="Close"
            >
              ✕
            </button>
          </div>
          {navLinks}
          {footer}
        </aside>
      </div>
    </>
  );
}
