'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { imageAssetUrl } from '@/lib/assets';
import { authHref } from '@/lib/authRedirect';
import { loadSavedAvatarId } from '@/lib/avatars';
import { MoneyAmount } from '@/components/CurrencyIcon';
import { PlayerAvatar } from '@/components/PlayerAvatar';
import { PendingCountBadge, useOnlineFriends } from '@/components/OnlineFriends';
import { LOBBY_NAV, isLobbyNavActive } from '@/lib/lobbyNav';
import { useSession } from '@/lib/store';
import { cn } from '@/lib/cn';

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
  signedIn,
  displayName,
  onLogout,
  isAdmin = false,
}: {
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
  const whuffieBalance = useSession((s) => s.whuffieBalance);
  const { pendingCount } = useOnlineFriends();
  const [avatarId, setAvatarId] = useState(0);
  const [copied, setCopied] = useState(false);

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

  const handle = (username ?? displayName ?? '').trim();
  const profileActive = pathname === '/profile' || pathname.startsWith('/profile/');

  return (
    <aside className="lobby-sidebar sidebar-rail">
      <Link href="/" className="group sidebar-brand">
        <Image
          src={imageAssetUrl('pokr-logo.png')}
          alt="POKR"
          width={160}
          height={48}
          className="h-16 w-auto object-contain object-left mix-blend-screen sm:h-11"
          priority
        />
      </Link>

      <nav className="flex flex-1 flex-col gap-1 px-3 py-4" aria-label="Lobby">
        {LOBBY_NAV.map((t) => {
          const active = isLobbyNavActive(pathname, t.href, searchParams.toString());
          const showBadge = signedIn && t.href === '/friends' && pendingCount > 0;
          return (
            <Link
              key={t.href}
              href={t.href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'nav-sidebar-item flex items-center justify-between gap-2',
                active
                  ? 'nav-sidebar-item-active bg-on-chrome/15 text-on-chrome'
                  : 'text-on-chrome/90 hover:bg-on-chrome/12 hover:text-on-chrome',
              )}
            >
              <span>{t.label}</span>
              {showBadge ? <PendingCountBadge count={pendingCount} /> : null}
            </Link>
          );
        })}
        {signedIn && isAdmin ? (
          <Link
            href="/admin"
            aria-current={
              pathname === '/admin' || pathname.startsWith('/admin/') ? 'page' : undefined
            }
            className={cn(
              'nav-sidebar-item',
              pathname === '/admin' || pathname.startsWith('/admin/')
                ? 'bg-brass/15 text-brass'
                : 'text-brass hover:bg-brass/10',
            )}
          >
            Admin
          </Link>
        ) : null}
      </nav>

      <div className="sidebar-footer">
        {signedIn ? (
          <div className="space-y-2">
            <div
              className={`rounded-xl border transition ${
                profileActive
                  ? 'border-subtle/30 bg-on-chrome/12'
                  : 'border-subtle/12 bg-on-chrome/[0.06] hover:border-subtle/25 hover:bg-on-chrome/10'
              }`}
            >
              <div className="flex items-stretch gap-0.5 p-1.5">
                <Link
                  href="/profile"
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
                      className="presence-dot h-2.5 w-2.5"
                      title="Online"
                      aria-hidden
                    />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-display text-sm font-semibold leading-tight text-on-chrome">
                      {handle || 'Player'}
                    </span>
                    {chipBalance != null ? (
                      <span className="mt-1 flex flex-col gap-0.5">
                        <MoneyAmount
                          amount={chipBalance}
                          showChips
                          className="text-xs font-medium text-on-chrome/90"
                          iconClassName="opacity-80"
                          chipsClassName="!h-3.5 sm:!h-3.5"
                        />
                        {whuffieBalance != null ? (
                          <MoneyAmount
                            amount={whuffieBalance}
                            showWhuffies
                            className="text-[11px] font-medium text-on-chrome/85"
                          />
                        ) : null}
                      </span>
                    ) : (
                      <span className="mt-1 block text-[11px] text-on-chrome/85">Bankroll…</span>
                    )}
                  </span>
                  <ChevronIcon className="h-4 w-4 shrink-0 text-on-chrome/45 transition group-hover:translate-x-0.5 group-hover:text-on-chrome/70" />
                </Link>
                {handle ? (
                  <button
                    type="button"
                    onClick={() => void onCopyUsername()}
                    className="inline-flex w-7 shrink-0 items-center justify-center self-stretch rounded-lg text-on-chrome/90 transition hover:bg-on-chrome/12 hover:text-on-chrome"
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
              onClick={onLogout}
              className="w-full rounded-lg px-2 py-1.5 text-center text-xs font-display font-semibold uppercase tracking-[0.14em] text-on-chrome/90 transition hover:bg-on-chrome/8 hover:text-on-chrome"
            >
              Sign out
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <Link
              href={authHref('sign-in', pathname)}
              className="block rounded-xl border border-subtle/20 bg-on-chrome/10 px-3 py-2.5 text-center text-xs font-display font-bold uppercase tracking-wider text-on-chrome transition hover:border-subtle/35 hover:bg-on-chrome/18"
            >
              Sign in
            </Link>
            <Link
              href={authHref('sign-up', pathname)}
              className="sidebar-footer-link"
            >
              Create account
            </Link>
          </div>
        )}
      </div>
    </aside>
  );
}
