'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { FriendsPanel } from '@/components/FriendsPanel';
import { LOBBY_NAV, isLobbyNavActive } from '@/lib/lobbyNav';

function useMdUp() {
  const [mdUp, setMdUp] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)');
    const sync = () => setMdUp(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);
  return mdUp;
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
  const router = useRouter();
  const mdUp = useMdUp();
  const [view, setView] = useState<'nav' | 'friends'>('nav');

  // Return to lobby nav when the drawer closes (mobile).
  useEffect(() => {
    if (!open) setView('nav');
  }, [open]);

  const navigateTable = (tableId: string, inviteCode: string) => {
    onClose();
    router.push(`/table/${tableId}?invite=${inviteCode}`);
  };

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
      <button
        type="button"
        onClick={() => setView('friends')}
        className="mt-1 rounded-md border border-mushroom/15 px-3 py-2.5 text-left text-sm font-display font-semibold uppercase tracking-[0.12em] text-mushroom/55 transition hover:border-mushroom/30 hover:bg-mushroom/10 hover:text-mushroom/90"
      >
        Friends
      </button>
    </nav>
  );

  const friendsView = (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-1 border-b border-mushroom/10 px-2 py-2">
        <button
          type="button"
          onClick={() => setView('nav')}
          className="rounded-md px-2 py-1.5 text-mushroom/60 transition hover:bg-mushroom/10 hover:text-mushroom"
          aria-label="Back to menu"
        >
          ←
        </button>
        <div className="min-w-0 flex-1">
          <p className="font-display text-sm font-semibold uppercase tracking-[0.14em] text-mushroom">
            Friends
          </p>
          <p className="text-[10px] text-mushroom/45">Groups · invites · challenge</p>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
        <FriendsPanel disabled={!signedIn} onNavigateTable={navigateTable} />
      </div>
    </div>
  );

  const footer = (
    <div className="mt-auto border-t border-mushroom/10 px-4 py-4">
      {signedIn ? (
        <div className="space-y-2">
          <div>
            <p className="text-[10px] font-display uppercase tracking-[0.16em] text-mushroom/45">
              Signed in
            </p>
            <p className="truncate font-display text-sm font-semibold text-mushroom">
              {displayName || 'Player'}
            </p>
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
            href="/sign-in"
            onClick={onClose}
            className="rounded-md border border-mushroom/25 bg-mushroom/10 px-3 py-2.5 text-center text-xs font-display font-bold uppercase tracking-wider text-mushroom transition hover:bg-mushroom/20"
          >
            Sign in
          </Link>
          <Link
            href="/sign-up"
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

  // Mount FriendsPanel in only the active shell to avoid double API polling.
  const desktopInner = view === 'friends' && mdUp ? friendsView : navLinks;
  const mobileInner = view === 'friends' && !mdUp ? friendsView : navLinks;

  return (
    <>
      <aside className="lobby-sidebar hidden h-full min-h-0 md:flex md:w-60 md:shrink-0 md:flex-col">
        {logo}
        {desktopInner}
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
          {mobileInner}
          {footer}
        </aside>
      </div>
    </>
  );
}
