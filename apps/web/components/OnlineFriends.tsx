'use client';

import Link from 'next/link';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { listFriends, type FriendProfile } from '@/lib/api';
import { PlayerAvatar } from '@/components/PlayerAvatar';
import { useSession } from '@/lib/store';

const REFRESH_MS = 12_000;

type OnlineFriendsContextValue = {
  online: FriendProfile[];
  loaded: boolean;
  friendCount: number;
};

const OnlineFriendsContext = createContext<OnlineFriendsContextValue>({
  online: [],
  loaded: false,
  friendCount: 0,
});

/** Single poll for the whole app shell — wrap AppChrome children. */
export function OnlineFriendsProvider({
  signedIn,
  children,
}: {
  signedIn: boolean;
  children: ReactNode;
}) {
  const sessionToken = useSession((s) => s.sessionToken);
  const [friends, setFriends] = useState<FriendProfile[]>([]);
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(async () => {
    if (!signedIn || !sessionToken) {
      setFriends([]);
      setLoaded(false);
      return;
    }
    try {
      const data = await listFriends({ sessionToken });
      setFriends(data.friends);
      setLoaded(true);
    } catch {
      setLoaded(true);
    }
  }, [signedIn, sessionToken]);

  useEffect(() => {
    void refresh();
    if (!signedIn || !sessionToken) return;
    const id = window.setInterval(() => void refresh(), REFRESH_MS);
    return () => window.clearInterval(id);
  }, [signedIn, sessionToken, refresh]);

  const value = useMemo<OnlineFriendsContextValue>(() => {
    const online = friends
      .filter((f) => f.online)
      .sort((a, b) => a.name.localeCompare(b.name));
    return { online, loaded, friendCount: friends.length };
  }, [friends, loaded]);

  return (
    <OnlineFriendsContext.Provider value={value}>{children}</OnlineFriendsContext.Provider>
  );
}

function useOnlineFriends() {
  return useContext(OnlineFriendsContext);
}

/**
 * Compact online-friends strip for the lobby sidebar (dark chrome).
 */
export function OnlineFriendsSidebar({
  signedIn,
  onNavigate,
}: {
  signedIn: boolean;
  onNavigate?: () => void;
}) {
  const { online, loaded } = useOnlineFriends();

  if (!signedIn) return null;

  return (
    <section
      className="mx-3 mb-2 rounded-xl border border-mushroom/12 bg-mushroom/[0.06] px-2.5 py-2.5"
      aria-label="Online friends"
    >
      <div className="mb-2 flex items-baseline justify-between gap-2 px-0.5">
        <p className="font-display text-[0.65rem] font-bold uppercase tracking-[0.16em] text-mushroom/45">
          Online
        </p>
        <span className="text-[11px] tabular-nums text-mushroom/40">
          {loaded ? online.length : '…'}
        </span>
      </div>

      {!loaded ? (
        <p className="px-0.5 text-[11px] text-mushroom/35">Loading…</p>
      ) : online.length === 0 ? (
        <p className="px-0.5 text-[11px] leading-snug text-mushroom/40">
          No friends online.{' '}
          <Link
            href="/profile?tab=friends"
            onClick={onNavigate}
            className="font-medium text-mushroom/70 underline-offset-2 hover:text-mushroom hover:underline"
          >
            Find friends
          </Link>
        </p>
      ) : (
        <ul className="max-h-40 space-y-1 overflow-y-auto overscroll-contain pr-0.5">
          {online.map((f) => (
            <li key={f.userId}>
              <Link
                href="/profile?tab=friends"
                onClick={onNavigate}
                className="flex items-center gap-2 rounded-lg px-1 py-1 transition hover:bg-mushroom/10"
                title={`${f.name} — online`}
              >
                <span className="relative shrink-0">
                  <PlayerAvatar
                    userId={f.userId}
                    avatarId={f.avatarId}
                    size={28}
                    title={f.name}
                  />
                  <span
                    className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full border-2 border-sidebar bg-positive"
                    aria-hidden
                  />
                </span>
                <span className="min-w-0 flex-1 truncate text-xs font-medium text-mushroom/85">
                  {f.name}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/**
 * Horizontal avatar strip for mobile header / always-visible chrome.
 */
export function OnlineFriendsStrip({
  signedIn,
  className = '',
}: {
  signedIn: boolean;
  className?: string;
}) {
  const { online, loaded } = useOnlineFriends();

  if (!signedIn || !loaded || online.length === 0) return null;

  return (
    <div
      className={`flex items-center gap-2 overflow-x-auto overscroll-contain py-1 ${className}`.trim()}
      aria-label={`${online.length} online friend${online.length === 1 ? '' : 's'}`}
    >
      <span className="shrink-0 text-[10px] font-display font-bold uppercase tracking-[0.14em] text-mushroom/45">
        Online
      </span>
      <ul className="flex items-center gap-1.5">
        {online.map((f) => (
          <li key={f.userId} className="shrink-0">
            <Link
              href="/profile?tab=friends"
              className="relative block"
              title={`${f.name} — online`}
            >
              <PlayerAvatar
                userId={f.userId}
                avatarId={f.avatarId}
                size={28}
                title={f.name}
              />
              <span
                className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full border-2 border-sidebar bg-positive"
                aria-hidden
              />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Floating compact panel for immersive table / offline play.
 */
export function OnlineFriendsOverlay({ signedIn }: { signedIn: boolean }) {
  const { online, loaded } = useOnlineFriends();
  const [open, setOpen] = useState(false);

  if (!signedIn || !loaded) return null;

  return (
    <div className="pointer-events-auto absolute right-2 top-2 z-40 sm:right-3 sm:top-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 rounded-full border border-mushroom/25 bg-sidebar/90 px-2.5 py-1.5 text-[10px] font-display font-bold uppercase tracking-[0.14em] text-mushroom shadow-raised backdrop-blur-sm transition hover:border-mushroom/40"
        aria-expanded={open}
        aria-label={
          online.length === 0
            ? 'No friends online'
            : `${online.length} friend${online.length === 1 ? '' : 's'} online`
        }
      >
        <span className="h-1.5 w-1.5 rounded-full bg-positive" aria-hidden />
        {online.length}
      </button>

      {open ? (
        <div className="mt-1.5 w-44 overflow-hidden rounded-xl border border-mushroom/20 bg-sidebar/95 p-2 shadow-raised backdrop-blur-sm">
          <p className="mb-1.5 px-1 font-display text-[0.6rem] font-bold uppercase tracking-[0.16em] text-mushroom/45">
            Online friends
          </p>
          {online.length === 0 ? (
            <p className="px-1 pb-1 text-[11px] text-mushroom/45">Nobody online</p>
          ) : (
            <ul className="max-h-40 space-y-1 overflow-y-auto">
              {online.map((f) => (
                <li key={f.userId}>
                  <Link
                    href="/profile?tab=friends"
                    className="flex items-center gap-2 rounded-lg px-1 py-1 transition hover:bg-mushroom/10"
                    onClick={() => setOpen(false)}
                  >
                    <PlayerAvatar
                      userId={f.userId}
                      avatarId={f.avatarId}
                      size={24}
                      title={f.name}
                    />
                    <span className="min-w-0 flex-1 truncate text-xs text-mushroom/90">
                      {f.name}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
