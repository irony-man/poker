'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useId, useRef, useState } from 'react';
import { PendingCountBadge, useOnlineFriends } from '@/components/OnlineFriends';
import {
  MOBILE_BOTTOM_NAV,
  isMobileNavActive,
  type MobileBottomIcon,
} from '@/lib/lobbyNav';
import { useSession } from '@/lib/store';

function NavIcon({ name, active }: { name: MobileBottomIcon; active: boolean }) {
  const props = {
    viewBox: '0 0 24 24',
    className: 'h-[22px] w-[22px]',
    fill: active ? 'currentColor' : 'none',
    stroke: 'currentColor',
    strokeWidth: active ? 1.6 : 1.75,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true as const,
  };

  switch (name) {
    case 'home':
      return (
        <svg {...props}>
          <path d="M3.6 10.8 12 3.8l8.4 7V20a1.4 1.4 0 0 1-1.4 1.4H14v-6.2h-4v6.2H5a1.4 1.4 0 0 1-1.4-1.4v-9.2Z" />
        </svg>
      );
    case 'hostJoin':
      return (
        <svg {...props}>
          <ellipse cx="12" cy="13.2" rx="8.4" ry="5.4" />
          <path d="M12 7.2V4.6" fill="none" />
          <circle cx="12" cy="3.8" r="1.15" fill="currentColor" stroke="none" />
          <path d="M7.4 13.2h9.2" fill="none" stroke={active ? 'rgb(var(--sidebar))' : 'currentColor'} />
        </svg>
      );
    case 'public':
      return (
        <svg {...props} fill="none">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 3c2.4 2.6 3.6 5.6 3.6 9s-1.2 6.4-3.6 9c-2.4-2.6-3.6-5.6-3.6-9s1.2-6.4 3.6-9Z" />
          <path d="M3.4 12h17.2" />
        </svg>
      );
    case 'contests':
      return (
        <svg {...props}>
          <path d="M8 4.5h8v5.2a4 4 0 0 1-8 0V4.5Z" />
          <path d="M8 5.6H5.2A2.8 2.8 0 0 0 8 10" fill="none" />
          <path d="M16 5.6h2.8A2.8 2.8 0 0 1 16 10" fill="none" />
          <path d="M12 13.7v2.6" fill="none" />
          <path d="M9.2 20.2h5.6" fill="none" />
          <path d="M10.4 16.3h3.2v1.6h-3.2Z" />
        </svg>
      );
    case 'friends':
      return (
        <svg {...props}>
          <circle cx="9" cy="8" r="2.7" />
          <path d="M4.2 18.8v-1.1A4.1 4.1 0 0 1 8.3 13.6h1.5a4.1 4.1 0 0 1 4.1 4.1v1.1" />
          <circle cx="16.4" cy="8.4" r="2.2" fill={active ? 'currentColor' : 'none'} />
          <path d="M15.3 13.8h.7a3.5 3.5 0 0 1 3.5 3.5v1.5" fill="none" />
        </svg>
      );
    case 'offline':
      return (
        <svg {...props}>
          <rect x="6.2" y="8.2" width="11.6" height="10.4" rx="2.4" />
          <circle cx="9.6" cy="13.2" r="1.15" fill={active ? 'rgb(var(--sidebar))' : 'currentColor'} stroke="none" />
          <circle cx="14.4" cy="13.2" r="1.15" fill={active ? 'rgb(var(--sidebar))' : 'currentColor'} stroke="none" />
          <path d="M12 8.2V5.4" fill="none" />
          <circle cx="12" cy="4.4" r="1.05" />
          <path d="M9.8 16.6h4.4" fill="none" stroke={active ? 'rgb(var(--sidebar))' : 'currentColor'} />
        </svg>
      );
  }
}

function SlotLabel({ text, active }: { text: string; active: boolean }) {
  return (
    <span
      className={`mt-0.5 max-w-full truncate px-0.5 text-[11px] font-display font-semibold uppercase tracking-[0.06em] ${
        active ? 'text-mushroom' : 'text-mushroom/80'
      }`}
    >
      {text}
    </span>
  );
}

function slotClass(active: boolean) {
  return `relative flex h-[3.65rem] flex-1 flex-col items-center justify-center gap-0 pt-1 transition ${
    active ? 'text-mushroom' : 'text-mushroom/80 hover:text-mushroom'
  }`;
}

export function LobbyBottomNav() {
  const pathname = usePathname();
  const signedIn = !!useSession((s) => s.sessionToken);
  const { pendingCount } = useOnlineFriends();
  const [hostOpen, setHostOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    setHostOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!hostOpen) return;
    const onPointer = (e: PointerEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setHostOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setHostOpen(false);
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [hostOpen]);

  return (
    <nav
      className="lobby-sidebar z-20 shrink-0 border-t border-mushroom/10 md:hidden"
      aria-label="Mobile lobby"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="flex items-stretch">
        {MOBILE_BOTTOM_NAV.map((item) => {
          const active = isMobileNavActive(pathname, item);
          if (item.kind === 'hostJoin') {
            return (
              <div key={item.id} className="relative flex flex-1" ref={menuRef}>
                <button
                  type="button"
                  className={slotClass(active)}
                  aria-label={item.label}
                  aria-expanded={hostOpen}
                  aria-controls={menuId}
                  aria-current={active ? 'page' : undefined}
                  onClick={() => setHostOpen((open) => !open)}
                >
                  <NavIcon name={item.icon} active={active} />
                  <SlotLabel text={item.shortLabel} active={active} />
                </button>
                {hostOpen ? (
                  <div
                    id={menuId}
                    role="menu"
                    className="absolute bottom-[calc(100%+0.5rem)] left-1/2 z-30 w-40 -translate-x-1/2 overflow-hidden rounded-xl border border-mushroom/15 bg-sidebar shadow-[0_12px_32px_rgb(0_0_0/0.35)]"
                  >
                    <Link
                      href="/host"
                      role="menuitem"
                      className="menu-item-dark"
                      onClick={() => setHostOpen(false)}
                    >
                      Host
                    </Link>
                    <Link
                      href="/join"
                      role="menuitem"
                      className="menu-item-dark border-t border-mushroom/10"
                      onClick={() => setHostOpen(false)}
                    >
                      Join
                    </Link>
                  </div>
                ) : null}
              </div>
            );
          }

          const showBadge = signedIn && item.id === 'friends' && pendingCount > 0;
          return (
            <Link
              key={item.id}
              href={item.href}
              className={slotClass(active)}
              aria-label={item.label}
              aria-current={active ? 'page' : undefined}
            >
              <span className="relative">
                <NavIcon name={item.icon} active={active} />
                {showBadge ? (
                  <PendingCountBadge count={pendingCount} className="absolute -right-2.5 -top-1.5" />
                ) : null}
              </span>
              <SlotLabel text={item.shortLabel} active={active} />
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
