'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Suspense, useCallback, useEffect, useState, type ReactNode } from 'react';
import { imageAssetUrl } from '@/lib/assets';
import { LobbySidebar } from '@/components/LobbySidebar';
import {
  OnlineFriendsProvider,
  OnlineFriendsStrip,
  PendingCountBadge,
  useOnlineFriends,
} from '@/components/OnlineFriends';
import {
  clearStoredSession,
  readStoredSession,
} from '@/lib/session';
import { useSession } from '@/lib/store';
import { fetchMe, logout as apiLogout } from '@/lib/api';
import { saveAvatarId } from '@/lib/avatars';
import { saveTableColorId } from '@/lib/tableColors';
import { attachPlayFullscreen } from '@/lib/mobileFullscreen';
import { ConfirmProvider } from '@/components/ConfirmPopover';
import { SiteAnnouncementBanner } from '@/components/SiteAnnouncement';
import { useSessionSocket } from '@/lib/ws';

function MobileMenuButton({
  onOpen,
  signedIn,
}: {
  onOpen: () => void;
  signedIn: boolean;
}) {
  const { pendingCount } = useOnlineFriends();
  return (
    <button
      type="button"
      onClick={onOpen}
      className="relative flex h-10 w-10 items-center justify-center rounded-md border border-mushroom/20 text-mushroom"
      aria-label={
        signedIn && pendingCount > 0
          ? `Open menu, ${pendingCount} pending invite${pendingCount === 1 ? '' : 's'}`
          : 'Open menu'
      }
    >
      <span className="flex flex-col gap-1" aria-hidden>
        <span className="block h-0.5 w-4 bg-mushroom" />
        <span className="block h-0.5 w-4 bg-mushroom" />
        <span className="block h-0.5 w-4 bg-mushroom" />
      </span>
      {signedIn && pendingCount > 0 ? (
        <PendingCountBadge count={pendingCount} className="absolute -right-1 -top-1" />
      ) : null}
    </button>
  );
}

/** App shell: lobby sidebar + main, or immersive play with no chrome. */
export function AppChrome({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const tablePlay = pathname.startsWith('/table/') || pathname === '/offline';
  /** Full-bleed play only — contest lobby uses sidebar + scrollable main like other tools. */
  const immersive = tablePlay;
  const isHome = pathname === '/';

  // Mobile: enter browser fullscreen on table routes (gesture-retry + clean exit).
  useEffect(() => {
    if (!tablePlay) return;
    return attachPlayFullscreen();
  }, [tablePlay]);

  const setSession = useSession((s) => s.setSession);
  const clearSession = useSession((s) => s.clearSession);
  const setChipBalance = useSession((s) => s.setChipBalance);
  const setWhuffieBalance = useSession((s) => s.setWhuffieBalance);
  const sessionName = useSession((s) => s.name);
  const sessionToken = useSession((s) => s.sessionToken);
  const [signedIn, setSignedIn] = useState(() => {
    if (typeof window === 'undefined') return false;
    return !!readStoredSession();
  });
  const [displayName, setDisplayName] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    return readStoredSession()?.name ?? null;
  });
  const [menuOpen, setMenuOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  // One shared WS for lobby social/lists + table + contest push.
  useSessionSocket();

  // Restore session from localStorage once — do not hit /api/ticket on navigation.
  useEffect(() => {
    const stored = readStoredSession();
    if (!stored) {
      setSignedIn(false);
      setDisplayName(null);
      return;
    }
    setSession({
      userId: stored.userId,
      username: stored.username,
      name: stored.name,
      ticket: stored.ticket,
      sessionToken: stored.sessionToken,
    });
    setSignedIn(true);
    setDisplayName(stored.name);
  }, [setSession]);

  useEffect(() => {
    if (sessionName && sessionToken) {
      setDisplayName(sessionName);
      setSignedIn(true);
    } else if (!sessionToken) {
      setDisplayName(null);
      setSignedIn(false);
    }
  }, [sessionName, sessionToken]);

  // Keep sidebar bankroll in sync for signed-in lobby.
  useEffect(() => {
    if (!sessionToken) {
      setChipBalance(null);
      setWhuffieBalance(null);
      setIsAdmin(false);
      return;
    }
    let cancelled = false;
    void fetchMe(sessionToken)
      .then((me) => {
        if (cancelled) return;
        setChipBalance(me.chipBalance);
        setWhuffieBalance(me.whuffieBalance);
        setIsAdmin(Boolean(me.isAdmin));
        saveAvatarId(me.avatarId);
        saveTableColorId(me.tableColorId);
      })
      .catch(() => {
        /* ignore — balance shown when available */
      });
    return () => {
      cancelled = true;
    };
  }, [sessionToken, setChipBalance, setWhuffieBalance, pathname]);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  const onLogout = useCallback(async () => {
    const token = sessionToken ?? readStoredSession()?.sessionToken;
    if (token) {
      try {
        await apiLogout(token);
      } catch {
        /* ignore */
      }
    }
    clearStoredSession();
    clearSession();
    setSignedIn(false);
    setDisplayName(null);
    setIsAdmin(false);
  }, [sessionToken, clearSession]);

  if (immersive) {
    return (
      <ConfirmProvider>
        <OnlineFriendsProvider signedIn={signedIn}>
          <main className="play-shell relative flex h-full min-h-0 flex-1 flex-col overflow-hidden px-0 py-0">
            {children}
          </main>
        </OnlineFriendsProvider>
      </ConfirmProvider>
    );
  }

  return (
    <ConfirmProvider>
      <OnlineFriendsProvider signedIn={signedIn}>
        <div className="lobby-shell">
          <Suspense fallback={null}>
            <LobbySidebar
              open={menuOpen}
              onClose={() => setMenuOpen(false)}
              signedIn={signedIn}
              displayName={displayName}
              onLogout={() => void onLogout()}
              isAdmin={isAdmin}
            />
          </Suspense>

          <div className="lobby-main flex h-full min-h-0 min-w-0 flex-1 flex-col">
            <header className="flex shrink-0 flex-col gap-0 bg-sidebar md:hidden">
              <div className="flex items-center justify-between gap-3 px-3 py-2.5">
                <MobileMenuButton signedIn={signedIn} onOpen={() => setMenuOpen(true)} />
                <Link href="/" className="flex flex-1 justify-center">
                  <Image
                    src={imageAssetUrl('pokr-logo.png')}
                    alt="POKR"
                    width={120}
                    height={36}
                    className="h-8 w-auto object-contain mix-blend-screen"
                    priority
                  />
                </Link>
                <span className="w-10" aria-hidden />
              </div>
              <OnlineFriendsStrip
                signedIn={signedIn}
                className="border-t border-mushroom/10 px-3 pb-2"
              />
            </header>

            <main
              className={`flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain ${
                isHome
                  ? 'px-5 py-6 sm:px-10 sm:py-8 lg:px-14 lg:py-10 xl:px-20'
                  : 'px-4 py-4 sm:px-8 sm:py-5 lg:px-12'
              }`}
            >
              <SiteAnnouncementBanner />
              {children}
            </main>
          </div>
        </div>
      </OnlineFriendsProvider>
    </ConfirmProvider>
  );
}
