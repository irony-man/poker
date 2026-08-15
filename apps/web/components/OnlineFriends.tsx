'use client';

import Link from 'next/link';
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { listFriends, type FriendProfile } from '@/lib/api';
import { PlayerAvatar } from '@/components/PlayerAvatar';
import { useSession } from '@/lib/store';
import { useIsNarrow } from '@/lib/tableLayout';

type OnlineFriendsContextValue = {
  online: FriendProfile[];
  loaded: boolean;
  friendCount: number;
  incomingCount: number;
  challengeCount: number;
  pendingCount: number;
  refreshSocial: () => Promise<void>;
};

const OnlineFriendsContext = createContext<OnlineFriendsContextValue>({
  online: [],
  loaded: false,
  friendCount: 0,
  incomingCount: 0,
  challengeCount: 0,
  pendingCount: 0,
  refreshSocial: async () => {},
});

/** Compact numeric count for nav/tabs; caps at 9+. */
export function PendingCountBadge({
  count,
  className = '',
  tone = 'dark',
}: {
  count: number;
  className?: string;
  /** dark = sidebar/mushroom chrome; light = cream profile tabs */
  tone?: 'dark' | 'light';
}) {
  if (count <= 0) return null;
  const label = count > 9 ? '9+' : String(count);
  const toneClass =
    tone === 'light'
      ? 'bg-danger text-cream'
      : 'bg-gold text-sidebar';
  return (
    <span
      className={`inline-flex min-w-[1.15rem] items-center justify-center rounded-full px-1 py-0.5 text-[10px] font-bold leading-none tabular-nums ${toneClass} ${className}`.trim()}
      aria-label={`${count} pending invite${count === 1 ? '' : 's'}`}
    >
      {label}
    </span>
  );
}

/** Social badge state from the session WebSocket (push `social_sync`). */
export function OnlineFriendsProvider({
  signedIn,
  children,
}: {
  signedIn: boolean;
  children: ReactNode;
}) {
  const sessionToken = useSession((s) => s.sessionToken);
  const social = useSession((s) => s.social);
  const socialLoaded = useSession((s) => s.socialLoaded);
  const applySocial = useSession((s) => s.applySocial);

  const refresh = useCallback(async () => {
    if (!signedIn || !sessionToken) {
      return;
    }
    try {
      const data = await listFriends({ sessionToken });
      applySocial({
        friends: data.friends,
        incoming: data.incoming,
        pendingChallenges: data.pendingChallenges,
        groups: data.groups ?? [],
      });
    } catch {
      /* push path is source of truth; REST is one-shot fallback after local mutations */
    }
  }, [signedIn, sessionToken, applySocial]);

  const value = useMemo<OnlineFriendsContextValue>(() => {
    if (!signedIn || !sessionToken) {
      return {
        online: [],
        loaded: false,
        friendCount: 0,
        incomingCount: 0,
        challengeCount: 0,
        pendingCount: 0,
        refreshSocial: refresh,
      };
    }
    const friends = social?.friends ?? [];
    const incomingCount = social?.incoming.length ?? 0;
    const challengeCount = social?.pendingChallenges.length ?? 0;
    const online = friends
      .filter((f) => f.online)
      .sort((a, b) => a.name.localeCompare(b.name));
    return {
      online,
      loaded: socialLoaded,
      friendCount: friends.length,
      incomingCount,
      challengeCount,
      pendingCount: incomingCount + challengeCount,
      refreshSocial: refresh,
    };
  }, [signedIn, sessionToken, social, socialLoaded, refresh]);

  return (
    <OnlineFriendsContext.Provider value={value}>{children}</OnlineFriendsContext.Provider>
  );
}

export function useOnlineFriends() {
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
                    avatarUrl={f.avatarUrl}
                    size={28}
                    title={f.name}
                  />
                  <span
                    className="presence-dot"
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
                avatarUrl={f.avatarUrl}
                size={28}
                title={f.name}
              />
              <span
                className="presence-dot"
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
 * Only when friends are online — pinned to the bottom-right of the table column.
 */
export function OnlineFriendsOverlay({ signedIn }: { signedIn: boolean }) {
  const { online, loaded, pendingCount } = useOnlineFriends();
  const [open, setOpen] = useState(false);
  const narrow = useIsNarrow();

  if (!signedIn || !loaded || online.length === 0) return null;

  const onlineLabel = `${online.length} friend${online.length === 1 ? '' : 's'} online`;
  const pendingLabel =
    pendingCount > 0
      ? `, ${pendingCount} pending invite${pendingCount === 1 ? '' : 's'}`
      : '';

  // Mobile docks actions in-flow (~160px); lift the chip above that strip.
  const positionClass = narrow
    ? 'bottom-[calc(10.5rem+env(safe-area-inset-bottom,0px))] right-2'
    : 'bottom-3 right-3';

  return (
    <div className={`pointer-events-auto absolute z-40 ${positionClass}`}>
      {open ? (
        <div className="mb-1.5 w-44 overflow-hidden rounded-xl border border-mushroom/20 bg-sidebar/95 p-2 shadow-raised backdrop-blur-sm">
          <p className="mb-1.5 px-1 font-display text-[0.6rem] font-bold uppercase tracking-[0.16em] text-mushroom/45">
            Online friends
          </p>
          {pendingCount > 0 ? (
            <Link
              href="/friends"
              className="mb-1.5 flex items-center justify-between gap-2 rounded-lg bg-gold/15 px-1.5 py-1 text-[11px] font-medium text-mushroom transition hover:bg-gold/25"
              onClick={() => setOpen(false)}
            >
              <span>Pending invites</span>
              <PendingCountBadge count={pendingCount} />
            </Link>
          ) : null}
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
                    avatarUrl={f.avatarUrl}
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
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative ml-auto flex items-center gap-1.5 rounded-full border border-mushroom/25 bg-sidebar/90 px-2.5 py-1.5 text-[10px] font-display font-bold uppercase tracking-[0.14em] text-mushroom shadow-raised backdrop-blur-sm transition hover:border-mushroom/40"
        aria-expanded={open}
        aria-label={`${onlineLabel}${pendingLabel}`}
      >
        <span className="h-1.5 w-1.5 rounded-full bg-positive" aria-hidden />
        {online.length}
        {pendingCount > 0 ? (
          <PendingCountBadge
            count={pendingCount}
            className="absolute -right-1 -top-1"
          />
        ) : null}
      </button>
    </div>
  );
}
