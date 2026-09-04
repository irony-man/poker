'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Suspense, useCallback, useEffect, useState, type ReactNode } from 'react';
import { imageAssetUrl } from '@/lib/assets';
import { LobbySidebar } from '@/components/LobbySidebar';
import { LobbyBottomNav } from '@/components/LobbyBottomNav';
import { PlayerAvatar } from '@/components/PlayerAvatar';
import {
  OnlineFriendsProvider,
  OnlineFriendsStrip,
} from '@/components/OnlineFriends';
import { authHref } from '@/lib/authRedirect';
import {
  clearStoredSession,
  readStoredSession,
} from '@/lib/session';
import { useSession } from '@/lib/store';
import { fetchMe, logout as apiLogout } from '@/lib/api';
import { loadSavedAvatarId, saveAvatarId } from '@/lib/avatars';
import { saveTableColorId } from '@/lib/tableColors';
import { setSfxMuted } from '@/lib/audio';
import { loadSavedTableLayout, saveTableLayout } from '@/lib/tableLayoutPref';
import { loadSavedUiTheme, saveUiTheme } from '@/lib/uiTheme';
import { attachPlayFullscreen } from '@/lib/mobileFullscreen';
import { ConfirmProvider } from '@/components/ConfirmPopover';
import { SiteAnnouncementBanner } from '@/components/SiteAnnouncement';
import { SkipLink } from '@/components/SkipLink';
import { useSessionSocket } from '@/lib/ws';

function PersonIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-6 w-6"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="12" cy="8" r="3.2" />
      <path d="M6 19.2c.8-3.2 3-4.7 6-4.7s5.2 1.5 6 4.7" />
    </svg>
  );
}

function MobileProfileButton({ signedIn }: { signedIn: boolean }) {
  const pathname = usePathname();
  const userId = useSession((s) => s.userId);
  const [avatarId, setAvatarId] = useState(0);
  const profileActive = pathname === '/profile' || pathname.startsWith('/profile/');

  useEffect(() => {
    if (!signedIn) return;
    setAvatarId(loadSavedAvatarId());
  }, [signedIn, userId, pathname]);

  if (!signedIn) {
    return (
      <Link
        href={authHref('sign-in', pathname)}
        className="flex h-10 w-10 items-center justify-center rounded-full text-mushroom/80 ring-1 ring-mushroom/20"
        aria-label="Sign in"
      >
        <PersonIcon />
      </Link>
    );
  }

  return (
    <Link
      href="/profile"
      className={`relative flex h-10 w-10 items-center justify-center rounded-full ${
        profileActive ? 'ring-2 ring-mushroom/50' : 'ring-1 ring-mushroom/25'
      }`}
      aria-label="Profile"
      aria-current={profileActive ? 'page' : undefined}
    >
      <PlayerAvatar avatarId={avatarId} userId={userId} size={40} title="Profile" />
    </Link>
  );
}

/** App shell: lobby sidebar + main, or immersive play with no chrome. */
export function AppChrome({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const tablePlay = pathname.startsWith('/table/') || pathname === '/offline';
  /** Full-bleed play only — contest lobby uses sidebar + scrollable main like other tools. */
  const immersive = tablePlay;
  const isAdminRoute = pathname === '/admin' || pathname.startsWith('/admin/');
  const isHome = pathname === '/';

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
  const [isAdmin, setIsAdmin] = useState(false);

  useSessionSocket();

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

  useEffect(() => {
    saveUiTheme(loadSavedUiTheme());
    saveTableLayout(loadSavedTableLayout());
  }, []);

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
        saveUiTheme(me.uiTheme);
        saveTableLayout(me.tableLayout);
        setSfxMuted(me.sfxMuted);
      })
      .catch(() => {
        /* ignore — balance shown when available */
      });
    return () => {
      cancelled = true;
    };
  }, [sessionToken, setChipBalance, setWhuffieBalance, pathname]);

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
          <SkipLink />
          <main
            id="main-content"
            className="play-shell relative flex h-full min-h-0 flex-1 flex-col overflow-hidden px-0 py-0"
          >
            {children}
          </main>
        </OnlineFriendsProvider>
      </ConfirmProvider>
    );
  }

  if (isAdminRoute) {
    return (
      <ConfirmProvider>
        <OnlineFriendsProvider signedIn={signedIn}>
          <div className="lobby-shell">{children}</div>
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
              signedIn={signedIn}
              displayName={displayName}
              onLogout={() => void onLogout()}
              isAdmin={isAdmin}
            />
          </Suspense>

          <div className="lobby-main lobby-main-fill">
            <header className="flex shrink-0 flex-col gap-0 bg-sidebar md:hidden">
              <div className="flex items-center justify-between gap-3 px-3 py-2.5">
                <Link href="/" className="flex min-w-0 flex-1 items-center">
                  <Image
                    src={imageAssetUrl('pokr-logo.png')}
                    alt="POKR"
                    width={120}
                    height={36}
                    className="h-8 w-auto object-contain mix-blend-screen"
                    priority
                  />
                </Link>
                <MobileProfileButton signedIn={signedIn} />
              </div>
              <OnlineFriendsStrip
                signedIn={signedIn}
                className="border-t border-mushroom/10 px-3 pb-2"
              />
            </header>

            <SkipLink />
            <main
              id="main-content"
              className={`flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain pb-4 md:pb-0 ${
                isHome
                  ? 'px-5 py-6 sm:px-10 sm:py-8 lg:px-14 lg:py-10 xl:px-20'
                  : 'px-4 py-4 sm:px-8 sm:py-5 lg:px-12'
              }`}
            >
              <SiteAnnouncementBanner />
              {children}
            </main>

            <Suspense fallback={null}>
              <LobbyBottomNav />
            </Suspense>
          </div>
        </div>
      </OnlineFriendsProvider>
    </ConfirmProvider>
  );
}
