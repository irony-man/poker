'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { authHref, currentPathWithQuery } from '@/lib/authRedirect';
import {
  clearStoredSession,
  readStoredSession,
  type StoredSession,
} from '@/lib/session';
import { useSession } from '@/lib/store';

/** Map stored session into the zustand auth slice. */
function applyStored(setSession: (s: {
  userId: string;
  name: string;
  ticket: string;
  username?: string;
  sessionToken?: string;
}) => void, stored: StoredSession) {
  setSession({
    userId: stored.userId,
    username: stored.username,
    name: stored.name,
    ticket: stored.ticket,
    sessionToken: stored.sessionToken,
  });
}

/** Resolve current session from memory or localStorage (no network). */
function resolveLocalSession(): StoredSession | null {
  const live = useSession.getState();
  if (live.userId && live.sessionToken && live.ticket && live.name) {
    return {
      userId: live.userId,
      username: live.username ?? live.name,
      name: live.name,
      ticket: live.ticket,
      sessionToken: live.sessionToken,
    };
  }
  return readStoredSession();
}

/**
 * Shared session hydrate for lobby pages.
 * Restores from memory/localStorage only (no `/api/ticket` network call).
 */
export function useLobbySession() {
  const router = useRouter();
  const setSession = useSession((s) => s.setSession);
  const clearSession = useSession((s) => s.clearSession);
  const sessionName = useSession((s) => s.name);
  const sessionToken = useSession((s) => s.sessionToken);
  const [authReady, setAuthReady] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [name, setName] = useState(sessionName ?? '');

  useEffect(() => {
    const stored = resolveLocalSession();
    if (stored) {
      applyStored(setSession, stored);
      setName(stored.name);
      setSignedIn(true);
    } else {
      setSignedIn(false);
    }
    setAuthReady(true);
  }, [setSession]);

  useEffect(() => {
    if (sessionName) setName(sessionName);
  }, [sessionName]);

  const ensureSession = useCallback(async (): Promise<StoredSession> => {
    const stored = resolveLocalSession();
    if (!stored) {
      clearStoredSession();
      clearSession();
      setSignedIn(false);
      router.push(authHref('sign-in', currentPathWithQuery()));
      throw new Error('Sign in required');
    }
    applyStored(setSession, stored);
    setName(stored.name);
    setSignedIn(true);
    return stored;
  }, [router, setSession, clearSession]);

  return {
    authReady,
    signedIn,
    name,
    setName,
    sessionToken,
    ensureSession,
  };
}
