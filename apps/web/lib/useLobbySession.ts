'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { refreshTicket } from '@/lib/api';
import { loadSavedAvatarId, saveAvatarId } from '@/lib/avatars';
import {
  clearStoredSession,
  readStoredSession,
  writeStoredSession,
  type StoredSession,
} from '@/lib/session';
import { useSession } from '@/lib/store';

/** Shared session hydrate + ensure for lobby pages. */
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
    let cancelled = false;
    async function hydrate() {
      const stored = readStoredSession();
      if (!stored) {
        if (!cancelled) {
          setAuthReady(true);
          setSignedIn(false);
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
        setName(next.name);
        setSignedIn(true);
      } catch {
        if (cancelled) return;
        clearStoredSession();
        clearSession();
        setSignedIn(false);
      } finally {
        if (!cancelled) setAuthReady(true);
      }
    }
    void hydrate();
    return () => {
      cancelled = true;
    };
  }, [setSession, clearSession]);

  useEffect(() => {
    if (sessionName) setName(sessionName);
  }, [sessionName]);

  const ensureSession = useCallback(async (): Promise<StoredSession> => {
    const stored = readStoredSession();
    if (!stored) {
      router.push('/sign-in');
      throw new Error('Sign in required');
    }
    try {
      const refreshed = await refreshTicket(stored.sessionToken);
      const next: StoredSession = {
        userId: refreshed.userId,
        username: refreshed.username ?? stored.username,
        name: refreshed.name,
        ticket: refreshed.ticket,
        sessionToken: stored.sessionToken,
        avatarId: refreshed.avatarId ?? stored.avatarId,
      };
      setSession(next);
      writeStoredSession(next);
      setName(next.name);
      setSignedIn(true);
      return next;
    } catch {
      clearStoredSession();
      clearSession();
      setSignedIn(false);
      router.push('/sign-in');
      throw new Error('Session expired — sign in again');
    }
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
