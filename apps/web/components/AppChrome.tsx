'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { LobbySidebar } from '@/components/LobbySidebar';
import {
  clearStoredSession,
  readStoredSession,
  writeStoredSession,
  type StoredSession,
} from '@/lib/session';
import { useSession } from '@/lib/store';
import { logout as apiLogout, refreshTicket } from '@/lib/api';
import { loadSavedAvatarId, saveAvatarId } from '@/lib/avatars';

/** App shell: lobby sidebar + main, or immersive play with no chrome. */
export function AppChrome({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const playRoute =
    pathname.startsWith('/table/') ||
    pathname === '/offline' ||
    pathname.startsWith('/contest/');
  const immersive = playRoute;
  const isHome = pathname === '/';

  const setSession = useSession((s) => s.setSession);
  const clearSession = useSession((s) => s.clearSession);
  const sessionName = useSession((s) => s.name);
  const sessionToken = useSession((s) => s.sessionToken);
  const [signedIn, setSignedIn] = useState(false);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function hydrate() {
      const stored = readStoredSession();
      if (!stored) {
        if (!cancelled) {
          setSignedIn(false);
          setDisplayName(null);
        }
        return;
      }
      try {
        const refreshed = await refreshTicket(stored.sessionToken);
        if (cancelled) return;
        const next: StoredSession = {
          userId: refreshed.userId,
          username: refreshed.username ?? stored.username,
          name: refreshed.name,
          ticket: refreshed.ticket,
          sessionToken: stored.sessionToken,
          avatarId: refreshed.avatarId ?? stored.avatarId ?? loadSavedAvatarId(),
        };
        setSession(next);
        writeStoredSession(next);
        if (typeof next.avatarId === 'number') saveAvatarId(next.avatarId);
        setSignedIn(true);
        setDisplayName(next.name);
      } catch {
        if (cancelled) return;
        clearStoredSession();
        clearSession();
        setSignedIn(false);
        setDisplayName(null);
      }
    }
    void hydrate();
    return () => {
      cancelled = true;
    };
  }, [setSession, clearSession, pathname]);

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
  }, [sessionToken, clearSession]);

  if (immersive) {
    return (
      <main className="flex min-h-dvh flex-1 flex-col px-1.5 py-1 md:px-3 md:py-2">
        {children}
      </main>
    );
  }

  return (
    <div className="lobby-shell">
      <LobbySidebar
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        signedIn={signedIn}
        displayName={displayName}
        onLogout={() => void onLogout()}
      />

      <div className="flex min-h-dvh min-w-0 flex-1 flex-col lobby-main">
        <header className="flex shrink-0 items-center justify-between gap-3 bg-sidebar px-3 py-2.5 md:hidden">
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            className="flex h-10 w-10 items-center justify-center rounded-md border border-mushroom/20 text-mushroom"
            aria-label="Open menu"
          >
            <span className="flex flex-col gap-1" aria-hidden>
              <span className="block h-0.5 w-4 bg-mushroom" />
              <span className="block h-0.5 w-4 bg-mushroom" />
              <span className="block h-0.5 w-4 bg-mushroom" />
            </span>
          </button>
          <Link href="/" className="flex flex-1 justify-center">
            <Image
              src="/pokr-logo.png"
              alt="POKR"
              width={120}
              height={36}
              className="h-8 w-auto object-contain mix-blend-screen"
              priority
            />
          </Link>
          <span className="w-10" aria-hidden />
        </header>

        <main
          className={`flex-1 min-h-0 overflow-y-auto ${
            isHome
              ? 'px-4 py-4 sm:px-8 sm:py-5 lg:px-12 xl:px-16'
              : 'px-4 py-5 sm:px-8 sm:py-8 lg:px-12'
          }`}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
