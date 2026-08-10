'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { authHref } from '@/lib/authRedirect';
import { loadSavedAvatarId } from '@/lib/avatars';
import { MoneyAmount } from '@/components/CurrencyIcon';
import { PlayerAvatar } from '@/components/PlayerAvatar';
import { PendingCountBadge, useOnlineFriends } from '@/components/OnlineFriends';
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

function ChevronIcon({ className }: { className?: string }) {
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
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

export function LobbySidebar({
  open,
  onClose,
  signedIn,
  displayName,
  onLogout,
  isAdmin = false,
}: {
  open: boolean;
  onClose: () => void;
  signedIn: boolean;
  displayName: string | null;
  onLogout: () => void;
  isAdmin?: boolean;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const userId = useSession((s) => s.userId);
  const username = useSession((s) => s.username);
  const chipBalance = useSession((s) => s.chipBalance);
  const { pendingCount } = useOnlineFriends();
  const [avatarId, setAvatarId] = useState(0);
  const [copied, setCopied] = useState(false);

  // Prefer saved avatar (updated on profile/sign-in); re-read when identity changes.
  useEffect(() => {
    if (!signedIn) return;
    setAvatarId(loadSavedAvatarId());
  }, [signedIn, userId, pathname, chipBalance]);

  const onCopyUsername = useCallback(async () => {
    const handle = (username ?? displayName ?? '').trim();
    if (!handle) return;
    try {
      await navigator.clipboard.writeText(handle);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      /* ignore */
    }
  }, [username, displayName]);

  const navLinks = (
    <nav className="flex flex-1 flex-col gap-1 px-3 py-4" aria-label="Lobby">
      {LOBBY_NAV.map((t) => {
        const active = isLobbyNavActive(pathname, t.href, searchParams.toString());
        const showBadge = signedIn && t.href === '/friends' && pendingCount > 0;
        return (
          <Link
            key={t.href}
            href={t.href}
            onClick={onClose}
            className={`flex items-center justify-between gap-2 rounded-md px-3 py-2.5 text-left text-sm font-display font-semibold uppercase tracking-[0.12em] transition ${
              active
                ? 'bg-mushroom/15 text-mushroom'
                : 'text-mushroom/55 hover:bg-mushroom/10 hover:text-mushroom/90'
            }`}
          >
            <span>{t.label}</span>
            {showBadge ? <PendingCountBadge count={pendingCount} /> : null}
          </Link>
        );
      })}
      {signedIn && isAdmin ? (
        <Link
          href="/admin"
          onClick={onClose}
          className={`rounded-md px-3 py-2.5 text-left text-sm font-display font-semibold uppercase tracking-[0.12em] transition ${
            pathname === '/admin' || pathname.startsWith('/admin/')
              ? 'bg-brass/15 text-brass'
              : 'text-brass/70 hover:bg-brass/10 hover:text-brass'
          }`}
        >
          Admin
        </Link>
      ) : null}
    </nav>
  );

  const handle = (username ?? displayName ?? '').trim();
  const profileActive = pathname === '/profile' || pathname.startsWith('/profile/');

  const footer = (
    <div className="mt-auto border-t border-mushroom/10 px-3 py-3">
      {signedIn ? (
        <div className="space-y-2">
          <div
            className={`rounded-xl border transition ${
              profileActive
                ? 'border-mushroom/30 bg-mushroom/12'
                : 'border-mushroom/12 bg-mushroom/[0.06] hover:border-mushroom/25 hover:bg-mushroom/10'
            }`}
          >
            <div className="flex items-stretch gap-0.5 p-1.5">
              <Link
                href="/profile"
                onClick={onClose}
                className="group flex min-w-0 flex-1 items-center gap-2.5 rounded-lg px-1.5 py-1.5 transition"
                title={handle ? `${handle} — Profile` : 'Profile'}
                aria-label={handle ? `Open profile for ${handle}` : 'Open profile'}
                aria-current={profileActive ? 'page' : undefined}
              >
                <span className="relative shrink-0">
                  <PlayerAvatar
                    avatarId={avatarId}
                    userId={userId}
                    size={40}
                    className="ring-1 ring-mushroom/25"
                    title={handle || 'Player'}
                  />
                  <span
                    className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-sidebar bg-positive"
                    title="Online"
                    aria-hidden
                  />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-display text-sm font-semibold leading-tight text-mushroom">
                    {handle || 'Player'}
                  </span>
                  {chipBalance != null ? (
                    <MoneyAmount
                      amount={chipBalance}
                      showChips
                      className="mt-1 text-[11px] font-medium text-mushroom/75"
                      iconClassName="opacity-70"
                      chipsClassName="!h-3.5 sm:!h-3.5"
                    />
                  ) : (
                    <span className="mt-1 block text-[11px] text-mushroom/40">Bankroll…</span>
                  )}
                </span>
                <ChevronIcon className="h-4 w-4 shrink-0 text-mushroom/30 transition group-hover:translate-x-0.5 group-hover:text-mushroom/55" />
              </Link>
              {handle ? (
                <button
                  type="button"
                  onClick={() => void onCopyUsername()}
                  className="inline-flex w-7 shrink-0 items-center justify-center self-stretch rounded-lg text-mushroom/40 transition hover:bg-mushroom/12 hover:text-mushroom"
                  aria-label={copied ? 'Username copied' : 'Copy username'}
                  title={copied ? 'Copied' : 'Copy username'}
                >
                  {copied ? (
                    <CheckIcon className="h-3.5 w-3.5 text-positive" />
                  ) : (
                    <CopyIcon className="h-3.5 w-3.5" />
                  )}
                </button>
              ) : null}
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              onLogout();
              onClose();
            }}
            className="w-full rounded-lg px-2 py-1.5 text-center text-[11px] font-display font-semibold uppercase tracking-[0.14em] text-mushroom/45 transition hover:bg-mushroom/8 hover:text-mushroom/80"
          >
            Sign out
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          <Link
            href={authHref('sign-in', pathname)}
            onClick={onClose}
            className="block rounded-xl border border-mushroom/20 bg-mushroom/10 px-3 py-2.5 text-center text-xs font-display font-bold uppercase tracking-wider text-mushroom transition hover:border-mushroom/35 hover:bg-mushroom/18"
          >
            Sign in
          </Link>
          <Link
            href={authHref('sign-up', pathname)}
            onClick={onClose}
            className="block rounded-lg px-3 py-2 text-center text-[11px] font-display font-semibold uppercase tracking-wider text-mushroom/55 transition hover:text-mushroom"
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
