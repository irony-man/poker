'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState, type ReactNode } from 'react';
import { StatusChip } from '@/components/ui/StatusChip';
import { imageAssetUrl } from '@/lib/assets';
import { formatMoneyLabel } from '@/lib/currency';
import type { SiteEconomy } from '@/lib/api';
import { ADMIN_NAV, TABS, adminTabHref, type AdminTab } from './tabs';
import { StatCard } from './ui';
import { cn } from '@/lib/cn';

function MenuIcon() {
  return (
    <span className="flex flex-col gap-1" aria-hidden>
      <span className="block h-0.5 w-4 bg-mushroom" />
      <span className="block h-0.5 w-4 bg-mushroom" />
      <span className="block h-0.5 w-4 bg-mushroom" />
    </span>
  );
}

function AdminNav({
  tab,
  onSelect,
  onClose,
}: {
  tab: AdminTab;
  onSelect: (id: AdminTab) => void;
  onClose?: () => void;
}) {
  return (
    <nav className="flex flex-1 flex-col gap-4 overflow-y-auto px-3 py-3" aria-label="Admin">
      {ADMIN_NAV.map((group) => (
        <div key={group.label}>
          <p className="sidebar-nav-kicker">
            {group.label}
          </p>
          <div className="flex flex-col gap-0.5">
            {group.items.map((item) => {
              const active = item.id === tab;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    onSelect(item.id);
                    onClose?.();
                  }}
                  className={cn(
                    'nav-sidebar-item py-2',
                    active
                      ? 'nav-sidebar-item-active bg-brass/15 text-brass'
                      : 'text-mushroom/80 hover:bg-mushroom/12 hover:text-mushroom',
                  )}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}

function AdminBrand({ onClick }: { onClick?: () => void }) {
  return (
    <Link
      href="/"
      onClick={onClick}
      className="group sidebar-brand"
    >
      <Image
        src={imageAssetUrl('pokr-logo.png')}
        alt="POKR"
        width={160}
        height={48}
        className="h-11 w-auto object-contain object-left mix-blend-screen"
        priority
      />
      <p className="mt-2 font-display text-[10px] font-semibold uppercase tracking-[0.18em] text-brass/80">
        Admin
      </p>
    </Link>
  );
}

export function AdminShell({
  tab,
  onSelectTab,
  stats,
  economy,
  error,
  okMsg,
  children,
}: {
  tab: AdminTab;
  onSelectTab: (tab: AdminTab) => void;
  stats: { userCount: number; liveTables: number; liveContests: number } | null;
  economy: SiteEconomy | null;
  error?: string | null;
  okMsg?: string | null;
  children: ReactNode;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const current = TABS.find((t) => t.id === tab)?.label ?? 'Admin';

  const sidebarInner = (
    <>
      <AdminBrand onClick={() => setMenuOpen(false)} />
      <AdminNav tab={tab} onSelect={onSelectTab} onClose={() => setMenuOpen(false)} />
      <div className="sidebar-footer">
        <Link
          href="/"
          onClick={() => setMenuOpen(false)}
          className="sidebar-footer-link"
        >
          Back to lobby
        </Link>
      </div>
    </>
  );

  return (
    <div className="flex h-full min-h-0 w-full overflow-hidden">
      <aside className="lobby-sidebar sidebar-rail">
        {sidebarInner}
      </aside>

      <div
        className={`fixed inset-0 z-50 md:hidden ${menuOpen ? 'pointer-events-auto' : 'pointer-events-none'}`}
        aria-hidden={!menuOpen}
      >
        <button
          type="button"
          className={`absolute inset-0 bg-sidebar/60 transition-opacity duration-base ${
            menuOpen ? 'opacity-100' : 'opacity-0'
          }`}
          aria-label="Close menu"
          onClick={() => setMenuOpen(false)}
        />
        <aside
          className={`lobby-sidebar absolute inset-y-0 left-0 flex w-[min(18rem,86vw)] flex-col shadow-raised transition-transform duration-base ease-out ${
            menuOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <div className="flex items-start justify-between pr-2">
            <AdminBrand onClick={() => setMenuOpen(false)} />
            <button
              type="button"
              onClick={() => setMenuOpen(false)}
              className="mr-2 mt-5 rounded-md px-2 py-1.5 text-mushroom/60 hover:text-mushroom"
              aria-label="Close"
            >
              ✕
            </button>
          </div>
          <AdminNav tab={tab} onSelect={onSelectTab} onClose={() => setMenuOpen(false)} />
          <div className="sidebar-footer">
            <Link
              href="/"
              onClick={() => setMenuOpen(false)}
              className="sidebar-footer-link"
            >
              Back to lobby
            </Link>
          </div>
        </aside>
      </div>

      <div className="lobby-main lobby-main-fill">
        <header className="flex shrink-0 items-center gap-3 bg-sidebar px-3 py-2.5 md:hidden">
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            className="flex h-10 w-10 items-center justify-center rounded-md border border-mushroom/20 text-mushroom"
            aria-label="Open admin menu"
          >
            <MenuIcon />
          </button>
          <p className="font-display text-sm font-semibold uppercase tracking-[0.14em] text-mushroom">
            {current}
          </p>
        </header>

        <main className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain px-4 py-4 sm:px-8 sm:py-5 lg:px-12">
          <header className="mb-5 hidden md:block">
            <h1 className="font-title-page">Admin</h1>
            <p className="mt-1.5 text-sm text-ink-strong-muted">Site, players, and live tables</p>
          </header>

          {okMsg ? (
            <StatusChip tone="positive" className="mb-4 text-xs" role="status">
              {okMsg}
            </StatusChip>
          ) : null}
          {error ? (
            <StatusChip tone="danger" role="alert" className="mb-4 text-xs">
              {error}
            </StatusChip>
          ) : null}

          {stats && economy ? (
            <div className="mb-5 flex flex-wrap gap-3">
              <StatCard label="Users" value={stats.userCount} href={adminTabHref('users')} />
              <StatCard label="Live tables" value={stats.liveTables} href={adminTabHref('games')} />
              <StatCard label="Contests" value={stats.liveContests} href={adminTabHref('games')} />
              <StatCard
                label="Start chips"
                value={formatMoneyLabel(economy.startingChipGrant)}
                href={adminTabHref('economy')}
              />
              <StatCard
                label="Start Whuffies"
                value={formatMoneyLabel(economy.startingWhuffieGrant)}
                href={adminTabHref('economy')}
              />
            </div>
          ) : null}

          <div className="flex flex-col gap-5">{children}</div>
        </main>
      </div>
    </div>
  );
}
